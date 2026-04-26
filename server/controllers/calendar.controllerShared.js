/**
 * Shared calendar controller helpers.
 *
 * These utilities centralize common auth/session and ownership checks so
 * calendar controllers can stay focused on endpoint-specific behavior.
 */

import { User } from "../models/user.model.js";
import { getBaseCookieOptions } from "../utils/cookieOptions.js";

/**
 * findUserOrReject:
 * Resolves the authenticated user and sends a session-expired response when
 * the user no longer exists.
 */
export const findUserOrReject = async (userId, res) => {
    // Fetch user from auth context id; downstream controllers rely on this object.
    const user = await User.findById(userId);
    if (!user) {
        // Clear stale auth cookie to prevent repeated failed requests with old sessions.
        res.clearCookie("token", getBaseCookieOptions());
        res.status(401).json({ success: false, message: "Session expired. Please log in again." });
        return null;
    }

    // Return resolved user so controllers can continue request handling.
    return user;
};

/**
 * canManageEvent:
 * Checks whether the given user is the owner/creator of the target event.
 */
export const canManageEvent = (user, event) => {
    // Guard against missing inputs to keep caller logic simple.
    if (!user || !event) return false;

    // Support both populated and unpopulated createdBy values.
    const createdById = String(event?.createdBy?._id || event?.createdBy || "");
    return createdById === String(user._id || "");
};
