import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { clearCsrfSecretCookie } from '../utils/csrf.js';
import { isAdminRole } from '../utils/rolePermissions.js';
import { buildUserWithProfilePayload } from '../serializers/memberPayloads.serializer.js';
import { deleteAccountDataByUserId } from '../services/accountDeletion.service.js';
import {
    deleteAvatarAsset,
    isCloudinaryConfigured,
    uploadAvatarToCloudinary,
} from '../services/mediaStorage.service.js';
import { validateName } from '../validators/auth.validators.js';

/**
 * updateProfile: handles this function's core responsibility.
 */
export const updateProfile = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const requesterUserId = String(req.userId || '');
        const requesterUser = await User.findById(requesterUserId);
        if (!requesterUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isAdminUser = isAdminRole(requesterUser.role);
        const requestedMemberId = typeof req.params?.memberId === 'string' ? req.params.memberId.trim() : '';
        let targetUserId = requesterUserId;

        if (requestedMemberId) {
            if (!isAdminUser) {
                return res.status(403).json({ success: false, message: 'Only admins can edit another member profile' });
            }

            if (!/^[a-f\d]{24}$/i.test(requestedMemberId)) {
                return res.status(400).json({ success: false, message: 'Invalid member id' });
            }

            targetUserId = requestedMemberId;
        }

        const targetUser = String(targetUserId) === requesterUserId
            ? requesterUser
            : await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Target user not found' });
        }

        const isSelfUpdate = String(targetUserId) === requesterUserId;
        const shouldApplyAdminSelfProfileRestrictions = isAdminUser && isSelfUpdate;
        const {
            role,
            displayFirstName,
            displayLastName,
            bio,
            pronouns,
            phoneNumber,
            instagram,
            facebook,
            youtube,
            x,
            linkedin,
            website,
            profileTags,
            jamCircle,
            interests,
            activity,
            privacyMembers,
            privacyProfile,
            privacyContact,
            privacyActivity,
        } = req.body;

        /**
         * sanitizeTextField: handles this function's core responsibility.
         */
        const sanitizeTextField = (value, fieldName, maxLength) => {
            // Guard clauses and normalization keep request handling predictable.
            if (value === undefined) {
                return { isProvided: false };
            }

            if (typeof value !== 'string') {
                return { isProvided: true, error: `${fieldName} must be a string` };
            }

            const sanitizedValue = value.trim();
            if (sanitizedValue.length > maxLength) {
                return {
                    isProvided: true,
                    error: `${fieldName} must be less than or equal to ${maxLength} characters`,
                };
            }

            return { isProvided: true, value: sanitizedValue };
        };

        const validatedBio = sanitizeTextField(bio, 'Bio', 500);
        const validatedPronouns = sanitizeTextField(pronouns, 'Pronouns', 50);
        const validatedPhoneNumber = sanitizeTextField(phoneNumber, 'Phone number', 30);
        const validatedInstagram = sanitizeTextField(instagram, 'Instagram', 120);
        const validatedFacebook = sanitizeTextField(facebook, 'Facebook', 120);
        const validatedYouTube = sanitizeTextField(youtube ?? x, 'YouTube', 120);
        const validatedLinkedin = sanitizeTextField(linkedin, 'LinkedIn', 120);
        const validatedWebsite = sanitizeTextField(website, 'Website', 300);
        const validatedJamCircle = sanitizeTextField(jamCircle, 'Jam circle', 1000);
        const validatedInterests = sanitizeTextField(interests, 'Interests', 1000);
        const validatedActivity = sanitizeTextField(activity, 'Activity', 1000);

        /**
         * sanitizeDisplayName: handles this function's core responsibility.
         */
        const sanitizeDisplayName = (value, fieldName) => {
            // Guard clauses and normalization keep request handling predictable.
            if (value === undefined) {
                return { isProvided: false };
            }

            if (typeof value !== 'string') {
                return { isProvided: true, error: `${fieldName} must be a string` };
            }

            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return { isProvided: true, value: '' };
            }

            const validated = validateName(trimmed, fieldName);
            if (!validated.isValid) {
                return { isProvided: true, error: validated.error };
            }

            return { isProvided: true, value: validated.name };
        };

        const validatedDisplayFirstName = sanitizeDisplayName(displayFirstName, 'Display first name');
        const validatedDisplayLastName = sanitizeDisplayName(displayLastName, 'Display last name');

        /**
         * sanitizeRole: handles this function's core responsibility.
         */
        const sanitizeRole = (value) => {
            // Guard clauses and normalization keep request handling predictable.
            if (value === undefined) {
                return { isProvided: false };
            }

            if (typeof value !== 'string') {
                return { isProvided: true, error: 'Role must be a string' };
            }

            const normalizedRole = value.trim().toLowerCase();
            const allowedRoles = ['regular', 'organiser', 'admin'];
            if (!allowedRoles.includes(normalizedRole)) {
                return { isProvided: true, error: 'Role has an invalid value' };
            }

            return { isProvided: true, value: normalizedRole };
        };

        /**
         * sanitizeTags: handles this function's core responsibility.
         */
        const sanitizeTags = (value) => {
            // Guard clauses and normalization keep request handling predictable.
            if (value === undefined) {
                return { isProvided: false };
            }

            if (!Array.isArray(value)) {
                return { isProvided: true, error: 'Profile tags must be an array' };
            }

            if (value.length > 20) {
                return { isProvided: true, error: 'Profile tags cannot exceed 20 items' };
            }

            const normalized = [];
            for (const rawTag of value) {
                if (typeof rawTag !== 'string') {
                    return { isProvided: true, error: 'Each profile tag must be a string' };
                }
                const tag = rawTag.trim();
                if (!tag) {
                    continue;
                }
                if (tag.length > 40) {
                    return { isProvided: true, error: 'Each profile tag must be 40 characters or fewer' };
                }
                normalized.push(tag);
            }

            const uniqueTags = [...new Set(normalized)];
            return { isProvided: true, value: uniqueTags };
        };

        const privacyOptions = ['anyone', 'circle', 'mutual', 'nobody'];
        /**
         * sanitizePrivacy: handles this function's core responsibility.
         */
        const sanitizePrivacy = (value, fieldName) => {
            // Guard clauses and normalization keep request handling predictable.
            if (value === undefined) {
                return { isProvided: false };
            }

            if (typeof value !== 'string') {
                return { isProvided: true, error: `${fieldName} must be a string` };
            }

            if (!privacyOptions.includes(value)) {
                return { isProvided: true, error: `${fieldName} has an invalid value` };
            }

            return { isProvided: true, value };
        };

        const validatedProfileTags = sanitizeTags(profileTags);
        const validatedRole = sanitizeRole(role);
        const validatedPrivacyMembers = sanitizePrivacy(privacyMembers, 'privacyMembers');
        const validatedPrivacyProfile = sanitizePrivacy(privacyProfile, 'privacyProfile');
        const validatedPrivacyContact = sanitizePrivacy(privacyContact, 'privacyContact');
        const validatedPrivacyActivity = sanitizePrivacy(privacyActivity, 'privacyActivity');

        const validations = [
            validatedRole,
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
        ];
        const firstError = validations.find((validation) => validation.error);
        if (firstError) {
            return res.status(400).json({ success: false, message: firstError.error });
        }

        const currentRole = String(targetUser.role || '').trim().toLowerCase();
        const isRoleChangeRequested = validatedRole.isProvided && validatedRole.value !== currentRole;

        if (isRoleChangeRequested && !isAdminUser) {
            return res.status(403).json({ success: false, message: 'Only admins can update member roles' });
        }

        const updates = {};
        if (isRoleChangeRequested) targetUser.role = validatedRole.value;
        if (validatedDisplayFirstName.isProvided) updates.displayFirstName = validatedDisplayFirstName.value;
        if (validatedDisplayLastName.isProvided) updates.displayLastName = validatedDisplayLastName.value;
        if (validatedBio.isProvided) updates.bio = validatedBio.value;
        if (!shouldApplyAdminSelfProfileRestrictions && validatedPronouns.isProvided) updates.pronouns = validatedPronouns.value;
        if (validatedPhoneNumber.isProvided) updates.phoneNumber = validatedPhoneNumber.value;
        if (validatedInstagram.isProvided) updates.instagram = validatedInstagram.value;
        if (validatedFacebook.isProvided) updates.facebook = validatedFacebook.value;
        if (validatedYouTube.isProvided) updates.youtube = validatedYouTube.value;
        if (validatedLinkedin.isProvided) updates.linkedin = validatedLinkedin.value;
        if (validatedWebsite.isProvided) updates.website = validatedWebsite.value;
        if (!shouldApplyAdminSelfProfileRestrictions && validatedProfileTags.isProvided) updates.profileTags = validatedProfileTags.value;
        if (validatedJamCircle.isProvided) updates.jamCircle = validatedJamCircle.value;
        if (validatedInterests.isProvided) updates.interests = validatedInterests.value;
        if (validatedActivity.isProvided) updates.activity = validatedActivity.value;
        if (!shouldApplyAdminSelfProfileRestrictions && validatedPrivacyMembers.isProvided) updates.privacyMembers = validatedPrivacyMembers.value;
        if (!shouldApplyAdminSelfProfileRestrictions && validatedPrivacyProfile.isProvided) updates.privacyProfile = validatedPrivacyProfile.value;
        if (!shouldApplyAdminSelfProfileRestrictions && validatedPrivacyContact.isProvided) updates.privacyContact = validatedPrivacyContact.value;
        if (!shouldApplyAdminSelfProfileRestrictions && validatedPrivacyActivity.isProvided) updates.privacyActivity = validatedPrivacyActivity.value;

        if (Object.keys(updates).length === 0 && !isRoleChangeRequested) {
            return res.status(400).json({ success: false, message: 'No profile fields provided to update' });
        }

        if (isRoleChangeRequested) {
            await targetUser.save();
        }

        const updatedProfile = await Profile.findOneAndUpdate({ user: targetUserId }, updates, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
        });

        if (!updatedProfile) {
            return res.status(500).json({ success: false, message: 'Unable to update profile' });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: await buildUserWithProfilePayload(requesterUser),
            updatedMember: await buildUserWithProfilePayload(targetUser),
            updatedMemberRole: String(targetUser.role || '').trim().toLowerCase(),
        });
    } catch (error) {
        console.log('Error in updateProfile ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * uploadAvatar: handles this function's core responsibility.
 */
export const uploadAvatar = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = req.userId;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Avatar file is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const existingProfile = await Profile.findOne({ user: userId });
        const previousAvatarUrl = existingProfile?.avatarUrl ?? '';
        const previousAvatarStorageId = existingProfile?.avatarStorageId ?? '';

        let nextAvatarUrl = '';
        let nextAvatarStorageId = '';

        if (isCloudinaryConfigured) {
            const uploadedAvatar = await uploadAvatarToCloudinary({
                fileBuffer: req.file.buffer,
                mimeType: req.file.mimetype,
                userId,
            });
            nextAvatarUrl = uploadedAvatar.avatarUrl;
            nextAvatarStorageId = uploadedAvatar.avatarStorageId;
        } else {
            nextAvatarUrl = `/uploads/avatars/${req.file.filename}`;
        }

        const profile = await Profile.findOneAndUpdate(
            { user: userId },
            { avatarUrl: nextAvatarUrl, avatarStorageId: nextAvatarStorageId },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        if (!profile) {
            return res.status(500).json({ success: false, message: 'Unable to save avatar' });
        }

        if (previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
            await deleteAvatarAsset({
                avatarUrl: previousAvatarUrl,
                avatarStorageId: previousAvatarStorageId,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Avatar uploaded successfully',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        console.log('Error in uploadAvatar ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * removeAvatar: handles this function's core responsibility.
 */
export const removeAvatar = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const profile = await Profile.findOne({ user: userId });
        if (profile?.avatarUrl) {
            await deleteAvatarAsset({
                avatarUrl: profile.avatarUrl,
                avatarStorageId: profile.avatarStorageId,
            });
            profile.avatarUrl = '';
            profile.avatarStorageId = '';
            await profile.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Avatar removed successfully',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        console.log('Error in removeAvatar ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * deleteAccount: handles this function's core responsibility.
 */
export const deleteAccount = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const result = await deleteAccountDataByUserId(req.userId);
        if (!result.found) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
        });
        clearCsrfSecretCookie(res);

        return res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.log('Error in deleteAccount ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
