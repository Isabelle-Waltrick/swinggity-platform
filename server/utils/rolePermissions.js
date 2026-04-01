export const isAdminRole = (value) => String(value || "").trim().toLowerCase() === "admin";

export const canJamCircleInvite = ({ inviterRole, inviteeRole }) => {
    return !isAdminRole(inviterRole) && !isAdminRole(inviteeRole);
};