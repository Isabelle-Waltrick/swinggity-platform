// The code in this file were created with help of AI (Copilot)

/**
 * Calendar attendance controller.
 *
 * This handler toggles a member's going/not-going state and returns the
 * updated event in the same serialized format used by other event endpoints.
 */

import { CalendarEvent } from "../../models/calendarEvent.model.js";
import { Profile } from "../../models/profile.model.js";
import { DEFAULT_RESALE_VISIBILITY } from "../../constants/calendar.constants.js";
import { normalizeAttendeeAvatar } from "../../validators/calendar.utils.js";
import { buildEventClientContext, serializeEventWithContext } from "../../services/calendar.eventResponse.service.js";
import { findUserOrReject } from "../calendar.controllerShared.js";
import { canMarkCalendarEventGoing } from "../../utils/rolePermissions.js";

/**
 * markCalendarEventGoing:
 * Toggles the current user's attendee status and returns updated event state.
 */
export const markCalendarEventGoing = async (req, res) => {
    try {
        const { eventId } = req.params;
        // Ensure requester exists before applying attendance rules.
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        // Admin accounts are intentionally read-only for attendance interactions.
        if (!canMarkCalendarEventGoing(user.role)) {
            return res.status(403).json({ success: false, message: "Admins cannot mark Going on events." });
        }
        // Load target event and enforce host restriction.
        const event = await CalendarEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        // Prevent hosts from marking themselves as "going"
        if (String(event.createdBy || "") === String(user._id)) {
            return res.status(400).json({ success: false, message: "Hosts cannot mark Going on their own events." });
        }
        // Toggle attendee membership based on current state.
        const alreadyGoing = Array.isArray(event.attendees)
            && event.attendees.some((attendee) => String(attendee?.user || "") === String(user._id));

        if (!alreadyGoing) {
            // Snapshot current avatar into attendee record for stable list rendering.
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

        // Save the updated event and ensure we have the latest state for response serialization.
        await event.save();

        // Repopulate and serialize to return a fully hydrated event object to the client.
        const populated = await CalendarEvent.findById(event._id)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();
        const context = await buildEventClientContext({ events: [populated], viewerUser: user });
        // Return the updated event with a message indicating the new attendance state.
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
