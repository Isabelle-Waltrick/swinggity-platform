// The code in this file were created with help of AI (Copilot)

import { Profile } from '../models/profile.model.js';
import { isAdminRole } from '../utils/rolePermissions.js';
import {
    canContactMember,
    canViewMemberActivity,
    canViewMemberProfile,
} from '../utils/memberPrivacy.utils.js';
import { normalizeSocialUrl } from '../utils/formatters.utils.js';

/**
 * buildPublicMemberPayload:
 * Builds the public-facing member payload, applying privacy rules to decide
 * which profile, activity, contact, and role fields the current viewer can see.
 */
export const buildPublicMemberPayload = (profile, viewerProfile = null, viewerUserId = '', viewerRole = '') => {
    // normalizeText: trims string values and converts missing or non-string inputs into an empty string for consistent output.
    const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
    const firstName = normalizeText(profile?.displayFirstName) || normalizeText(profile?.user?.firstName);
    const lastName = normalizeText(profile?.displayLastName) || normalizeText(profile?.user?.lastName);

    // The targetUserId is derived from the profile's user reference, which may be an object or a direct ID, and is used for privacy checks against the viewer's identity and role.
    const targetUserId = String(profile?.user?._id || profile?.user || '');

    // canViewRole is true if the viewer has an admin role or is viewing their own profile, allowing them to see the role field regardless of privacy settings.
    const canViewRole = isAdminRole(viewerRole) || String(viewerUserId || '') === targetUserId;

    // SSR21: canViewProfile/canViewActivity/canContact enforce which profile fields each
    // viewer is allowed to see, based on privacy settings + relationship/role context.
    // canViewProfile, canViewActivity, and canContact are determined by the viewer's relationship to the target member and the member's privacy settings, controlling access to profile details, activity feed, and contact options.
    const canViewProfile = canViewMemberProfile(viewerProfile, profile, viewerUserId, targetUserId, viewerRole);
    const canViewActivity = canViewProfile && canViewMemberActivity(viewerProfile, profile, viewerUserId, targetUserId, viewerRole);
    const canContact = canContactMember(viewerProfile, profile, viewerUserId, targetUserId, viewerRole);

    // profileTags are normalized and included in the payload only if the viewer has permission to view the profile.
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
    // SSR22 (partial): unauthorized field values are blanked/withheld, but response shape
    // still includes many keys regardless of visibility; this is privacy-safe yet not the
    // most minimal per-view payload contract possible.
    // The returned payload includes only the fields the viewer is allowed to see based on privacy settings and their relationship to the target member.
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

/**
 * parseParticipantsToTags:
 * Splits a free-text participant list into a cleaned, capped array of tag labels.
 */
const parseParticipantsToTags = (participants) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalized = typeof participants === 'string' ? participants.trim() : '';
    if (!normalized) return [];

    return normalized
        .split(/[,;\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20);
};

/**
 * parseParticipantContactsToTags:
 * Extracts display names from participant contact entries and formats them as tags.
 */
const parseParticipantContactsToTags = (participantContacts) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!Array.isArray(participantContacts)) return [];

    return participantContacts
        .map((entry) => (typeof entry?.displayName === 'string' ? entry.displayName.trim() : ''))
        .filter(Boolean)
        .slice(0, 20);
};

/**
 * buildPublicOrganisationPayload:
 * Builds the public-facing organisation payload, including normalized links,
 * owner/contact information, and participant tags for discovery and profile views.
 */
export const buildPublicOrganisationPayload = (organisation, viewerUserId = '', ownerProfile = null) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!organisation) return null;

    /**
     * normalise:
     * Trims string values and converts missing or non-string inputs into an empty string.
     */
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

/**
 * buildJamCircleMemberPayload:
 * Maps a profile into the compact member shape used when listing jam circle members.
 */
export const buildJamCircleMemberPayload = (profile) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!profile?.user) return null;

    /**
     * firstName: handles this function's core responsibility.
     */
    const firstName = (profile.displayFirstName || profile.user.firstName || '').trim();
    /**
     * lastName: handles this function's core responsibility.
     */
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

/**
 * getJamCircleMembersPayload:
 * Loads jam circle profiles for the given ids and returns them in the original input order.
 */
export const getJamCircleMembersPayload = async (memberIds) => {
    // Guard clauses and normalization keep request handling predictable.
    /**
     * normalizedIds: handles this function's core responsibility.
     */
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

/**
 * buildUserWithProfilePayload:
 * Combines a user document with its profile data, backfills missing display names,
 * and expands jam circle and blocked member ids into serialized member payloads.
 */
export const buildUserWithProfilePayload = async (user) => {
    // Guard clauses and normalization keep request handling predictable.
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
        youtube: profile?.youtube ?? '',
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
