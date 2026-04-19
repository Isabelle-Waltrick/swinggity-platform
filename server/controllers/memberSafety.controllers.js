import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { sendProfileReportToAdmins } from '../mailtrap/emails.js';
import {
    escapeHtml,
    getIdSet,
    PROFILE_REPORT_ALLOWED_REASONS,
    PROFILE_REPORT_DETAILS_MAX_LENGTH,
} from './controllerShared.js';

export const blockMember = async (req, res) => {
    try {
        const userId = String(req.userId || '');
        const { memberId } = req.params;

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (userId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot block yourself' });
        }

        const [myProfile, memberProfile] = await Promise.all([
            Profile.findOne({ user: userId }),
            Profile.findOne({ user: memberId }),
        ]);

        if (!myProfile || !memberProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        const blockedSet = getIdSet(myProfile.blockedMembers);
        blockedSet.add(String(memberId));
        myProfile.blockedMembers = [...blockedSet];

        myProfile.jamCircleMembers = (Array.isArray(myProfile.jamCircleMembers) ? myProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== String(memberId));
        memberProfile.jamCircleMembers = (Array.isArray(memberProfile.jamCircleMembers) ? memberProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== userId);

        myProfile.pendingCircleInvitations = (Array.isArray(myProfile.pendingCircleInvitations) ? myProfile.pendingCircleInvitations : [])
            .filter((invite) => String(invite?.invitedBy || '') !== String(memberId));
        memberProfile.pendingCircleInvitations = (Array.isArray(memberProfile.pendingCircleInvitations) ? memberProfile.pendingCircleInvitations : [])
            .filter((invite) => String(invite?.invitedBy || '') !== userId);

        await Promise.all([myProfile.save(), memberProfile.save()]);

        return res.status(200).json({
            success: true,
            message: 'Member blocked',
        });
    } catch (error) {
        console.log('Error in blockMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getBlockedMembers = async (req, res) => {
    try {
        const userId = String(req.userId || '');
        const profile = await Profile.findOne({ user: userId })
            .populate({ path: 'blockedMembers', select: 'firstName lastName role' })
            .lean();

        if (!profile) {
            return res.status(200).json({ success: true, members: [] });
        }

        const blockedIds = (Array.isArray(profile.blockedMembers) ? profile.blockedMembers : []).map((id) => String(id));
        const blockedProfiles = await Profile.find({ user: { $in: blockedIds } })
            .populate('user', 'firstName lastName role')
            .lean();
        const byUserId = new Map(blockedProfiles.map((entry) => [String(entry?.user?._id), entry]));

        const members = blockedIds
            .map((id) => byUserId.get(id))
            .filter(Boolean)
            .map((entry) => ({
                userId: entry.user?._id,
                displayFirstName: (entry.displayFirstName || entry.user?.firstName || '').trim(),
                displayLastName: (entry.displayLastName || entry.user?.lastName || '').trim(),
                fullName: `${(entry.displayFirstName || entry.user?.firstName || '').trim()} ${(entry.displayLastName || entry.user?.lastName || '').trim()}`.trim() || 'Swinggity Member',
                role: String(entry.user?.role || '').trim().toLowerCase(),
                avatarUrl: typeof entry.avatarUrl === 'string' ? entry.avatarUrl.trim() : '',
            }));

        return res.status(200).json({ success: true, members });
    } catch (error) {
        console.log('Error in getBlockedMembers ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const unblockMember = async (req, res) => {
    try {
        const userId = String(req.userId || '');
        const { memberId } = req.params;

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        const profile = await Profile.findOne({ user: userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        profile.blockedMembers = (Array.isArray(profile.blockedMembers) ? profile.blockedMembers : [])
            .filter((id) => String(id) !== String(memberId));
        await profile.save();

        return res.status(200).json({ success: true, message: 'Member unblocked' });
    } catch (error) {
        console.log('Error in unblockMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const reportMemberProfile = async (req, res) => {
    try {
        const reporterUserId = String(req.userId || '');
        const { memberId } = req.params;

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (reporterUserId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot report your own profile' });
        }

        const incomingReasons = Array.isArray(req.body?.reasons) ? req.body.reasons : [];
        const reasons = incomingReasons
            .map((reason) => (typeof reason === 'string' ? reason.trim() : ''))
            .filter((reason) => PROFILE_REPORT_ALLOWED_REASONS.has(reason));

        const dedupedReasons = [...new Set(reasons)];
        if (dedupedReasons.length === 0) {
            return res.status(400).json({ success: false, message: 'Please choose at least one valid reason.' });
        }

        const additionalDetails = typeof req.body?.additionalDetails === 'string' ? req.body.additionalDetails.trim() : '';
        if (additionalDetails.length > PROFILE_REPORT_DETAILS_MAX_LENGTH) {
            return res.status(400).json({ success: false, message: `Additional details must be ${PROFILE_REPORT_DETAILS_MAX_LENGTH} characters or fewer.` });
        }

        const [reporterUser, reporterProfile, targetUser, targetProfile, adminUsers] = await Promise.all([
            User.findById(reporterUserId),
            Profile.findOne({ user: reporterUserId }),
            User.findById(memberId),
            Profile.findOne({ user: memberId }),
            User.find({ role: 'admin' }).select('email').lean(),
        ]);

        if (!reporterUser || !reporterProfile || !targetUser || !targetProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        const adminEmails = [...new Set(
            (Array.isArray(adminUsers) ? adminUsers : [])
                .map((admin) => String(admin?.email || '').trim())
                .filter(Boolean)
        )];

        if (adminEmails.length === 0) {
            return res.status(500).json({ success: false, message: 'No admin recipients available to receive this report.' });
        }

        const reporterDisplayFirstName = (reporterProfile.displayFirstName || reporterUser.firstName || '').trim();
        const reporterDisplayLastName = (reporterProfile.displayLastName || reporterUser.lastName || '').trim();
        const reporterName = `${reporterDisplayFirstName} ${reporterDisplayLastName}`.trim() || 'Swinggity Member';

        const targetDisplayFirstName = (targetProfile.displayFirstName || targetUser.firstName || '').trim();
        const targetDisplayLastName = (targetProfile.displayLastName || targetUser.lastName || '').trim();
        const reportedMemberName = `${targetDisplayFirstName} ${targetDisplayLastName}`.trim() || 'Swinggity Member';

        await sendProfileReportToAdmins({
            adminEmails,
            reporterName: escapeHtml(reporterName),
            reporterEmail: escapeHtml(reporterUser.email || ''),
            reporterUserId: escapeHtml(reporterUserId),
            reportedMemberName: escapeHtml(reportedMemberName),
            reportedMemberEmail: escapeHtml(targetUser.email || ''),
            reportedMemberUserId: escapeHtml(String(targetUser._id || memberId)),
            reasonsHtml: dedupedReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join(''),
            additionalDetails: escapeHtml(additionalDetails || 'No additional details provided.'),
        });

        return res.status(200).json({
            success: true,
            message: 'Your report has been submitted.',
        });
    } catch (error) {
        console.log('Error in reportMemberProfile ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
