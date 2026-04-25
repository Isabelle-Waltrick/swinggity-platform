/**
 * Shared Calendar Controller Helpers Guide
 * This file stores helpers reused by multiple calendar controllers.
 * Keeping these shared avoids duplicated auth/session and ownership logic.
 * It improves consistency and simplifies future refactors.
 */

import { User } from "../models/user.model.js";
import { getBaseCookieOptions } from "../utils/cookieOptions.js";

export const findUserOrReject = async (userId, res) => {
    const user = await User.findById(userId);
    if (!user) {
        res.clearCookie("token", getBaseCookieOptions());
        res.status(401).json({ success: false, message: "Session expired. Please log in again." });
        return null;
    }
    return user;
};

export const canManageEvent = (user, event) => {
    if (!user || !event) return false;
    const createdById = String(event?.createdBy?._id || event?.createdBy || "");
    return createdById === String(user._id || "");
};
