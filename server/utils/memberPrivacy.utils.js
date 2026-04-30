// The code in this file were created with help of AI (Copilot)

import { isAdminRole } from './rolePermissions.js';

// SSR16 (partial): stored profile details are treated as sensitive in access decisions
// through per-field privacy controls (profile/contact/activity/member discovery checks).
// However, the codebase does not define formal protection levels/classes for profile data.

/**
 * getIdSet:
 * Turns a list of ids into a Set of strings so lookups are fast and consistent.
 */
export const getIdSet = (values) => new Set(
    (Array.isArray(values) ? values : []).map((value) => String(value))
);

/**
 * canContactMember:
 * Returns true when the viewer is allowed to contact the target member.
 * The result depends on the target's contact privacy setting and circle links.
 */
export const canContactMember = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    // Admins can always contact members.
    if (isAdminRole(viewerRole)) return true;
    // If privacyContact is missing, treat it as "anyone" (default).
    const privacy = typeof targetProfile?.privacyContact === 'string' ? targetProfile.privacyContact : 'anyone';
    // Handle simple privacy options first.
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;

    // Build both circle member sets for relationship checks.
    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);

    // Convert ids to strings so comparisons always match.
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');

    // "circle": allow contact if either user has the other in their circle
    if (privacy === 'circle') {
        return viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);
    }
    // "mutual": allow contact only when they share at least one circle member.
    if (privacy === 'mutual') {
        for (const memberId of viewerCircleSet) {
            // Stop as soon as a shared member is found.
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }

    // Unknown privacy values are denied by default.
    return false;
};

/**
 * canViewMemberProfile:
 * Returns true when the viewer can see the target's profile details.
 */
export const canViewMemberProfile = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    // Admins can always view profiles.
    if (isAdminRole(viewerRole)) return true;
    // If privacyProfile is missing, treat it as "anyone" (default).
    const privacy = typeof targetProfile?.privacyProfile === 'string' ? targetProfile.privacyProfile : 'anyone';
    // Members can always view their own profile.
    if (String(viewerUserId || '') === String(targetUserId || '')) return true;
    // Handle simple privacy options first.
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;
    // Build both circle member sets for relationship checks.
    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
    // Convert ids to strings so comparisons always match.
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');
    // Direct connection means either user has the other in their circle.
    const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);
    // "circle": only direct circle connections can view the profile.
    if (privacy === 'circle') {
        return directConnection;
    }
    // "mutual": allow direct connections or at least one shared circle member.
    if (privacy === 'mutual') {
        // Return early if they are directly connected.
        if (directConnection) return true;
        // Check for any shared circle members.
        for (const memberId of viewerCircleSet) {
            // Stop as soon as a shared member is found.
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }

    // Unknown privacy values are denied by default.
    return false;
};

/**
 * canViewMemberInDiscovery:
 * Returns true when the target member should appear in discovery results.
 */
export const canViewMemberInDiscovery = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    // Admins can always view members in discovery.
    if (isAdminRole(viewerRole)) return true;

    // If privacyMembers is missing, treat it as "anyone" (default).
    const privacy = typeof targetProfile?.privacyMembers === 'string' ? targetProfile.privacyMembers : 'anyone';
    // Members can always see themselves in discovery.
    if (String(viewerUserId || '') === String(targetUserId || '')) return true;
    // Handle simple privacy options first.
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;

    // Build both circle member sets for relationship checks.
    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
    // Convert ids to strings so comparisons always match.
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');
    // Direct connection means either user has the other in their circle.
    const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

    // "circle": only direct circle connections appear in discovery.
    if (privacy === 'circle') {
        return directConnection;
    }
    // "mutual": allow direct connections or at least one shared circle member.
    if (privacy === 'mutual') {
        // Return early if they are directly connected.
        if (directConnection) return true;

        // Check for any shared circle members.
        for (const memberId of viewerCircleSet) {
            // Stop as soon as a shared member is found.
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }
    // Unknown privacy values are denied by default.
    return false;
};

/**
 * canViewMemberActivity:
 * Returns true when the viewer can see the target's activity fields.
 */
export const canViewMemberActivity = (viewerProfile, targetProfile, viewerUserId, targetUserId, viewerRole = '') => {
    // Admins can always view activity.
    if (isAdminRole(viewerRole)) return true;
    // If privacyActivity is missing, treat it as "anyone" (default).
    const privacy = typeof targetProfile?.privacyActivity === 'string' ? targetProfile.privacyActivity : 'anyone';
    // Members can always view their own activity.
    if (String(viewerUserId || '') === String(targetUserId || '')) return true;
    // Handle simple privacy options first.
    if (privacy === 'nobody') return false;
    if (privacy === 'anyone') return true;
    // Build both circle member sets for relationship checks.
    const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
    const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
    // Convert ids to strings so comparisons always match.
    const normalizedViewerUserId = String(viewerUserId || '');
    const normalizedTargetUserId = String(targetUserId || '');
    // Direct connection means either user has the other in their circle.
    const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

    // "circle": only direct circle connections can view activity.
    if (privacy === 'circle') {
        return directConnection;
    }
    // "mutual": allow direct connections or at least one shared circle member.
    if (privacy === 'mutual') {
        // Return early if they are directly connected.
        if (directConnection) return true;
        // Check for any shared circle members.
        for (const memberId of viewerCircleSet) {
            // Stop as soon as a shared member is found.
            if (targetCircleSet.has(memberId)) return true;
        }
        return false;
    }
    // Unknown privacy values are denied by default.
    return false;
};

/**
 * hasBlockingRelationship:
 * Returns true if either user has blocked the other.
 */
export const hasBlockingRelationship = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
    // Build block sets for quick bidirectional checks.
    const viewerBlockedSet = getIdSet(viewerProfile?.blockedMembers);
    const targetBlockedSet = getIdSet(targetProfile?.blockedMembers);
    // A block in either direction means the relationship is blocked.
    return viewerBlockedSet.has(String(targetUserId || '')) || targetBlockedSet.has(String(viewerUserId || ''));
};
