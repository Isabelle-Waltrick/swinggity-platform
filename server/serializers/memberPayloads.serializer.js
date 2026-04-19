import { Profile } from '../models/profile.model.js';
import { isAdminRole } from '../utils/rolePermissions.js';
import {
    canContactMember,
    canViewMemberActivity,
    canViewMemberProfile,
} from '../utils/memberPrivacy.utils.js';
import { normalizeSocialUrl } from '../utils/formatters.utils.js';

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
