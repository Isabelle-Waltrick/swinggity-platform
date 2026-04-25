/**
 * Calendar Event Guard Middleware Guide
 * These middleware functions handle early request protection.
 * They validate route params and enforce role access before controllers run.
 * This keeps controllers cleaner and easier to explain line-by-line.
 */

import mongoose from "mongoose";
import { canCreateOrManageEvents } from "../utils/rolePermissions.js";
import { findUserOrReject } from "../controllers/calendar.controllerShared.js";

export const validateCalendarEventIdParam = (req, res, next) => {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
        return res.status(400).json({ success: false, message: "Invalid event id" });
    }
    return next();
};

export const requireEventPosterRole = async (req, res, next) => {
    const user = req.authUser || await findUserOrReject(req.userId, res);
    if (!user) return;

    req.authUser = user;
    if (!canCreateOrManageEvents(user?.role)) {
        return res.status(403).json({
            success: false,
            message: "Only users with organiser or admin role can create or manage events",
        });
    }

    return next();
};
