import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { Organisation } from '../models/organisation.model.js';
import { CalendarEvent } from '../models/calendarEvent.model.js';
import { isAdminRole } from '../utils/rolePermissions.js';

export const validatePassword = (password) => {
    const errors = [];

    if (typeof password !== 'string') {
        errors.push('Password must be a string');
        return {
            isValid: false,
            errors,
        };
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

export const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!email || typeof email !== 'string') {
        return { isValid: false, error: 'Email is required' };
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail.length === 0) {
        return { isValid: false, error: 'Email is required' };
    }

    if (trimmedEmail.length > 254) {
        return { isValid: false, error: 'Email address is too long' };
    }

    if (!emailRegex.test(trimmedEmail)) {
        return { isValid: false, error: 'Please enter a valid email address' };
    }

    return { isValid: true, email: trimmedEmail };
};

export const validateName = (name, fieldName) => {
    if (!name || typeof name !== 'string') {
        return { isValid: false, error: `${fieldName} is required` };
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
        return { isValid: false, error: `${fieldName} is required` };
    }

    if (trimmedName.length < 2) {
        return { isValid: false, error: `${fieldName} must be at least 2 characters long` };
    }

    if (trimmedName.length > 50) {
        return { isValid: false, error: `${fieldName} must be less than 50 characters` };
    }

    if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
        return { isValid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
    }

    return { isValid: true, name: trimmedName };
};

export const normalizeSocialUrl = (value) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';

    const prefixed = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/\//, '')}`;
    try {
        const parsed = new URL(prefixed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
};

export const CONTACT_MESSAGE_MAX_WORDS = 200;
export const ADMIN_FEEDBACK_MAX_WORDS = 200;
export const PROFILE_REPORT_DETAILS_MAX_LENGTH = 1500;
export const PROFILE_REPORT_ALLOWED_REASONS = new Set([
    'Fake account',
    'Impersonation',
    'Harassment or bullying',
    'Hate speech or abusive content',
    'Spam or scam',
    'Inappropriate profile content',
    'Suspicious or misleading activity',
    'Underage user',
    'Other',
]);

export const countWords = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return 0;
    return normalized.split(/\s+/).filter(Boolean).length;
};

export const parseBooleanField = (value) => value === true || value === 'true' || value === 1 || value === '1';

export const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const getIdSet = (values) => new Set(
    (Array.isArray(values) ? values : []).map((value) => String(value))
);

export const canContactMember = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    if (isAdminRole(viewerRole)) return true;

    const privacy = typeof targetProfile?.privacyContact === 'string' ? targetProfile.privacyContact : 'anyone';
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;

    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');

    if (privacy === 'circle') {
        return viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);
    }

    if (privacy === 'mutual') {
        for (const memberId of viewerCircleSet) {
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }

    return false;
};

export const canViewMemberProfile = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    if (isAdminRole(viewerRole)) return true;

    const privacy = typeof targetProfile?.privacyProfile === 'string' ? targetProfile.privacyProfile : 'anyone';
    if (String(viewerUserId || '') === String(targetUserId || '')) return true;
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;

    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');
    const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

    if (privacy === 'circle') {
        return directConnection;
    }

    if (privacy === 'mutual') {
        if (directConnection) return true;

        for (const memberId of viewerCircleSet) {
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }

    return false;
};

export const canViewMemberInDiscovery = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    if (isAdminRole(viewerRole)) return true;

    const privacy = typeof targetProfile?.privacyMembers === 'string' ? targetProfile.privacyMembers : 'anyone';
    if (String(viewerUserId || '') === String(targetUserId || '')) return true;
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;

    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');
    const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

    if (privacy === 'circle') {
        return directConnection;
    }

    if (privacy === 'mutual') {
        if (directConnection) return true;

        for (const memberId of viewerCircleSet) {
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }

    return false;
};

export const canViewMemberActivity = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    if (isAdminRole(viewerRole)) return true;

    const privacy = typeof targetProfile?.privacyActivity === 'string' ? targetProfile.privacyActivity : 'anyone';
    if (String(viewerUserId || '') === String(targetUserId || '')) return true;
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;

    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');
    const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

    if (privacy === 'circle') {
        return directConnection;
    }

    if (privacy === 'mutual') {
        if (directConnection) return true;

        for (const memberId of viewerCircleSet) {
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }

    return false;
};

export const buildPublicMemberPayload = (profile, viewerProfile = null, viewerUserId = '', viewerRole = '') => {
    const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
    const firstName = normalizeText(profile?.displayFirstName) || normalizeText(profile?.user?.firstName);
    const lastName = normalizeText(profile?.displayLastName) || normalizeText(profile?.user?.lastName);
    const targetUserId = String(profile?.user?._id || profile?.user || '');
    const canViewRole = isAdminRole(viewerRole) || String(viewerUserId || '') === targetUserId;
    const canViewProfile = canViewMemberProfile(viewerProfile, profile, viewerUserId, targetUserId, viewerRole);
    const canViewActivity = canViewProfile && canViewMemberActivity(viewerProfile, profile, viewerUserId, targetUserId, viewerRole);
    const canContact = canContactMember(viewerProfile, profile, viewerUserId, targetUserId, viewerRole);
    const profileTags = Array.isArray(profile?.profileTags)
        ? profile.profileTags
            .map((tag) => normalizeText(tag))
            .filter(Boolean)
        : [];
    const onlineLinks = {
        instagram: normalizeSocialUrl(profile?.instagram),
        facebook: normalizeSocialUrl(profile?.facebook),
        youtube: normalizeSocialUrl(profile?.youtube),
        linkedin: normalizeSocialUrl(profile?.linkedin),
        website: normalizeSocialUrl(profile?.website),
    };

    return {
        userId: profile?.user?._id,
        entityType: 'member',
        role: canViewRole ? normalizeText(profile?.user?.role).toLowerCase() : '',
        displayFirstName: firstName,
        displayLastName: lastName,
        avatarUrl: normalizeText(profile?.avatarUrl),
        pronouns: normalizeText(profile?.pronouns),
        bio: canViewProfile ? normalizeText(profile?.bio) : '',
        tags: canViewProfile ? profileTags : [],
        jamCircle: normalizeText(profile?.jamCircle),
        activity: canViewActivity ? normalizeText(profile?.activity) : '',
        activityFeed: canViewActivity && Array.isArray(profile?.activityFeed) ? profile.activityFeed : [],
        showOnlineLinks: canViewProfile,
        onlineLinks: canViewProfile ? onlineLinks : {
            instagram: '',
            facebook: '',
            youtube: '',
            linkedin: '',
            website: '',
        },
        canViewProfile,
        privacyProfile: profile?.privacyProfile ?? 'anyone',
        canContact: String(viewerUserId || '') === String(targetUserId || '') ? false : canContact,
    };
};

const parseParticipantsToTags = (participants) => {
    const normalized = typeof participants === 'string' ? participants.trim() : '';
    if (!normalized) return [];

    return normalized
        .split(/[,;\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20);
};

const parseParticipantContactsToTags = (participantContacts) => {
    if (!Array.isArray(participantContacts)) return [];

    return participantContacts
        .map((entry) => (typeof entry?.displayName === 'string' ? entry.displayName.trim() : ''))
        .filter(Boolean)
        .slice(0, 20);
};

export const buildPublicOrganisationPayload = (organisation, viewerUserId = '', ownerProfile = null) => {
    if (!organisation) return null;

    const normalise = (value) => (typeof value === 'string' ? value.trim() : '');
    const displayName = normalise(organisation.organisationName) || 'Swinggity Organisation';
    const onlineLinks = {
        instagram: normalizeSocialUrl(organisation.instagram),
        facebook: normalizeSocialUrl(organisation.facebook),
        youtube: normalizeSocialUrl(organisation.youtube),
        linkedin: normalizeSocialUrl(organisation.linkedin),
        website: normalizeSocialUrl(organisation.website),
    };

    const ownerDisplayName = `${normalise(ownerProfile?.displayFirstName)} ${normalise(ownerProfile?.displayLastName)}`.trim() || 'Main contact';
    const ownerAvatarUrl = normalise(ownerProfile?.avatarUrl);

    const participantContacts = Array.isArray(organisation.participantContacts)
        ? organisation.participantContacts.map((entry) => ({
            userId: normalise(String(entry?.user || entry?.userId || '')),
            entityType: entry?.entityType === 'organisation' ? 'organisation' : 'member',
            organisationId: normalise(String(entry?.organisationId || '')),
            displayName: normalise(entry?.displayName || ''),
            avatarUrl: normalise(entry?.avatarUrl || ''),
        }))
        : [];

    const ownerParticipant = {
        userId: normalise(String(organisation?.user || '')),
        entityType: 'member',
        organisationId: '',
        displayName: ownerDisplayName,
        avatarUrl: ownerAvatarUrl,
    };

    const participantContactsWithOwner = [ownerParticipant, ...participantContacts]
        .filter((entry) => entry.userId && entry.displayName)
        .filter((entry, index, allEntries) => {
            const key = `${entry.userId}|${entry.entityType}|${entry.organisationId}`;
            return allEntries.findIndex((candidate) => `${candidate.userId}|${candidate.entityType}|${candidate.organisationId}` === key) === index;
        });

    return {
        userId: organisation?._id,
        entityType: 'organisation',
        organisationId: organisation?._id,
        organisationOwnerUserId: organisation?.user,
        displayFirstName: displayName,
        displayLastName: '',
        avatarUrl: normalise(organisation.imageUrl),
        pronouns: '',
        bio: normalise(organisation.bio),
        tags: parseParticipantContactsToTags(participantContactsWithOwner).length > 0
            ? parseParticipantContactsToTags(participantContactsWithOwner)
            : parseParticipantsToTags(organisation.participants),
        participantContacts: participantContactsWithOwner,
        jamCircle: '',
        activity: '',
        activityFeed: [],
        showOnlineLinks: true,
        onlineLinks,
        isCurrentUser: String(organisation?.user || '') === String(viewerUserId || ''),
    };
};

export const resolveAbsoluteAssetUrl = (req, rawUrl) => {
    const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${req.protocol}://${req.get('host')}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
};

export const buildJamCircleMemberPayload = (profile) => {
    if (!profile?.user) return null;

    const firstName = (profile.displayFirstName || profile.user.firstName || '').trim();
    const lastName = (profile.displayLastName || profile.user.lastName || '').trim();
    return {
        userId: profile.user._id,
        role: String(profile.user.role || '').trim().toLowerCase(),
        displayFirstName: firstName,
        displayLastName: lastName,
        fullName: `${firstName} ${lastName}`.trim() || 'Swinggity Member',
        avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '',
    };
};

export const hasBlockingRelationship = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
    const viewerBlockedSet = getIdSet(viewerProfile?.blockedMembers);
    const targetBlockedSet = getIdSet(targetProfile?.blockedMembers);
    return viewerBlockedSet.has(String(targetUserId || '')) || targetBlockedSet.has(String(viewerUserId || ''));
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';
export const isCloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);

if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: cloudinaryCloudName,
        api_key: cloudinaryApiKey,
        api_secret: cloudinaryApiSecret,
        secure: true,
    });
}

const getAvatarCloudPublicId = (userId) => `avatar-${String(userId || 'unknown')}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

export const uploadAvatarToCloudinary = async ({ fileBuffer, mimeType, userId }) => {
    if (!isCloudinaryConfigured) {
        throw new Error('Cloudinary is not configured');
    }

    const publicId = getAvatarCloudPublicId(userId);
    const payload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                resource_type: 'image',
                overwrite: true,
                invalidate: true,
                folder: 'swinggity/avatars',
                format: (mimeType || '').includes('png') ? 'png' : undefined,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error('Cloud avatar upload failed'));
                    return;
                }
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });

    return {
        avatarUrl: payload.secure_url,
        avatarStorageId: payload.public_id,
    };
};

const deleteCloudinaryAvatar = async (avatarStorageId) => {
    if (!isCloudinaryConfigured || !avatarStorageId) return;

    await cloudinary.uploader.destroy(avatarStorageId, {
        resource_type: 'image',
        invalidate: true,
    }).catch(() => undefined);
};

const deleteCloudinaryEventImage = async (imageStorageId) => {
    if (!isCloudinaryConfigured || !imageStorageId) return;

    await cloudinary.uploader.destroy(imageStorageId, {
        resource_type: 'image',
        invalidate: true,
    }).catch(() => undefined);
};

export const getJamCircleMembersPayload = async (memberIds) => {
    const normalizedIds = (Array.isArray(memberIds) ? memberIds : []).map((id) => String(id));
    if (normalizedIds.length === 0) return [];

    const circleProfiles = await Profile.find({ user: { $in: normalizedIds } })
        .populate('user', 'firstName lastName role')
        .lean();

    const byUserId = new Map(circleProfiles.map((item) => [String(item?.user?._id), item]));
    return normalizedIds
        .map((id) => buildJamCircleMemberPayload(byUserId.get(id)))
        .filter(Boolean);
};

export const buildUserWithProfilePayload = async (user) => {
    if (!user) return null;

    const profile = await Profile.findOne({ user: user._id });
    const resolvedDisplayFirstName = profile?.displayFirstName?.trim() || user.firstName;
    const resolvedDisplayLastName = profile?.displayLastName?.trim() || user.lastName;

    if (profile && (!profile.displayFirstName?.trim() || !profile.displayLastName?.trim())) {
        profile.displayFirstName = resolvedDisplayFirstName;
        profile.displayLastName = resolvedDisplayLastName;
        await profile.save();
    }

    const jamCircleMemberIds = Array.isArray(profile?.jamCircleMembers)
        ? profile.jamCircleMembers.map((id) => String(id))
        : [];
    const blockedMemberIds = Array.isArray(profile?.blockedMembers)
        ? profile.blockedMembers.map((id) => String(id))
        : [];

    const jamCircleMembers = await getJamCircleMembersPayload(jamCircleMemberIds);
    const blockedMembers = await getJamCircleMembersPayload(blockedMemberIds);

    return {
        ...user._doc,
        password: undefined,
        displayFirstName: resolvedDisplayFirstName,
        displayLastName: resolvedDisplayLastName,
        avatarUrl: profile?.avatarUrl ?? '',
        bio: profile?.bio ?? '',
        pronouns: profile?.pronouns ?? '',
        contactEmail: user.email ?? '',
        phoneNumber: profile?.phoneNumber ?? '',
        instagram: profile?.instagram ?? '',
        facebook: profile?.facebook ?? '',
        youtube: profile?.youtube ?? profile?.x ?? '',
        linkedin: profile?.linkedin ?? '',
        website: profile?.website ?? '',
        profileTags: profile?.profileTags ?? [],
        jamCircle: profile?.jamCircle ?? '',
        jamCircleMembers,
        blockedMembers,
        interests: profile?.interests ?? '',
        activity: profile?.activity ?? '',
        activityFeed: Array.isArray(profile?.activityFeed) ? profile.activityFeed : [],
        privacyMembers: profile?.privacyMembers ?? 'anyone',
        privacyProfile: profile?.privacyProfile ?? 'anyone',
        privacyContact: profile?.privacyContact ?? 'anyone',
        privacyActivity: profile?.privacyActivity ?? 'anyone',
    };
};

const deleteAvatarFileIfLocal = async (avatarUrl) => {
    if (!avatarUrl || (!avatarUrl.startsWith('/uploads/avatars/') && !avatarUrl.startsWith('/uploads/events/'))) {
        return;
    }

    const absoluteAvatarPath = path.join(__dirname, '..', avatarUrl.replace(/^\//, '').replace(/\//g, path.sep));
    await fs.unlink(absoluteAvatarPath).catch(() => undefined);
};

export const deleteAvatarAsset = async ({ avatarUrl, avatarStorageId }) => {
    if (avatarStorageId) {
        await deleteCloudinaryAvatar(avatarStorageId);
        return;
    }

    await deleteAvatarFileIfLocal(avatarUrl);
};

const deleteEventAsset = async ({ imageUrl, imageStorageId }) => {
    if (imageStorageId) {
        await deleteCloudinaryEventImage(imageStorageId);
        return;
    }

    await deleteAvatarFileIfLocal(imageUrl);
};

export const deleteAccountDataByUserId = async (rawUserId) => {
    const userId = String(rawUserId || '');
    const [user, profile, organisation, ownedEvents] = await Promise.all([
        User.findById(userId),
        Profile.findOne({ user: userId }),
        Organisation.findOne({ user: userId }),
        CalendarEvent.find({ createdBy: userId }).select('imageUrl imageStorageId').lean(),
    ]);

    if (!user) return { found: false };

    const cleanupTasks = [];

    if (profile) {
        cleanupTasks.push(deleteAvatarAsset({
            avatarUrl: profile.avatarUrl,
            avatarStorageId: profile.avatarStorageId,
        }));
    }

    if (organisation) {
        cleanupTasks.push(deleteAvatarAsset({
            avatarUrl: organisation.imageUrl,
            avatarStorageId: organisation.imageStorageId,
        }));
    }

    for (const event of ownedEvents) {
        cleanupTasks.push(deleteEventAsset({
            imageUrl: event.imageUrl,
            imageStorageId: event.imageStorageId,
        }));
    }

    await Promise.all(cleanupTasks);

    if (organisation) {
        await Organisation.deleteOne({ _id: organisation._id });
        await Profile.updateMany(
            { 'pendingOrganisationInvitations.organisationId': organisation._id },
            {
                $pull: {
                    pendingOrganisationInvitations: {
                        organisationId: organisation._id,
                    },
                },
            }
        );
    }

    await Promise.all([
        Profile.updateMany({ jamCircleMembers: userId }, { $pull: { jamCircleMembers: userId } }),
        Profile.updateMany({ blockedMembers: userId }, { $pull: { blockedMembers: userId } }),
        Profile.updateMany({ 'pendingCircleInvitations.invitedBy': userId }, { $pull: { pendingCircleInvitations: { invitedBy: userId } } }),
    ]);

    await Promise.all([
        CalendarEvent.deleteMany({ createdBy: userId }),
        Profile.deleteOne({ user: userId }),
        User.deleteOne({ _id: userId }),
    ]);

    return { found: true };
};
