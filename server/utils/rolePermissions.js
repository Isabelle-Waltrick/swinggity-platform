// The code in this file were created with help of AI (Copilot)

// First step in every role check: normalize input so comparisons stay consistent.
// This protects us from casing/whitespace differences coming from DB/API payloads.
export const normalizeRole = (value) => String(value || "").trim().toLowerCase();

// Dedicated helper because "is admin" is reused across many permission decisions.
export const isAdminRole = (value) => normalizeRole(value) === "admin";

// We intentionally support both organiser spellings used across the codebase.
export const isOrganiserRole = (value) => {
    const normalizedRole = normalizeRole(value);
    return normalizedRole === "organiser" || normalizedRole === "organizer";
};

// Event management is shared by organisers and admins.
// Keeping this in one helper avoids repeating this rule in controllers.
// SSR18: fully implemented via role-based authorization — only organiser/admin roles
// can create/manage events, while regular members are blocked from event creation.
export const canCreateOrManageEvents = (role) => isAdminRole(role) || isOrganiserRole(role);

// If a user can already create/manage events, they do not need to send another permission request.
export const canSubmitOrganiserVerificationRequest = (role) => !canCreateOrManageEvents(role);

// Delete event rule:
// 1) User must be in an event-management role.
// 2) Admin can delete any event.
// 3) Non-admin must be the owner.
export const canDeleteCalendarEvent = ({ role, isEventOwner }) => {
    if (!canCreateOrManageEvents(role)) return false;
    if (isAdminRole(role)) return true;
    return Boolean(isEventOwner);
};


// Admin accounts are restricted from marking "Going" to keep moderation/admin usage separate.
export const canMarkCalendarEventGoing = (role) => !isAdminRole(role);


// Profile edit rule is intentionally strict: only self-edits are allowed.
// This blocks cross-user profile edits (name, bio, privacy, tags, etc.).
export const canEditOwnProfile = ({ requesterUserId, targetUserId }) => {
    const normalizedRequesterUserId = String(requesterUserId || '').trim();
    const normalizedTargetUserId = String(targetUserId || '').trim();
    if (!normalizedRequesterUserId || !normalizedTargetUserId) return false;
    return normalizedRequesterUserId === normalizedTargetUserId;
};

// Role changes are admin-only by policy.
export const canUpdateMemberRole = (requesterRole) => isAdminRole(requesterRole);

// Admin endpoint for deleting another account is admin-only by policy.
export const canDeleteMemberAccountAsAdmin = (requesterRole) => isAdminRole(requesterRole);

// Legacy/simple Jam Circle check kept for compatibility where a boolean is enough.
export const canJamCircleInvite = ({ inviterRole, inviteeRole }) => {
    return !isAdminRole(inviterRole) && !isAdminRole(inviteeRole);
};

// Rich Jam Circle decision helper used when controllers need a reason as well as allowed/denied.
// Reason codes are useful for mapping to user-friendly response messages.
export const getJamCircleInviteRoleDecision = ({ inviterRole, inviteeRole }) => {
    if (isAdminRole(inviterRole)) {
        return { allowed: false, reason: 'inviter-is-admin' };
    }

    if (isAdminRole(inviteeRole)) {
        return { allowed: false, reason: 'invitee-is-admin' };
    }

    return { allowed: true, reason: 'allowed' };
};

// Admin invitees are not allowed to accept Jam Circle invitations.
export const canAcceptJamCircleInvitation = (inviteeRole) => !isAdminRole(inviteeRole);