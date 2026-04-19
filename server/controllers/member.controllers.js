import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { Organisation } from '../models/organisation.model.js';
import {
    buildPublicMemberPayload,
    buildPublicOrganisationPayload,
    getJamCircleMembersPayload,
} from '../serializers/memberPayloads.serializer.js';
import {
    canViewMemberInDiscovery,
    canViewMemberProfile,
    getIdSet,
    hasBlockingRelationship,
} from '../utils/memberPrivacy.utils.js';
import { normalizeSocialUrl } from '../utils/formatters.utils.js';
import { isAdminRole } from '../utils/rolePermissions.js';

/**
 * getMembersDiscovery: handles this function's core responsibility.
 */
export const getMembersDiscovery = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const currentUserId = String(req.userId || '');
        const [currentUser, currentUserProfile] = await Promise.all([
            User.findById(currentUserId).select('role').lean(),
            Profile.findOne({ user: currentUserId }).lean(),
        ]);
        const currentUserRole = String(currentUser?.role || '');
        const currentCircleSet = new Set(
            (Array.isArray(currentUserProfile?.jamCircleMembers) ? currentUserProfile.jamCircleMembers : [])
                .map((id) => String(id))
        );
        const currentBlockedSet = getIdSet(currentUserProfile?.blockedMembers);

        const profiles = await Profile.find({})
            .populate('user', 'firstName lastName role')
            .lean();

        const members = profiles
            .filter((profile) => profile?.user)
            .filter((profile) => !isAdminRole(profile?.user?.role))
            .filter((profile) => {
                const memberUserId = String(profile.user._id);
                if (memberUserId === currentUserId) return true;

                if (!canViewMemberInDiscovery(currentUserProfile, profile, currentUserId, memberUserId, currentUserRole)) {
                    return false;
                }

                const memberBlockedSet = getIdSet(profile?.blockedMembers);
                const isBlockedEitherDirection = currentBlockedSet.has(memberUserId) || memberBlockedSet.has(currentUserId);
                return !isBlockedEitherDirection;
            })
            .map((profile) => {
                const memberUserId = String(profile.user._id);
                const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
                    ? profile.pendingCircleInvitations
                    : [];
                const hasPendingInviteFromCurrentUser = pendingInvites.some((invite) => String(invite?.invitedBy || '') === currentUserId);
                const isCurrentUser = memberUserId === currentUserId;
                const isInJamCircle = currentCircleSet.has(memberUserId);

                return {
                    ...buildPublicMemberPayload(profile, currentUserProfile, currentUserId, currentUserRole),
                    isCurrentUser,
                    isInJamCircle,
                    hasPendingInviteFromCurrentUser,
                };
            });

        const organisations = await Organisation.find({
            $or: [
                { organisationName: { $exists: true, $ne: '' } },
                { bio: { $exists: true, $ne: '' } },
                { imageUrl: { $exists: true, $ne: '' } },
            ],
        }).lean();

        const organisationOwnerIds = organisations
            .map((organisation) => String(organisation?.user || ''))
            .filter(Boolean);
        const ownerProfiles = await Profile.find({ user: { $in: organisationOwnerIds } }).lean();
        const ownerProfilesByUserId = new Map(ownerProfiles.map((profile) => [String(profile?.user || ''), profile]));

        const organisationEntries = organisations
            .filter((organisation) => {
                const ownerUserId = String(organisation?.user || '');
                if (!ownerUserId) return false;
                const ownerProfile = ownerProfilesByUserId.get(ownerUserId);
                if (!ownerProfile) return true;

                const ownerBlockedSet = getIdSet(ownerProfile?.blockedMembers);
                const isBlockedEitherDirection = currentBlockedSet.has(ownerUserId) || ownerBlockedSet.has(currentUserId);
                return !isBlockedEitherDirection;
            })
            .map((organisation) => ({
                ...buildPublicOrganisationPayload(
                    organisation,
                    currentUserId,
                    ownerProfilesByUserId.get(String(organisation?.user || '')) || null
                ),
                isInJamCircle: currentCircleSet.has(String(organisation?.user || '')),
                hasPendingInviteFromCurrentUser: false,
            }));

        return res.status(200).json({
            success: true,
            members: [...members, ...organisationEntries],
        });
    } catch (error) {
        console.log('Error in getMembersDiscovery ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * getMemberPublicProfile: handles this function's core responsibility.
 */
export const getMemberPublicProfile = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const viewerUserId = String(req.userId || '');
        const { memberId } = req.params;
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        const [viewerUser, viewerProfile] = await Promise.all([
            User.findById(viewerUserId).select('role').lean(),
            Profile.findOne({ user: viewerUserId }).lean(),
        ]);
        const viewerRole = String(viewerUser?.role || '');
        const profile = await Profile.findOne({ user: memberId })
            .populate('user', 'firstName lastName role')
            .lean();

        if (profile?.user) {
            if (hasBlockingRelationship(viewerProfile, profile, viewerUserId, memberId)) {
                return res.status(403).json({ success: false, code: 'ACCESS_DENIED', message: 'Access denied' });
            }

            const canViewProfile = canViewMemberProfile(viewerProfile, profile, viewerUserId, memberId, viewerRole);
            const jamCircleMembers = canViewProfile
                ? await getJamCircleMembersPayload(profile.jamCircleMembers)
                : [];
            return res.status(200).json({
                success: true,
                member: {
                    ...buildPublicMemberPayload(profile, viewerProfile, viewerUserId, viewerRole),
                    jamCircleMembers,
                    isCurrentUser: String(memberId) === viewerUserId,
                },
            });
        }

        const organisation = await Organisation.findById(memberId).lean();
        if (!organisation) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        const ownerUserId = String(organisation.user || '');
        const ownerProfile = ownerUserId ? await Profile.findOne({ user: ownerUserId }).lean() : null;
        if (ownerProfile && hasBlockingRelationship(viewerProfile, ownerProfile, viewerUserId, ownerUserId)) {
            return res.status(403).json({ success: false, code: 'ACCESS_DENIED', message: 'Access denied' });
        }

        return res.status(200).json({
            success: true,
            member: {
                ...buildPublicOrganisationPayload(organisation, viewerUserId, ownerProfile),
                jamCircleMembers: [],
                activityFeed: [],
            },
        });
    } catch (error) {
        console.log('Error in getMemberPublicProfile ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * redirectMemberSocialLink: handles this function's core responsibility.
 */
export const redirectMemberSocialLink = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const viewerUserId = String(req.userId || '');
        const { memberId, platform } = req.params;
        const supportedPlatforms = ['instagram', 'facebook', 'youtube', 'linkedin', 'website'];

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (!supportedPlatforms.includes(platform)) {
            return res.status(400).json({ success: false, message: 'Invalid social platform' });
        }

        const [viewerUser, viewerProfile, profile] = await Promise.all([
            User.findById(viewerUserId).select('role').lean(),
            Profile.findOne({ user: viewerUserId }).lean(),
            Profile.findOne({ user: memberId }).lean(),
        ]);
        const viewerRole = String(viewerUser?.role || '');

        if (canViewMemberProfile(viewerProfile, profile, viewerUserId, memberId, viewerRole)) {
            if (hasBlockingRelationship(viewerProfile, profile, viewerUserId, memberId)) {
                return res.status(404).json({ success: false, message: 'Member not available' });
            }

            const memberLink = normalizeSocialUrl(profile[platform]);
            if (!memberLink) {
                return res.status(404).json({ success: false, message: 'Social link not found' });
            }

            return res.redirect(memberLink);
        }

        const organisation = await Organisation.findById(memberId).lean();
        if (!organisation) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        const ownerUserId = String(organisation.user || '');
        const ownerProfile = ownerUserId ? await Profile.findOne({ user: ownerUserId }).lean() : null;
        if (ownerProfile && hasBlockingRelationship(viewerProfile, ownerProfile, viewerUserId, ownerUserId)) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        const organisationLink = normalizeSocialUrl(organisation[platform]);
        if (!organisationLink) {
            return res.status(404).json({ success: false, message: 'Social link not found' });
        }

        return res.redirect(organisationLink);
    } catch (error) {
        console.log('Error in redirectMemberSocialLink ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
