// The code in this file were created with help of AI (Copilot)

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
 * getMembersDiscovery:
 * Builds the discovery list for the current user by combining visible members
 * and organisations, then removing blocked relationships and adding viewer-aware flags.
 */
export const getMembersDiscovery = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Normalize current user id from auth context.
        const currentUserId = String(req.userId || '');

        // Run both DB reads in parallel with Promise.all to reduce total wait time.
        // await pauses this async function until both promises resolve.
        // select('role') fetches only the role field from User.
        // lean() returns plain JS objects (faster for read-only controller logic).
        const [currentUser, currentUserProfile] = await Promise.all([
            User.findById(currentUserId).select('role').lean(),
            Profile.findOne({ user: currentUserId }).lean(),
        ]);
        // Normalize role to string so privacy helpers receive a stable type.
        const currentUserRole = String(currentUser?.role || '');
        // Precompute current user's circle and blocked sets for fast lookups.
        const currentCircleSet = new Set(
            (Array.isArray(currentUserProfile?.jamCircleMembers) ? currentUserProfile.jamCircleMembers : [])
                .map((id) => String(id))
        );
        const currentBlockedSet = getIdSet(currentUserProfile?.blockedMembers);

        // Load all member profiles and populate only user fields needed by discovery cards.
        const profiles = await Profile.find({})
            .populate('user', 'firstName lastName role')
            .lean();
        // SSR22 (partial): response data is privacy-filtered later, but this query still
        // loads broad profile documents rather than projecting only discovery-required keys.

        // Filter and map member profiles the current user is allowed to discover.
        const members = profiles
            .filter((profile) => profile?.user)
            .filter((profile) => !isAdminRole(profile?.user?.role))
            .filter((profile) => {

                const memberUserId = String(profile.user._id);
                // Always include the current user.
                if (memberUserId === currentUserId) return true;

                // SSR21: discovery visibility is limited by per-member privacy settings
                // and relationship checks (viewer vs target).
                // Apply members discovery privacy rules.
                if (!canViewMemberInDiscovery(currentUserProfile, profile, currentUserId, memberUserId, currentUserRole)) {
                    return false;
                }

                // Hide entries when either side has blocked the other.
                const memberBlockedSet = getIdSet(profile?.blockedMembers);
                const isBlockedEitherDirection = currentBlockedSet.has(memberUserId) || memberBlockedSet.has(currentUserId);
                return !isBlockedEitherDirection;
            })
            .map((profile) => {
                const memberUserId = String(profile.user._id);
                // Identify pending invites sent by the current user.
                const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
                    ? profile.pendingCircleInvitations
                    : [];

                // Tag cards so UI can render correct invite/connect state.
                const hasPendingInviteFromCurrentUser = pendingInvites.some((invite) => String(invite?.invitedBy || '') === currentUserId);
                const isCurrentUser = memberUserId === currentUserId;
                const isInJamCircle = currentCircleSet.has(memberUserId);

                // Build member payload with viewer-specific flags.
                return {
                    ...buildPublicMemberPayload(profile, currentUserProfile, currentUserId, currentUserRole),
                    isCurrentUser,
                    isInJamCircle,
                    hasPendingInviteFromCurrentUser,
                };
            });

        // Load organisations that have at least one public-facing field.
        const organisations = await Organisation.find({
            $or: [
                { organisationName: { $exists: true, $ne: '' } },
                { bio: { $exists: true, $ne: '' } },
                { imageUrl: { $exists: true, $ne: '' } },
            ],
        }).lean();

        // Fetch owner profiles once so we can apply block checks and enrich organisation payloads.
        const organisationOwnerIds = organisations
            .map((organisation) => String(organisation?.user || ''))
            .filter(Boolean);
        const ownerProfiles = await Profile.find({ user: { $in: organisationOwnerIds } }).lean();
        // Index owner profiles by owner user id for O(1) lookups inside map/filter.
        const ownerProfilesByUserId = new Map(ownerProfiles.map((profile) => [String(profile?.user || ''), profile]));

        // Keep only organisations visible to the current user, then map payloads.
        const organisationEntries = organisations
            .filter((organisation) => {
                const ownerUserId = String(organisation?.user || '');
                if (!ownerUserId) return false;
                const ownerProfile = ownerProfilesByUserId.get(ownerUserId);
                if (!ownerProfile) return true;

                // Hide entries when either side has blocked the other.
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
                // Keep response shape aligned with member cards for simpler frontend rendering.
                isInJamCircle: currentCircleSet.has(String(organisation?.user || '')),
                hasPendingInviteFromCurrentUser: false,
            }));

        // Return one merged discovery list for members and organisations.
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
 * getMemberPublicProfile:
 * Resolves the requested id as a member profile (or organisation fallback),
 * enforces block/privacy access rules for the viewer, and returns a safe
 * public payload shaped for the profile page.
 */
export const getMemberPublicProfile = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Normalize requester identity and target id from route params.
        const viewerUserId = String(req.userId || '');
        const { memberId } = req.params;
        // Reject malformed ids early to avoid unnecessary database work.
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        // Run both reads in parallel; we need both role and profile for privacy checks.
        // await waits for completion and returns resolved results.
        // lean keeps these reads lightweight because we only serialize/inspect fields.
        const [viewerUser, viewerProfile] = await Promise.all([
            User.findById(viewerUserId).select('role').lean(),
            Profile.findOne({ user: viewerUserId }).lean(),
        ]);
        const viewerRole = String(viewerUser?.role || '');

        // Attempt to resolve the member id as a user profile first, since members are more common than organisations.
        const profile = await Profile.findOne({ user: memberId })
            // Populate just the fields needed for privacy checks and public payload to minimize data transfer and processing.
            .populate('user', 'firstName lastName role')
            // Lean queries return plain objects which are more efficient for read-only operations and serialization.
            .lean();

        // If a member profile exists, enforce block and privacy rules before returning the public payload.
        if (profile?.user) {
            // Hard deny when either side has blocked the other.
            if (hasBlockingRelationship(viewerProfile, profile, viewerUserId, memberId)) {
                return res.status(403).json({ success: false, code: 'ACCESS_DENIED', message: 'Access denied' });
            }
            // SSR21: profile-field visibility is constrained by member privacy settings.
            // Privacy settings control whether jam circle members are exposed.
            const canViewProfile = canViewMemberProfile(viewerProfile, profile, viewerUserId, memberId, viewerRole);
            const jamCircleMembers = canViewProfile
                ? await getJamCircleMembersPayload(profile.jamCircleMembers)
                : [];
            // Return the public member payload plus contextual viewer flags.
            return res.status(200).json({
                success: true,
                // The member payload includes public profile fields and viewer-specific flags for client-side rendering logic.
                member: {
                    ...buildPublicMemberPayload(profile, viewerProfile, viewerUserId, viewerRole),
                    jamCircleMembers,
                    isCurrentUser: String(memberId) === viewerUserId,
                },
            });
        }
        // If no member profile exists, treat the id as a possible organisation.
        const organisation = await Organisation.findById(memberId).lean();
        if (!organisation) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }
        // Enforce owner-level block checks before exposing organisation details.
        const ownerUserId = String(organisation.user || '');
        // Resolve owner profile only when owner id exists.
        const ownerProfile = ownerUserId ? await Profile.findOne({ user: ownerUserId }).lean() : null;
        if (ownerProfile && hasBlockingRelationship(viewerProfile, ownerProfile, viewerUserId, ownerUserId)) {
            return res.status(403).json({ success: false, code: 'ACCESS_DENIED', message: 'Access denied' });
        }
        // Organisation payload mirrors member response shape with empty member-only collections.
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
 * redirectMemberSocialLink:
 * Validates access to a member/organisation social field, normalizes the URL,
 * and redirects the viewer to that external link.
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

        // Run these reads together to reduce latency before access checks.
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
