// Utility functions for checking user roles and permissions.
export const normalizeRole = (value) => String(value || "").trim().toLowerCase();

export const isAdminRole = (value) => normalizeRole(value) === "admin";

export const isOrganiserRole = (value) => {
    const normalizedRole = normalizeRole(value);
    return normalizedRole === "organiser" || normalizedRole === "organizer";
};

export const canCreateOrManageEvents = (role) => isAdminRole(role) || isOrganiserRole(role);

export const canDeleteCalendarEvent = ({ role, isEventOwner }) => {
    if (!canCreateOrManageEvents(role)) return false;
    if (isAdminRole(role)) return true;
    return Boolean(isEventOwner);
};

export const canMarkCalendarEventGoing = (role) => !isAdminRole(role);

export const canSubmitOrganiserVerificationRequest = (role) => !canCreateOrManageEvents(role);

// Checks if the inviter and invitee roles are both non-admin, which is a requirement for Jam Circle invitations.
export const canJamCircleInvite = ({ inviterRole, inviteeRole }) => {
    return !isAdminRole(inviterRole) && !isAdminRole(inviteeRole);
};