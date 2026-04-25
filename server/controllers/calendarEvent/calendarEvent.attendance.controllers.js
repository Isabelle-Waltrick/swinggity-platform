/**
 * Calendar Attendance Controller Guide
 * This file manages going/not-going behavior for event attendees.
 * It enforces role rules, toggles attendance state, and returns updated event data.
 * Useful when explaining attendee state transitions clearly.
 */

import { CalendarEvent } from "../../models/calendarEvent.model.js";
import { Profile } from "../../models/profile.model.js";
import { DEFAULT_RESALE_VISIBILITY } from "../../constants/calendar.constants.js";
import { normalizeAttendeeAvatar } from "../../validators/calendar.utils.js";
import { buildEventClientContext, serializeEventWithContext } from "../../services/calendar.eventResponse.service.js";
import { findUserOrReject } from "../calendar.controllerShared.js";
import { canMarkCalendarEventGoing } from "../../utils/rolePermissions.js";

export const markCalendarEventGoing = async (req, res) => {
    try {
        const { eventId } = req.params;
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        if (!canMarkCalendarEventGoing(user.role)) {
            return res.status(403).json({ success: false, message: "Admins cannot mark Going on events." });
        }

        const event = await CalendarEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        if (String(event.createdBy || "") === String(user._id)) {
            return res.status(400).json({ success: false, message: "Hosts cannot mark Going on their own events." });
        }

        const alreadyGoing = Array.isArray(event.attendees)
            && event.attendees.some((attendee) => String(attendee?.user || "") === String(user._id));

        if (!alreadyGoing) {
            const profile = await Profile.findOne({ user: user._id }).select("avatarUrl").lean();
            const avatarUrl = normalizeAttendeeAvatar(profile?.avatarUrl);

            event.attendees.push({
                user: user._id,
                avatarUrl,
                resaleTicketCount: 0,
                resaleVisibility: DEFAULT_RESALE_VISIBILITY,
            });
        } else {
            event.attendees = (Array.isArray(event.attendees) ? event.attendees : [])
                .filter((attendee) => String(attendee?.user || "") !== String(user._id));
        }

        await event.save();

        const populated = await CalendarEvent.findById(event._id)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();
        const context = await buildEventClientContext({ events: [populated], viewerUser: user });

        return res.status(200).json({
            success: true,
            message: alreadyGoing ? "Marked as not going." : "Marked as going.",
            event: serializeEventWithContext({
                event: populated,
                viewerUserId: user._id,
                context,
            }),
        });
    } catch (error) {
        console.log("Error in markCalendarEventGoing", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
