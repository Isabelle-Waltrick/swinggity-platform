/**
 * Calendar event guard middleware.
 *
 * These guards run before controllers to validate route params and enforce
 * role-based access for event creation/management routes.
 */

import mongoose from "mongoose";
import { canCreateOrManageEvents } from "../utils/rolePermissions.js";
import { findUserOrReject } from "../controllers/calendar.controllerShared.js";

/**
 * validateCalendarEventIdParam:
 * Rejects malformed event ids before controller logic executes.
 */
export const validateCalendarEventIdParam = (req, res, next) => {
    // Pull the route param from /events/:eventId style routes.
    const { eventId } = req.params;
    // Reject malformed ids early so controllers never query Mongo with invalid ObjectIds.
    if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
        return res.status(400).json({ success: false, message: "Invalid event id" });
    }
    // Param is valid; continue to the next middleware/controller.
    return next();
};

/**
 * requireEventPosterRole:
 * Allows event write operations only for organiser/admin-capable users.
 */
export const requireEventPosterRole = async (req, res, next) => {
    // Reuse an already-loaded user when available, otherwise resolve the authenticated user.
    const user = req.authUser || await findUserOrReject(req.userId, res);
    // findUserOrReject already sent the response when user lookup fails.
    if (!user) return;

    // Cache user on request so downstream handlers don't fetch it again.
    req.authUser = user;
    // Block members who are not allowed to create/update/delete calendar events.
    if (!canCreateOrManageEvents(user?.role)) {
        return res.status(403).json({
            success: false,
            message: "Only users with organiser or admin role can create or manage events",
        });
    }

    // Role is authorized; continue request processing.
    return next();
};
