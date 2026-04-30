// The code in this file were created with help of AI (Copilot)

import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { clearCsrfSecretCookie } from '../utils/csrf.js';
import { getBaseCookieOptions } from '../utils/cookieOptions.js';
import {
    canEditOwnProfile,
    isAdminRole,
} from '../utils/rolePermissions.js';
import { buildUserWithProfilePayload } from '../serializers/memberPayloads.serializer.js';
import { deleteUserAndRelatedDataByUserId } from '../services/accountDeletion.service.js';
import {
    deleteAvatarAsset,
    isCloudinaryConfigured,
    uploadAvatarToCloudinary,
} from '../services/mediaStorage.service.js';
import { validateProfileUpdatePayload } from '../validators/profile.validator.js';

/**
 * updateProfile:
 * Validates and applies profile updates for the authenticated user.
 * Supports partial updates, enforces field-level validation/sanitization,
 * restricts privileged role changes to admins, and returns refreshed user payloads.
 */
export const updateProfile = async (req, res) => {
    // This controller follows a "validate first, mutate last" approach.
    // Gather identity, authorize the target, sanitize all candidate inputs,
    // then apply only approved changes in a single DB update flow.
    try {
        const requesterUserId = String(req.userId || '');
        const requesterUser = await User.findById(requesterUserId);
        if (!requesterUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isAdminUser = isAdminRole(requesterUser.role);
        const requestedMemberId = typeof req.params?.memberId === 'string' ? req.params.memberId.trim() : '';

        // We accept a memberId route param for shared route compatibility,
        // but this endpoint still enforces self-edit only.
        if (requestedMemberId && !/^[a-f\d]{24}$/i.test(requestedMemberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        // SSR12: self-edit only authorization. Even if a target id is provided, the update is
        // denied unless requester and target are the same account.
        if (requestedMemberId && !canEditOwnProfile({ requesterUserId, targetUserId: requestedMemberId })) {
            return res.status(403).json({ success: false, message: 'Editing another member profile is not allowed' });
        }
        // For this controller, the target user is always the requester due to self-edit restrictions.
        const targetUser = requesterUser;

        // Admin self-profile restrictions are intentionally narrower than regular member editing.
        // This avoids admin-only accounts exposing member-facing fields that are not relevant
        // to their operating role in the platform.
        const shouldApplyAdminSelfProfileRestrictions = isAdminUser;

        // Validate and sanitize all incoming fields in one step, returning a structured result object.
        const validationResult = validateProfileUpdatePayload(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ success: false, message: validationResult.error });
        }
        // Destructure validated fields for easier reference and to enforce explicit mapping to profile keys.
        const {
            validatedDisplayFirstName,
            validatedDisplayLastName,
            validatedBio,
            validatedPronouns,
            validatedPhoneNumber,
            validatedInstagram,
            validatedFacebook,
            validatedYouTube,
            validatedLinkedin,
            validatedWebsite,
            validatedProfileTags,
            validatedJamCircle,
            validatedInterests,
            validatedActivity,
            validatedPrivacyMembers,
            validatedPrivacyProfile,
            validatedPrivacyContact,
            validatedPrivacyActivity,
        } = validationResult;

        const updates = {};
        // SSR13: explicit field allowlist for profile updates. Only keys declared in
        // updateFieldRules can be persisted; unknown payload keys are never written.
        // Build an explicit update object instead of spreading request body.
        // This is safer than trusting client payload keys and prevents accidental mass assignment.
        // Each rule maps one validated payload field to one Profile document key.
        // The optional restriction flag keeps admin self-profile guardrails explicit.
        // DATA EXAMPLE:  { profileKey: 'pronouns', validatedField: validatedPronouns, restrictForAdminSelf: true }
        const updateFieldRules = [
            { profileKey: 'displayFirstName', validatedField: validatedDisplayFirstName },
            { profileKey: 'displayLastName', validatedField: validatedDisplayLastName },
            { profileKey: 'bio', validatedField: validatedBio },
            { profileKey: 'pronouns', validatedField: validatedPronouns, restrictForAdminSelf: true },
            { profileKey: 'phoneNumber', validatedField: validatedPhoneNumber },
            { profileKey: 'instagram', validatedField: validatedInstagram },
            { profileKey: 'facebook', validatedField: validatedFacebook },
            { profileKey: 'youtube', validatedField: validatedYouTube },
            { profileKey: 'linkedin', validatedField: validatedLinkedin },
            { profileKey: 'website', validatedField: validatedWebsite },
            { profileKey: 'profileTags', validatedField: validatedProfileTags, restrictForAdminSelf: true },
            { profileKey: 'jamCircle', validatedField: validatedJamCircle },
            { profileKey: 'interests', validatedField: validatedInterests },
            { profileKey: 'activity', validatedField: validatedActivity },
            { profileKey: 'privacyMembers', validatedField: validatedPrivacyMembers, restrictForAdminSelf: true },
            { profileKey: 'privacyProfile', validatedField: validatedPrivacyProfile, restrictForAdminSelf: true },
            { profileKey: 'privacyContact', validatedField: validatedPrivacyContact, restrictForAdminSelf: true },
            { profileKey: 'privacyActivity', validatedField: validatedPrivacyActivity, restrictForAdminSelf: true },
        ];

        // Iterate over rules to construct the update object based on provided fields and restrictions.
        for (const rule of updateFieldRules) {
            // Skip member-facing fields when admin self restrictions apply.
            if (rule.restrictForAdminSelf && shouldApplyAdminSelfProfileRestrictions) {
                continue;
            }
            // PATCH semantics: only persist fields the client explicitly provided.
            if (rule.validatedField.isProvided) {
                updates[rule.profileKey] = rule.validatedField.value;
            }
        }
        // If no valid fields were provided, short-circuit to avoid unnecessary DB operations.
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No profile fields provided to update' });
        }

        // Apply updates in a single DB operation, returning the new document for response payload.
        const updatedProfile = await Profile.findOneAndUpdate({ user: requesterUserId }, updates, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
        });
        // A failure to get an updated profile at this point indicates a problem with the update operation itself.
        if (!updatedProfile) {
            return res.status(500).json({ success: false, message: 'Unable to update profile' });
        }
        // Return the updated profile along with the requester user payload for client-side state refresh.
        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            // Return both requester and target payloads.
            // This allows admins to change member's role
            user: await buildUserWithProfilePayload(requesterUser),
            updatedMember: await buildUserWithProfilePayload(targetUser),
            updatedMemberRole: String(targetUser.role || '').trim().toLowerCase(),
        });
        // catch block handles unexpected errors in the update flow, ensuring consistent error responses and logging for debugging.
    } catch (error) {
        console.log('Error in updateProfile ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * uploadAvatar:
 * Uploads a new avatar for the authenticated user, stores it in Cloudinary (or local fallback),
 * persists avatar URL/storage metadata to the profile, and deletes the previous avatar asset when replaced.
 */
export const uploadAvatar = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    // Viva note: this flow supports cloud storage and local fallback with one controller,
    // while still cleaning up previously stored avatar assets to avoid orphaned media.
    try {
        // The userId is required for both storage and profile operations, so we grab it early.
        const userId = req.userId;
        // Validate that a file was provided in the request.
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Avatar file is required' });
        }
        // Ensures the authenticated user still exists before continuing.
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Load current profile to compare against the new avatar values.
        const existingProfile = await Profile.findOne({ user: userId });
        // Keep the old avatar URL for post-update cleanup.
        const previousAvatarUrl = existingProfile?.avatarUrl ?? '';
        // Keep the old storage id so the previous asset can be deleted.
        const previousAvatarStorageId = existingProfile?.avatarStorageId ?? '';
        // Will hold the URL of the newly uploaded avatar.
        let nextAvatarUrl = '';
        // Will hold the storage provider id for the newly uploaded avatar.
        let nextAvatarStorageId = '';

        // Prefer Cloudinary when configured; otherwise write to local uploads.
        // The returned URL + storage id are persisted so future deletes are deterministic.
        if (isCloudinaryConfigured) {
            const uploadedAvatar = await uploadAvatarToCloudinary({
                fileBuffer: req.file.buffer, // The raw file buffer from Multer's memory storage.
                mimeType: req.file.mimetype, // The MIME type of the uploaded file, used for validation and storage handling.
                userId,
            });
            nextAvatarUrl = uploadedAvatar.avatarUrl;
            nextAvatarStorageId = uploadedAvatar.avatarStorageId;
        } else {
            nextAvatarUrl = `/uploads/avatars/${req.file.filename}`;
        }
        // Persist the new avatar URL and storage id to the user's profile document.
        const profile = await Profile.findOneAndUpdate(
            { user: userId },
            { avatarUrl: nextAvatarUrl, avatarStorageId: nextAvatarStorageId },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        // A failure to get a profile at this point indicates a problem with the update operation itself.
        if (!profile) {
            return res.status(500).json({ success: false, message: 'Unable to save avatar' });
        }

        // Post-update cleanup: if the avatar changed, delete the old asset to reduce storage bloat.
        // This is done after successful persistence so we never delete old media before new state exists.
        if (previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
            await deleteAvatarAsset({
                avatarUrl: previousAvatarUrl,
                avatarStorageId: previousAvatarStorageId,
            });
        }
        // Return the updated user payload so the client can refresh state with the new avatar URL.
        return res.status(200).json({
            success: true,
            message: 'Avatar uploaded successfully',
            user: await buildUserWithProfilePayload(user),
        });
        // catch block handles unexpected errors in the upload flow, ensuring consistent error responses and logging for debugging.
    } catch (error) {
        console.log('Error in uploadAvatar ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * removeAvatar:
 * Removes the authenticated user's avatar by deleting the backing media asset,
 * clearing avatar fields in the profile document, and returning the updated user payload.
 */
export const removeAvatar = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    // Removing an avatar clears both URL and storage id so profile state and storage state stay aligned.
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Load the profile to get current avatar metadata for deletion and clearing.
        const profile = await Profile.findOne({ user: userId });
        // We only touch storage/profile state when an avatar actually exists.
        if (profile?.avatarUrl) {
            await deleteAvatarAsset({
                avatarUrl: profile.avatarUrl,
                avatarStorageId: profile.avatarStorageId,
            });
            // Clear avatar fields in the profile document to reflect the removal.
            profile.avatarUrl = '';
            profile.avatarStorageId = '';
            await profile.save();
        }
        // Return the updated user payload so the client can refresh state and reflect the avatar removal.
        return res.status(200).json({
            success: true,
            message: 'Avatar removed successfully',
            user: await buildUserWithProfilePayload(user),
        });
        // catch block handles unexpected errors in the removal flow, ensuring consistent error responses and logging for debugging.
    } catch (error) {
        console.log('Error in removeAvatar ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * deleteAccount:
 * Permanently deletes the authenticated user's account/domain data,
 * then clears auth and CSRF cookies to terminate the active browser session safely.
 */
export const deleteAccount = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    // Account deletion has two responsibilities:
    // 1) remove domain data via a dedicated service,
    // 2) terminate browser session artifacts (auth + CSRF cookies).
    // SSR17 (partial): endpoint enforces deletion execution, but retention behavior depends
    // on the deletion service's immediate hard-delete strategy; no explicit retention window
    // or legal-hold policy is defined in code.
    try {
        // The deletion service returns a result object indicating whether the user was found and deleted.
        const result = await deleteUserAndRelatedDataByUserId(req.userId);
        if (!result.found) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Clear the auth token cookie to log the user out immediately after deletion.
        res.clearCookie('token', {
            ...getBaseCookieOptions(),
        });
        // Clear CSRF secret as well so no stale anti-CSRF context survives account deletion.
        clearCsrfSecretCookie(res);
        // Return a success response indicating the account was deleted and the session is terminated.
        return res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.log('Error in deleteAccount ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
