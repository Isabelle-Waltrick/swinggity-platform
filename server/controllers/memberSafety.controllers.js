import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { sendProfileReportToAdmins } from '../mailtrap/emails.js';
import { escapeHtml } from '../utils/formatters.utils.js';
import { getIdSet } from '../utils/memberPrivacy.utils.js';
import {
    PROFILE_REPORT_ALLOWED_REASONS,
    PROFILE_REPORT_DETAILS_MAX_LENGTH,
} from '../constants/memberRules.constants.js';

/**
 * blockMember:
 * Blocks another member, and removes any existing jam-circle relationship or
 * pending invitations between the two users.
 */
export const blockMember = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = String(req.userId || '');
        const { memberId } = req.params;

        // Reject malformed member ids before hitting database reads.
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        // Prevent users from blocking themselves.
        if (userId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot block yourself' });
        }

        // Load both profiles together because we mutate relationship data on both sides.
        const [myProfile, memberProfile] = await Promise.all([
            Profile.findOne({ user: userId }),
            Profile.findOne({ user: memberId }),
        ]);

        if (!myProfile || !memberProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        // Upsert into blocked set to avoid duplicates.
        const blockedSet = getIdSet(myProfile.blockedMembers);
        blockedSet.add(String(memberId));
        myProfile.blockedMembers = [...blockedSet];

        // Remove mutual jam-circle links once either side blocks the other.
        myProfile.jamCircleMembers = (Array.isArray(myProfile.jamCircleMembers) ? myProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== String(memberId));
        memberProfile.jamCircleMembers = (Array.isArray(memberProfile.jamCircleMembers) ? memberProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== userId);

        // Clear pending invitations between these two users in both directions.
        //Take the pending invitations list (or an empty list if it doesn’t exist), then remove invitations sent by that blocked member.
        myProfile.pendingCircleInvitations = (Array.isArray(myProfile.pendingCircleInvitations) ? myProfile.pendingCircleInvitations : [])
            .filter((invite) => String(invite?.invitedBy || '') !== String(memberId));
        //Do the same for the blocked member’s profile, removing any invitations sent by the current user.
        memberProfile.pendingCircleInvitations = (Array.isArray(memberProfile.pendingCircleInvitations) ? memberProfile.pendingCircleInvitations : [])
            .filter((invite) => String(invite?.invitedBy || '') !== userId);
        // Save both profiles with the updated relationship and invitation data.
        await Promise.all([myProfile.save(), memberProfile.save()]);
        // If we made it this far, the block was successful!
        return res.status(200).json({
            success: true,
            message: 'Member blocked',
        });
    } catch (error) {
        console.log('Error in blockMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * getBlockedMembers:
 * Returns the current user's blocked-member list enriched with display data
 * used by the member safety UI.
 */
export const getBlockedMembers = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = String(req.userId || '');
        // Load only the current user's profile first because blocked-members live there.
        // lean() keeps this read lightweight since we only need plain response data.
        const profile = await Profile.findOne({ user: userId })
            .populate({ path: 'blockedMembers', select: 'firstName lastName role' })
            .lean();

        // If the user has no profile yet, they cannot have blocked anyone.
        if (!profile) {
            return res.status(200).json({ success: true, members: [] });
        }
        // Normalize blocked member ids and preserve the stored order from the profile document.
        // That way the UI receives the list in the same order the backend currently tracks it.
        const blockedIds = (Array.isArray(profile.blockedMembers) ? profile.blockedMembers : []).map((id) => String(id));

        // Load the corresponding profile records for those blocked user ids.
        // We need profile-level display fields plus basic user account info for the safety screen.
        const blockedProfiles = await Profile.find({ user: { $in: blockedIds } })
            .populate('user', 'firstName lastName role')
            .lean();

        // Index results by user id so we can restore the original blockedIds order cheaply.
        const byUserId = new Map(blockedProfiles.map((entry) => [String(entry?.user?._id), entry]));

        // Rebuild the blocked-members list in stored order and shape it for direct frontend use.
        const members = blockedIds
            // Convert each blocked id into its loaded profile entry.
            .map((id) => byUserId.get(id))
            // Ignore ids whose profiles no longer exist or failed to load.
            .filter(Boolean)
            // Return the exact display payload expected by the member safety UI.
            .map((entry) => ({
                userId: entry.user?._id,
                // Prefer profile display names over raw account first/last names.
                displayFirstName: (entry.displayFirstName || entry.user?.firstName || '').trim(),
                displayLastName: (entry.displayLastName || entry.user?.lastName || '').trim(),
                // Build one fallback-safe full name so the client does not need to repeat name logic.
                fullName: `${(entry.displayFirstName || entry.user?.firstName || '').trim()} ${(entry.displayLastName || entry.user?.lastName || '').trim()}`.trim() || 'Swinggity Member',
                // Normalize role casing for consistent tag/rendering logic in the UI.
                role: String(entry.user?.role || '').trim().toLowerCase(),
                // Trim avatar url because this value is rendered directly by the client.
                avatarUrl: typeof entry.avatarUrl === 'string' ? entry.avatarUrl.trim() : '',
            }));

        // Return a ready-to-render blocked members payload.
        return res.status(200).json({ success: true, members });
    } catch (error) {
        console.log('Error in getBlockedMembers ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * unblockMember:
 * Removes a member from the current user's blocked-members list.
 */
export const unblockMember = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Normalize requester id from auth context and target id from route params.
        const userId = String(req.userId || '');
        const { memberId } = req.params;

        // Reject malformed member ids before querying profile.
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        // Load the current user's profile because the blocked list is stored there.
        const profile = await Profile.findOne({ user: userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        // Remove the target id from blockedMembers; if it is absent this is a no-op.
        profile.blockedMembers = (Array.isArray(profile.blockedMembers) ? profile.blockedMembers : [])
            .filter((id) => String(id) !== String(memberId));

        // Persist the updated blocked list.
        await profile.save();

        // Return success response expected by member safety UI.
        return res.status(200).json({ success: true, message: 'Member unblocked' });
    } catch (error) {
        console.log('Error in unblockMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * reportMemberProfile:
 * Validates a profile report and sends the report payload to admin recipients.
 */
export const reportMemberProfile = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Normalize authenticated reporter id and reported member id into safe string values.
        const reporterUserId = String(req.userId || '');
        const { memberId } = req.params;

        // Reject malformed target ids before any DB reads.
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        // Users cannot report their own profile.
        if (reporterUserId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot report your own profile' });
        }

        // Read reasons as an array only; any other payload shape is treated as empty input.
        const incomingReasons = Array.isArray(req.body?.reasons) ? req.body.reasons : [];

        // Trim each reason and keep only allowlisted values from member rules constants.
        const reasons = incomingReasons
            .map((reason) => (typeof reason === 'string' ? reason.trim() : ''))
            .filter((reason) => PROFILE_REPORT_ALLOWED_REASONS.has(reason));

        // De-duplicate selected reasons so repeated clicks cannot duplicate report items.
        const dedupedReasons = [...new Set(reasons)];
        if (dedupedReasons.length === 0) {
            return res.status(400).json({ success: false, message: 'Please choose at least one valid reason.' });
        }

        // Additional details are optional, normalized to a trimmed string, and size-limited.
        const additionalDetails = typeof req.body?.additionalDetails === 'string' ? req.body.additionalDetails.trim() : '';
        if (additionalDetails.length > PROFILE_REPORT_DETAILS_MAX_LENGTH) {
            return res.status(400).json({ success: false, message: `Additional details must be ${PROFILE_REPORT_DETAILS_MAX_LENGTH} characters or fewer.` });
        }

        // Load reporter + target identity and admin recipients concurrently for one round trip.
        const [reporterUser, reporterProfile, targetUser, targetProfile, adminUsers] = await Promise.all([
            User.findById(reporterUserId),
            Profile.findOne({ user: reporterUserId }),
            User.findById(memberId),
            Profile.findOne({ user: memberId }),
            User.find({ role: 'admin' }).select('email').lean(),
        ]);

        // Abort if either side no longer has the user/profile pair required for reporting.
        if (!reporterUser || !reporterProfile || !targetUser || !targetProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        // Normalize recipient emails (trim + remove empties) and de-duplicate for a clean send list.
        const adminEmails = [...new Set(
            (Array.isArray(adminUsers) ? adminUsers : [])
                .map((admin) => String(admin?.email || '').trim())
                .filter(Boolean)
        )];

        // Report delivery requires at least one admin recipient.
        if (adminEmails.length === 0) {
            return res.status(500).json({ success: false, message: 'No admin recipients available to receive this report.' });
        }

        // Build reporter display name using profile overrides first, then account fallbacks.
        const reporterDisplayFirstName = (reporterProfile.displayFirstName || reporterUser.firstName || '').trim();
        const reporterDisplayLastName = (reporterProfile.displayLastName || reporterUser.lastName || '').trim();
        const reporterName = `${reporterDisplayFirstName} ${reporterDisplayLastName}`.trim() || 'Swinggity Member';

        // Build reported-member display name using the same fallback strategy for consistency.
        const targetDisplayFirstName = (targetProfile.displayFirstName || targetUser.firstName || '').trim();
        const targetDisplayLastName = (targetProfile.displayLastName || targetUser.lastName || '').trim();
        const reportedMemberName = `${targetDisplayFirstName} ${targetDisplayLastName}`.trim() || 'Swinggity Member';

        // Escape all user-derived fields before injecting into HTML email content.
        // reasonsHtml is generated as escaped <li> elements for the email template list block.
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

        // Return a generic success message without exposing admin recipient details.
        return res.status(200).json({
            success: true,
            message: 'Your report has been submitted.',
        });
    } catch (error) {
        console.log('Error in reportMemberProfile ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
