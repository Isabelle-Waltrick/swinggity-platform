import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { sendJamCircleInviteEmail } from '../mailtrap/emails.js';
import {
    canAcceptJamCircleInvitation,
    getJamCircleInviteRoleDecision,
} from '../utils/rolePermissions.js';
import { buildJamCircleMemberPayload } from '../serializers/memberPayloads.serializer.js';
import { getIdSet, hasBlockingRelationship } from '../utils/memberPrivacy.utils.js';
import { resolveAbsoluteAssetUrl } from '../services/mediaStorage.service.js';

/**
 * inviteMemberToJamCircle: handles this function's core responsibility.
 */
export const inviteMemberToJamCircle = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const inviterUserId = String(req.userId || '');
        const { memberId } = req.params;

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (inviterUserId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot invite yourself' });
        }

        const inviterUser = await User.findById(inviterUserId);
        const inviterProfile = await Profile.findOne({ user: inviterUserId });
        const inviteeUser = await User.findById(memberId);
        const inviteeProfile = await Profile.findOne({ user: memberId });

        if (!inviterUser || !inviteeUser || !inviterProfile || !inviteeProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        const inviteRoleDecision = getJamCircleInviteRoleDecision({
            inviterRole: inviterUser.role,
            inviteeRole: inviteeUser.role,
        });

        if (!inviteRoleDecision.allowed) {
            if (inviteRoleDecision.reason === 'inviter-is-admin') {
                return res.status(403).json({ success: false, message: 'Admin accounts cannot add members to a Jam Circle' });
            }

            return res.status(403).json({ success: false, message: 'You cannot add an admin account to your Jam Circle' });
        }

        if (hasBlockingRelationship(inviterProfile, inviteeProfile, inviterUserId, memberId)) {
            return res.status(403).json({ success: false, message: 'You cannot invite this member' });
        }

        /**
         * alreadyInCircle: handles this function's core responsibility.
         */
        const alreadyInCircle = (Array.isArray(inviterProfile.jamCircleMembers) ? inviterProfile.jamCircleMembers : [])
            .some((id) => String(id) === String(memberId));
        if (alreadyInCircle) {
            return res.status(400).json({ success: false, message: 'This member is already in your Jam Circle' });
        }

        /**
         * activeInviteExists: handles this function's core responsibility.
         */
        const activeInviteExists = (Array.isArray(inviteeProfile.pendingCircleInvitations) ? inviteeProfile.pendingCircleInvitations : [])
            .some((invite) => String(invite?.invitedBy || '') === inviterUserId && invite?.expiresAt && new Date(invite.expiresAt).getTime() > Date.now());
        if (activeInviteExists) {
            return res.status(400).json({ success: false, message: 'You already sent an active invitation to this member' });
        }

        const invitationToken = crypto.randomBytes(32).toString('hex');
        const invitationTokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const inviterDisplayFirstName = inviterProfile.displayFirstName?.trim() || inviterUser.firstName;
        const inviterDisplayLastName = inviterProfile.displayLastName?.trim() || inviterUser.lastName;
        const inviterName = `${inviterDisplayFirstName} ${inviterDisplayLastName}`.trim() || 'A Swinggity member';
        const inviterAvatarAbsolute = resolveAbsoluteAssetUrl(req, inviterProfile.avatarUrl);
        const fallbackAvatar = 'https://ui-avatars.com/api/?name=Swinggity+Member&background=FF6699&color=ffffff&size=256';
        const avatarForEmail = inviterAvatarAbsolute || fallbackAvatar;

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const encodedToken = encodeURIComponent(invitationToken);
        const acceptUrl = `${baseUrl}/api/jam-circle/circle-invitations/respond?token=${encodedToken}&action=accept`;
        const denyUrl = `${baseUrl}/api/jam-circle/circle-invitations/respond?token=${encodedToken}&action=deny`;

        inviteeProfile.pendingCircleInvitations = [
            ...(Array.isArray(inviteeProfile.pendingCircleInvitations) ? inviteeProfile.pendingCircleInvitations : []),
            {
                tokenHash: invitationTokenHash,
                invitedBy: inviterUser._id,
                invitedByName: inviterName,
                invitedByAvatarUrl: inviterProfile.avatarUrl || '',
                invitedAt: new Date(),
                expiresAt: inviteExpiresAt,
            },
        ];

        await inviteeProfile.save();
        await sendJamCircleInviteEmail(inviteeUser.email, inviterName, avatarForEmail, acceptUrl, denyUrl);

        return res.status(200).json({
            success: true,
            message: 'Invitation sent successfully',
        });
    } catch (error) {
        console.log('Error in inviteMemberToJamCircle ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * respondToJamCircleInvite: handles this function's core responsibility.
 */
export const respondToJamCircleInvite = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const { token, action } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).send('Invalid invitation token.');
        }

        if (action !== 'accept' && action !== 'deny') {
            return res.status(400).send('Invalid invitation action.');
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const inviteeProfile = await Profile.findOne({ 'pendingCircleInvitations.tokenHash': tokenHash });
        if (!inviteeProfile) {
            return res.status(404).send('This invitation was not found or has already been used.');
        }

        const pendingInvites = Array.isArray(inviteeProfile.pendingCircleInvitations)
            ? inviteeProfile.pendingCircleInvitations
            : [];
        const invitation = pendingInvites.find((item) => item?.tokenHash === tokenHash);
        if (!invitation) {
            return res.status(404).send('This invitation was not found or has already been used.');
        }

        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            inviteeProfile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
            await inviteeProfile.save();
            return res.status(410).send('This invitation has expired.');
        }

        inviteeProfile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);

        const inviterUserId = String(invitation.invitedBy);
        const inviteeUser = await User.findById(inviteeProfile.user).select('role');
        const canAcceptInvite = canAcceptJamCircleInvitation(inviteeUser?.role);

        if (action === 'accept') {
            if (!canAcceptInvite) {
                await inviteeProfile.save();
                return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Jam Circle Invitation Denied</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; max-width: 620px; margin: 40px auto; padding: 20px;">
	<div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
		<h1 style="color: #fff; margin: 0;">Invitation denied</h1>
	</div>
	<div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
		<p style="margin: 0;">Admin accounts cannot accept Jam Circle invitations.</p>
	</div>
</body>
</html>
`);
            }

            const inviteeMembers = new Set((Array.isArray(inviteeProfile.jamCircleMembers) ? inviteeProfile.jamCircleMembers : []).map((id) => String(id)));
            inviteeMembers.add(inviterUserId);
            inviteeProfile.jamCircleMembers = [...inviteeMembers];

            await Profile.findOneAndUpdate(
                { user: inviterUserId },
                { $addToSet: { jamCircleMembers: inviteeProfile.user } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
        }

        await inviteeProfile.save();

        const statusText = action === 'accept' ? 'accepted' : 'denied';
        const actionMessage = action === 'accept'
            ? 'Invitation accepted. This member is now in your Jam Circle.'
            : 'Invitation denied. No changes were made to your Jam Circle.';
        return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Jam Circle Invitation ${statusText}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; max-width: 620px; margin: 40px auto; padding: 20px;">
	<div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
		<h1 style="color: #fff; margin: 0; text-transform: capitalize;">Invitation ${statusText}</h1>
	</div>
	<div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
		<p style="margin: 0;">${actionMessage}</p>
	</div>
</body>
</html>
`);
    } catch (error) {
        console.log('Error in respondToJamCircleInvite ', error);
        return res.status(500).send('Something went wrong while processing this invitation.');
    }
};

/**
 * getMyJamCircle: handles this function's core responsibility.
 */
export const getMyJamCircle = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = String(req.userId || '');
        const profile = await Profile.findOne({ user: userId }).lean();
        if (!profile) {
            return res.status(200).json({ success: true, members: [] });
        }

        /**
         * memberIds: handles this function's core responsibility.
         */
        const memberIds = (Array.isArray(profile.jamCircleMembers) ? profile.jamCircleMembers : []).map((id) => String(id));
        if (memberIds.length === 0) {
            return res.status(200).json({ success: true, members: [] });
        }

        const circleProfiles = await Profile.find({ user: { $in: memberIds } })
            .populate('user', 'firstName lastName role')
            .lean();

        const byUserId = new Map(circleProfiles.map((item) => [String(item?.user?._id), item]));
        const members = memberIds
            .map((id) => buildJamCircleMemberPayload(byUserId.get(id)))
            .filter(Boolean);

        return res.status(200).json({ success: true, members });
    } catch (error) {
        console.log('Error in getMyJamCircle ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * removeJamCircleMember: handles this function's core responsibility.
 */
export const removeJamCircleMember = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = String(req.userId || '');
        const { memberId } = req.params;

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (userId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot remove yourself' });
        }

        const [myProfile, memberProfile] = await Promise.all([
            Profile.findOne({ user: userId }),
            Profile.findOne({ user: memberId }),
        ]);

        if (!myProfile || !memberProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        myProfile.jamCircleMembers = (Array.isArray(myProfile.jamCircleMembers) ? myProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== String(memberId));
        memberProfile.jamCircleMembers = (Array.isArray(memberProfile.jamCircleMembers) ? memberProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== userId);

        await Promise.all([myProfile.save(), memberProfile.save()]);

        return res.status(200).json({
            success: true,
            message: 'Member removed from your Jam Circle',
        });
    } catch (error) {
        console.log('Error in removeJamCircleMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * getPendingCircleInvitations: handles this function's core responsibility.
 */
export const getPendingCircleInvitations = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = String(req.userId || '');
        const profile = await Profile.findOne({ user: userId })
            .populate('pendingCircleInvitations.invitedBy', 'firstName lastName')
            .lean();

        if (!profile) {
            return res.status(200).json({ success: true, invitations: [] });
        }

        const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
            ? profile.pendingCircleInvitations.filter((invite) => {
                const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
                return expiresAt > Date.now();
            })
            : [];

        const formattedInvitations = pendingInvites.map((invite) => ({
            tokenHash: invite?.tokenHash || '',
            invitedBy: invite?.invitedBy?._id || invite?.invitedBy || '',
            inviterName: invite?.invitedByName || 'A Swinggity member',
            inviterAvatarUrl: invite?.invitedByAvatarUrl || '',
            invitedAt: invite?.invitedAt || new Date(),
            expiresAt: invite?.expiresAt || new Date(),
        }));

        return res.status(200).json({ success: true, invitations: formattedInvitations });
    } catch (error) {
        console.log('Error in getPendingCircleInvitations ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * respondToCircleInvitationInApp: handles this function's core responsibility.
 */
export const respondToCircleInvitationInApp = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = String(req.userId || '');
        const { tokenHash, action } = req.body;

        if (!tokenHash || typeof tokenHash !== 'string') {
            return res.status(400).json({ success: false, message: 'Invalid invitation token' });
        }

        if (action !== 'accept' && action !== 'deny') {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const profile = await Profile.findOne({ user: userId });
        const user = await User.findById(userId).select('role');
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        const canAcceptInvite = canAcceptJamCircleInvitation(user?.role);
        const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
            ? profile.pendingCircleInvitations
            : [];
        const invitation = pendingInvites.find((item) => item?.tokenHash === tokenHash);

        if (!invitation) {
            return res.status(404).json({ success: false, message: 'Invitation not found' });
        }

        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            profile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
            await profile.save();
            return res.status(410).json({ success: false, message: 'This invitation has expired' });
        }

        profile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
        const inviterUserId = String(invitation.invitedBy);

        if (action === 'accept') {
            if (!canAcceptInvite) {
                await profile.save();
                return res.status(403).json({ success: false, message: 'Admin accounts cannot accept Jam Circle invitations' });
            }

            const myMembers = getIdSet(profile.jamCircleMembers);
            myMembers.add(inviterUserId);
            profile.jamCircleMembers = [...myMembers];

            await Profile.findOneAndUpdate(
                { user: inviterUserId },
                { $addToSet: { jamCircleMembers: profile.user } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
        }

        await profile.save();

        return res.status(200).json({
            success: true,
            message: action === 'accept' ? 'Invitation accepted' : 'Invitation denied',
        });
    } catch (error) {
        console.log('Error in respondToCircleInvitationInApp ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
