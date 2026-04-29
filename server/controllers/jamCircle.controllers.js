// The code in this file were created with help of AI (Copilot)

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
 * inviteMemberToJamCircle: Sends a jam circle invitation to another member by the current user.
 * 
 * Flow: (1) Validates both users exist and role permissions allow the invite, (2) Checks for blocking relationships,
 * (3) Prevents duplicate active invites and membership already established, (4) Creates a cryptographically secure token,
 * hashes it with SHA256, sets 7-day expiry, (5) Stores hashed token in invitee's pendingCircleInvitations,
 * (6) Sends email with accept/decline links containing the plaintext token in query params, (7) Returns success.
 */
export const inviteMemberToJamCircle = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Extract and normalize userId from the authenticated request (set by verifyToken middleware)
        const inviterUserId = String(req.userId || '');
        // Extract the target member's ID from URL params (/members/:memberId/invite)
        const { memberId } = req.params;

        // Validate memberId format: must be a valid 24-character MongoDB ObjectId in hexadecimal
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        // Prevent self-invites: user cannot add themselves to their own jam circle
        if (inviterUserId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot invite yourself' });
        }

        // Fetch both User and Profile documents for the inviter and invitee in parallel via await
        // User document contains authentication data and role; Profile contains jam circle relationships
        const inviterUser = await User.findById(inviterUserId);
        const inviterProfile = await Profile.findOne({ user: inviterUserId });
        const inviteeUser = await User.findById(memberId);
        const inviteeProfile = await Profile.findOne({ user: memberId });

        // All four documents must exist for the invitation to proceed; if any is missing, member data is incomplete
        if (!inviterUser || !inviteeUser || !inviterProfile || !inviteeProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        // Check role-based permissions: certain roles (e.g., admin) cannot invite or cannot be invited
        const inviteRoleDecision = getJamCircleInviteRoleDecision({
            inviterRole: inviterUser.role,
            inviteeRole: inviteeUser.role,
        });

        // If role permissions disallow the invitation, respond with a descriptive 403 error
        if (!inviteRoleDecision.allowed) {
            if (inviteRoleDecision.reason === 'inviter-is-admin') {
                return res.status(403).json({ success: false, message: 'Admin accounts cannot add members to a Jam Circle' });
            }

            return res.status(403).json({ success: false, message: 'You cannot add an admin account to your Jam Circle' });
        }

        // Check bidirectional blocking relationships: if either user has blocked the other, deny the invite
        if (hasBlockingRelationship(inviterProfile, inviteeProfile, inviterUserId, memberId)) {
            return res.status(403).json({ success: false, message: 'You cannot invite this member' });
        }

        // Verify the target member is not already in the inviter's jam circle
        // This prevents duplicate active members (the inviter's jamCircleMembers array should be an array or empty)
        const alreadyInCircle = (Array.isArray(inviterProfile.jamCircleMembers) ? inviterProfile.jamCircleMembers : [])
            .some((id) => String(id) === String(memberId));
        if (alreadyInCircle) {
            return res.status(400).json({ success: false, message: 'This member is already in your Jam Circle' });
        }

        // Prevent duplicate pending invitations: check if an active (non-expired) invite already exists from this inviter
        // An invitation is active if it was created by the same inviter and its expiresAt timestamp is in the future
        const activeInviteExists = (Array.isArray(inviteeProfile.pendingCircleInvitations) ? inviteeProfile.pendingCircleInvitations : [])
            .some((invite) => String(invite?.invitedBy || '') === inviterUserId && invite?.expiresAt && new Date(invite.expiresAt).getTime() > Date.now());
        if (activeInviteExists) {
            return res.status(400).json({ success: false, message: 'You already sent an active invitation to this member' });
        }

        // Generate cryptographically secure token: 32 random bytes converted to hexadecimal (64 chars)
        // This token will be sent in the email and must be kept secret (only hash is stored in DB)
        const invitationToken = crypto.randomBytes(32).toString('hex');
        // Hash the plaintext token with SHA256: only the hash is stored in the database for security
        // When the user clicks the email link, we hash the token they provide and compare it to the stored hash
        const invitationTokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
        // Set invitation expiry to 7 days from now (in milliseconds)
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Build inviter's display name: use displayFirstName/displayLastName if set, otherwise fall back to firstName/lastName
        // Fallback ensures a name is always available even if custom display names are missing
        const inviterDisplayFirstName = inviterProfile.displayFirstName?.trim() || inviterUser.firstName;
        const inviterDisplayLastName = inviterProfile.displayLastName?.trim() || inviterUser.lastName;
        const inviterName = `${inviterDisplayFirstName} ${inviterDisplayLastName}`.trim() || 'A Swinggity member';
        // Resolve inviter's avatar URL to absolute form (needed for email clients to display images)
        const inviterAvatarAbsolute = resolveAbsoluteAssetUrl(req, inviterProfile.avatarUrl);
        // Fallback avatar if inviter hasn't uploaded one: use UI Avatars service to generate a placeholder
        const fallbackAvatar = 'https://ui-avatars.com/api/?name=Swinggity+Member&background=FF6699&color=ffffff&size=256';
        const avatarForEmail = inviterAvatarAbsolute || fallbackAvatar;

        // Build the email link URLs: token is URL-encoded to handle special characters safely
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const encodedToken = encodeURIComponent(invitationToken);
        // Accept link: GET /api/jam-circle/circle-invitations/respond?token=...&action=accept (no auth needed)
        const acceptUrl = `${baseUrl}/api/jam-circle/circle-invitations/respond?token=${encodedToken}&action=accept`;
        // Deny link: GET /api/jam-circle/circle-invitations/respond?token=...&action=deny (no auth needed)
        const denyUrl = `${baseUrl}/api/jam-circle/circle-invitations/respond?token=${encodedToken}&action=deny`;

        // Add the new invitation to invitee's pendingCircleInvitations array using spread operator
        // Spread existing invitations (or empty array if none exist) and append the new invitation object
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

        // Save the modified invitee profile to the database: await ensures the save completes before sending email
        await inviteeProfile.save();
        // Send email with accept/deny links: recipient can respond without logging in by clicking email links
        await sendJamCircleInviteEmail(inviteeUser.email, inviterName, avatarForEmail, acceptUrl, denyUrl);

        // Return success response with 200 status
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
 * getPendingCircleInvitations: Fetches all pending jam circle invitations the user has received.
 * 
 * Flow: (1) Extracts userId from verifyToken middleware, (2) Finds user's profile and populates
 * pendingCircleInvitations[].invitedBy with sender's firstName and lastName, uses .lean() to return plain objects,
 * (3) Filters out expired invitations by comparing expiresAt timestamp to current Date.now(),
 * (4) Maps remaining invitations to formatted objects containing tokenHash, invitedBy ID, inviter name/avatar,
 * timestamps, (5) Uses fallback values (e.g., 'A Swinggity member' if name missing), (6) Returns array of
 * formatted pending invitations or empty array if none exist.
 */
export const getPendingCircleInvitations = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Extract and normalize userId from the authenticated request (set by verifyToken middleware)
        const userId = String(req.userId || '');

        // Fetch user's profile and populate the nested invitedBy references with inviter details
        // .populate('pendingCircleInvitations.invitedBy', 'firstName lastName') replaces the ObjectId reference
        // in each pending invitation with the actual User document, but only firstName and lastName fields are retrieved
        // .lean() returns a plain JavaScript object (not a Mongoose document), which is more efficient for read-only operations
        const profile = await Profile.findOne({ user: userId })
            .populate('pendingCircleInvitations.invitedBy', 'firstName lastName')
            .lean();

        // If no profile is found, return 404 error (though in practice this should not happen for authenticated users)
        if (!profile) {
            return res.status(404).json({ success: false, message: 'User profile not found' });
        }

        // Filter pending invitations to exclude expired ones
        // Check if pendingCircleInvitations is an array; if not (null/undefined), use empty array as fallback
        // For each invitation, extract the expiresAt timestamp and convert to milliseconds (getTime())
        // Compare the timestamp to current time (Date.now()): keep only invitations where expiresAt is in the future
        const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
            ? profile.pendingCircleInvitations.filter((invite) => {
                // If expiresAt exists, convert to milliseconds; otherwise default to 0 (which is always in the past)
                const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
                // Keep this invitation only if its expiry timestamp is greater than current time (not yet expired)
                return expiresAt > Date.now();
            })
            : [];

        // Transform each valid pending invitation into a client-friendly format
        // Use optional chaining (?.) to safely access nested properties and fallback operators (||) for missing values
        const formattedInvitations = pendingInvites.map((invite) => ({
            // tokenHash: The hashed token stored in DB (used for matching when inviting via email link)
            tokenHash: invite?.tokenHash || '',
            // invitedBy: The userId of the member who sent this invitation (populated from User._id)
            invitedBy: invite?.invitedBy?._id || invite?.invitedBy || '',
            // inviterName: Display name of the inviter, fallback to 'A Swinggity member' if not provided
            inviterName: invite?.invitedByName || 'A Swinggity member',
            // inviterAvatarUrl: URL to inviter's avatar image, empty string if missing
            inviterAvatarUrl: invite?.invitedByAvatarUrl || '',
            // invitedAt: Timestamp when the invitation was created
            invitedAt: invite?.invitedAt || new Date(),
            // expiresAt: Timestamp when the invitation expires (7 days after creation)
            expiresAt: invite?.expiresAt || new Date(),
        }));

        // Return the formatted invitations as a JSON response with success status
        return res.status(200).json({ success: true, invitations: formattedInvitations });
    } catch (error) {
        console.log('Error in getPendingCircleInvitations ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * respondToJamCircleInvite: Handles unauthenticated email link responses to jam circle invitations.
 * 
 * Flow: (1) Extracts token and action (accept/deny) from URL query params, (2) Hashes token with SHA256 and searches
 * for matching pending invitation in database, (3) Validates invitation exists and has not expired, (4) Checks if invitee
 * role permits accepting invitations (e.g., admin accounts cannot accept), (5) If accepted, adds inviter to both invitee's
 * and inviter's jamCircleMembers (bidirectional relationship), (6) Removes invitation from pending list,
 * (7) Returns styled HTML page confirming accept/deny, not JSON (for email link UX).
 */
export const respondToJamCircleInvite = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Email-link flow passes token and action through query string.
        const { token, action } = req.query;
        // Token must exist and be a string before we hash and look it up.
        if (!token || typeof token !== 'string') {
            return res.status(400).send('Invalid invitation token.');
        }
        // Only two valid transitions are supported for invitation state.
        if (action !== 'accept' && action !== 'deny') {
            return res.status(400).send('Invalid invitation action.');
        }
        // Hash incoming plaintext token so comparison is done against stored hash, not raw token.
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        // Find the profile that currently has this invitation token in pending list.
        const inviteeProfile = await Profile.findOne({ 'pendingCircleInvitations.tokenHash': tokenHash });
        if (!inviteeProfile) {
            return res.status(404).send('This invitation was not found or has already been used.');
        }
        // Normalize pending invitations to avoid null/undefined edge cases.
        const pendingInvites = Array.isArray(inviteeProfile.pendingCircleInvitations)
            ? inviteeProfile.pendingCircleInvitations
            : [];
        // Locate the exact pending invitation matching the token hash.
        const invitation = pendingInvites.find((item) => item?.tokenHash === tokenHash);
        if (!invitation) {
            return res.status(404).send('This invitation was not found or has already been used.');
        }
        // Expired invitations are removed immediately so stale links cannot be reused.
        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            inviteeProfile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
            await inviteeProfile.save();
            return res.status(410).send('This invitation has expired.');
        }
        // Consume token now to make this invite single-use for both accept and deny paths.
        inviteeProfile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
        // Convert inviter id to string to keep membership comparisons consistent.
        const inviterUserId = String(invitation.invitedBy);
        // Role determines whether the invitee is allowed to accept.
        const inviteeUser = await User.findById(inviteeProfile.user).select('role');
        const canAcceptInvite = canAcceptJamCircleInvitation(inviteeUser?.role);

        if (action === 'accept') {
            // Role restriction branch: invitation is consumed but relationship is not created.
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

            // Maintain unique jam circle members using Set before converting back to array.
            const inviteeMembers = new Set((Array.isArray(inviteeProfile.jamCircleMembers) ? inviteeProfile.jamCircleMembers : []).map((id) => String(id)));
            inviteeMembers.add(inviterUserId);
            inviteeProfile.jamCircleMembers = [...inviteeMembers];

            // Mirror relationship on inviter profile so membership remains bidirectional.
            await Profile.findOneAndUpdate(
                { user: inviterUserId },
                { $addToSet: { jamCircleMembers: inviteeProfile.user } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
        }
        // Persist token consumption and any membership updates.
        await inviteeProfile.save();
        // Build confirmation page text based on final action result.
        const statusText = action === 'accept' ? 'accepted' : 'denied';
        const actionMessage = action === 'accept'
            ? 'Invitation accepted. This member is now in your Jam Circle.'
            : 'Invitation denied. No changes were made to your Jam Circle.';
        // HTML response is intentional because this endpoint is opened directly from email links.
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
 * respondToCircleInvitationInApp: Processes in-app jam circle invitation responses (authenticated).
 * 
 * Flow: (1) Extracts userId from verifyToken middleware and tokenHash, action from request body,
 * (2) Validates tokenHash exists and action is 'accept' or 'deny', (3) Fetches current user's profile and their User
 * document to check role permissions, (4) Finds matching pending invitation by tokenHash in profile.pendingCircleInvitations,
 * (5) Validates invitation exists and has not expired, (6) If role prohibits acceptance (e.g., admin), rejects with 403,
 * (7) If accepted, adds inviter to user's jamCircleMembers and user to inviter's jamCircleMembers (bidirectional),
 * (8) Removes invitation from pending list, saves profile, (9) Returns JSON response with success message.
 */
export const respondToCircleInvitationInApp = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // req.userId comes from verifyToken middleware; normalize to string for safe comparisons.
        const userId = String(req.userId || '');
        // tokenHash identifies the invitation record; action is expected to be "accept" or "deny".
        const { tokenHash, action } = req.body;

        // Reject malformed invitation payloads early.
        if (!tokenHash || typeof tokenHash !== 'string') {
            return res.status(400).json({ success: false, message: 'Invalid invitation token' });
        }

        // Limit actions to the two supported state transitions.
        if (action !== 'accept' && action !== 'deny') {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        // Load the receiver profile and role (role is needed to enforce accept rules).
        const profile = await Profile.findOne({ user: userId });
        const user = await User.findById(userId).select('role');
        // If the authenticated user has no profile, this endpoint cannot proceed.
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        // Admin role restrictions are handled by rolePermissions utility.
        const canAcceptInvite = canAcceptJamCircleInvitation(user?.role);
        // Normalize pending invitations to an array to avoid null/undefined edge cases.
        const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
            ? profile.pendingCircleInvitations
            : [];
        // Locate the exact invitation that matches the provided token hash.
        const invitation = pendingInvites.find((item) => item?.tokenHash === tokenHash);

        // If no matching token is found, the invitation is invalid or already used.
        if (!invitation) {
            return res.status(404).json({ success: false, message: 'Invitation not found' });
        }

        // Expired invitations are removed from pending list to keep data clean.
        if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
            profile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
            await profile.save();
            return res.status(410).json({ success: false, message: 'This invitation has expired' });
        }

        // Consume the invitation token once handled so it cannot be reused.
        profile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
        // invitedBy stores the inviter user id; normalize to string for Set operations.
        const inviterUserId = String(invitation.invitedBy);

        if (action === 'accept') {
            // Even with a valid token, some roles are not allowed to accept invites.
            if (!canAcceptInvite) {
                await profile.save();
                return res.status(403).json({ success: false, message: 'Admin accounts cannot accept Jam Circle invitations' });
            }

            // Build a de-duplicated set of current members, then add inviter.
            const myMembers = getIdSet(profile.jamCircleMembers);
            myMembers.add(inviterUserId);
            profile.jamCircleMembers = [...myMembers];

            // Mirror the relationship on inviter side to keep jam circle membership bidirectional.
            await Profile.findOneAndUpdate(
                { user: inviterUserId },
                { $addToSet: { jamCircleMembers: profile.user } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
        }

        // Persist pending invitation removal and any membership updates.
        await profile.save();

        // Return a user-friendly status message based on the chosen action.
        return res.status(200).json({
            success: true,
            message: action === 'accept' ? 'Invitation accepted' : 'Invitation denied',
        });
    } catch (error) {
        console.log('Error in respondToCircleInvitationInApp ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * getMyJamCircle: Retrieves the current user's complete jam circle with member details.
 * 
 * Flow: (1) Extracts userId from req.userId (set by verifyToken middleware), (2) Fetches current user's profile
 * using .lean() for performance (returns plain object, not Mongoose document), (3) Extracts jamCircleMembers array
 * (list of user ObjectIds), (4) If empty returns early with empty array, (5) Queries Profile collection for all matching
 * members and populates their User documents (firstName, lastName, role) with .lean() for efficiency,
 * (6) Builds a Map for O(1) lookups by userId, (7) Maps jamCircleMembers IDs to formatted payloads via
 * buildJamCircleMemberPayload, (8) Filters null values and returns array of circle members.
 */
export const getMyJamCircle = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // req.userId is injected by verifyToken middleware; cast to string for safe equality/Map lookups.
        const userId = String(req.userId || '');
        // Load the current user's profile only; .lean() returns plain JS object for faster read-only access.
        const profile = await Profile.findOne({ user: userId }).lean();
        // If profile does not exist, return an empty list so client can render an empty state gracefully.
        if (!profile) {
            return res.status(200).json({ success: true, members: [] });
        }
        // Extract member ids from jamCircleMembers; fallback to [] avoids runtime errors on undefined/null values.
        // Normalize each id to string so downstream comparisons and map keys are consistent.
        const memberIds = (Array.isArray(profile.jamCircleMembers) ? profile.jamCircleMembers : []).map((id) => String(id));
        // Early return when the user has no members in their jam circle.
        if (memberIds.length === 0) {
            return res.status(200).json({ success: true, members: [] });
        }
        // Fetch all member profiles in one query using $in for efficiency.
        // populate('user', ...) replaces user ObjectId with selected User fields needed for UI payload.
        // .lean() again improves performance because we only need to serialize data.
        const circleProfiles = await Profile.find({ user: { $in: memberIds } })
            .populate('user', 'firstName lastName role')
            .lean();

        // Build a lookup map keyed by user id for O(1) access when restoring original memberIds order.
        const byUserId = new Map(circleProfiles.map((item) => [String(item?.user?._id), item]));
        // Preserve the original jamCircleMembers order from profile while transforming each profile into API payload shape.
        // filter(Boolean) removes null/undefined entries in case a referenced profile was missing.
        const members = memberIds
            .map((id) => buildJamCircleMemberPayload(byUserId.get(id)))
            .filter(Boolean);
        // Return normalized member payloads ready for frontend rendering.
        return res.status(200).json({ success: true, members });
    } catch (error) {
        console.log('Error in getMyJamCircle ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * removeJamCircleMember: Removes a member from the current user's jam circle (bidirectional deletion).
 * 
 * Flow: (1) Validates memberId as valid MongoDB ObjectId using regex /^[a-f\d]{24}$/i, (2) Prevents self-removal
 * by comparing userId and memberId strings, (3) Fetches both user's profile and target member's profile in parallel
 * using Promise.all() for performance, (4) Filters out the target member from current user's jamCircleMembers array,
 * (5) Also removes current user from target member's jamCircleMembers (maintains bidirectional symmetry),
 * (6) Saves both modified profiles in parallel, (7) Returns success message.
 */
export const removeJamCircleMember = async (req, res) => {
    try {
        // req.userId is provided by verifyToken middleware; normalize to string for consistent comparisons.
        const userId = String(req.userId || '');
        // memberId comes from route param /profile/jam-circle/:memberId.
        const { memberId } = req.params;

        // Validate ObjectId format before any database query to fail fast on bad input.
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }
        // Prevent users from removing themselves from their own circle via this endpoint.
        if (userId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot remove yourself' });
        }
        // Load both profiles in parallel to reduce response latency.
        const [myProfile, memberProfile] = await Promise.all([
            Profile.findOne({ user: userId }),
            Profile.findOne({ user: memberId }),
        ]);
        // Both sides must exist because removal is a bidirectional relationship update.
        if (!myProfile || !memberProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }
        // Remove target member from current user's jamCircleMembers list.
        // Fallback to [] protects against null/undefined arrays.
        myProfile.jamCircleMembers = (Array.isArray(myProfile.jamCircleMembers) ? myProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== String(memberId));
        // Mirror removal on target member so both profiles stay in sync.
        memberProfile.jamCircleMembers = (Array.isArray(memberProfile.jamCircleMembers) ? memberProfile.jamCircleMembers : [])
            .filter((id) => String(id) !== userId);
        // Save both modified profiles concurrently.
        await Promise.all([myProfile.save(), memberProfile.save()]);
        // Return confirmation message after successful bidirectional removal.
        return res.status(200).json({
            success: true,
            message: 'Member removed from your Jam Circle',
        });
    } catch (error) {
        console.log('Error in removeJamCircleMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

