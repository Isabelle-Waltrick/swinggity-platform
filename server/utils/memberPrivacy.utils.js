import { isAdminRole } from './rolePermissions.js';

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

export const hasBlockingRelationship = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
    const viewerBlockedSet = getIdSet(viewerProfile?.blockedMembers);
    const targetBlockedSet = getIdSet(targetProfile?.blockedMembers);
    return viewerBlockedSet.has(String(targetUserId || '')) || targetBlockedSet.has(String(viewerUserId || ''));
};
