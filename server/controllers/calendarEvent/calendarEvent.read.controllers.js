// The code in this file were created with help of AI (Copilot)

/**
 * Calendar read controllers.
 *
 * These handlers provide read-only event data and keep response shaping
 * consistent by routing all payloads through the same serializer pipeline.
 */

import { CalendarEvent } from "../../models/calendarEvent.model.js";
import { buildEventClientContext, serializeEventWithContext } from "../../services/calendar.eventResponse.service.js";
import { findUserOrReject } from "../calendar.controllerShared.js";

/**
 * listCalendarEvents:
 * Returns all events sorted for UI consumption and serialized with viewer-aware flags.
 */
// FR21: Backend handler that returns all calendar events to authenticated users (User, Organiser, Admin).
export const listCalendarEvents = async (req, res) => {
    try {
        // Verify authenticated user exists before doing any event reads.
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        // Pull events with deterministic ordering and basic related user data.
        const events = await CalendarEvent.find({})
            // Default sort by soonest upcoming event, then by most recently created for same-day events.
            .sort({ startDate: 1, startTime: 1, createdAt: -1 })
            // Populate only the user fields needed for client display and permission checks.
            .populate("createdBy", "firstName lastName email role")
            // Populate atendee user references to enable viewer-specific flags in the serializer (e.g. isGoing, canManage).
            .populate("attendees.user", "firstName lastName email")
            // Use .lean() to get plain objects for the serializer instead of Mongoose documents.
            .lean();

        // Build reusable lookup/context data used by the serializer for this viewer.
        const context = await buildEventClientContext({ events, viewerUser: user });

        // Serialize each event with a consistent client contract.
        return res.status(200).json({
            success: true,
            events: events.map((event) => serializeEventWithContext({
                event,
                viewerUserId: user._id,
                context,
            })),
        });
    } catch (error) {
        console.log("Error in listCalendarEvents", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * getCalendarEventById:
 * Returns a single event by id using the same viewer-aware serialization contract.
 */
export const getCalendarEventById = async (req, res) => {
    try {
        // Read target id from route params and verify requester exists.
        const { eventId } = req.params;
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        // Query a single event and include related user records needed by the UI.
        const event = await CalendarEvent.findById(eventId)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();

        // Return a clean 404 if the id is valid but the event no longer exists.
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        // Reuse the same context+serializer pipeline as list endpoints for consistency.
        const context = await buildEventClientContext({ events: [event], viewerUser: user });

        return res.status(200).json({
            success: true,
            event: serializeEventWithContext({
                event,
                viewerUserId: user._id,
                context,
            }),
        });
    } catch (error) {
        console.log("Error in getCalendarEventById", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
