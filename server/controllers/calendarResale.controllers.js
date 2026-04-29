// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Resale Controllers Guide
 * These handlers manage resale availability and attendee resale ticket values.
 * They enforce resale-specific business conditions before persisting updates.
 * This is the best place to explain ticket resale behavior in the backend.
 */

import { CalendarEvent } from "../models/calendarEvent.model.js";
import { RESALE_TICKETS_MAX } from "../constants/calendar.constants.js";
import {
    asTrimmedString,
    isResellOpenForEvent,
    normalizeResaleVisibility,
} from "../validators/calendar.utils.js";
import { getProfileAvatarByUserId } from "../services/calendar.lookup.service.js";
import { buildEventClientContext, serializeEventWithContext } from "../services/calendar.eventResponse.service.js";
import { findUserOrReject, canManageEvent } from "./calendar.controllerShared.js";

export const updateCalendarEventResellAvailability = async (req, res) => {
    try {
        const { eventId } = req.params;
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const event = await CalendarEvent.findById(eventId)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email");
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        if (!canManageEvent(user, event)) {
            return res.status(403).json({ success: false, message: "Only the event organiser can update ticket re-sell availability" });
        }

        const soldOutStatus = asTrimmedString(req.body.soldOutStatus);
        if (!["sold-out", "not-sold-out"].includes(soldOutStatus)) {
            return res.status(400).json({ success: false, message: "Sold-out status is invalid" });
        }

        if (asTrimmedString(event.allowResell) !== "yes") {
            return res.status(400).json({ success: false, message: "Ticket re-sell is disabled for this event" });
        }

        if (asTrimmedString(event.resellCondition) !== "When tickets are sold-out") {
            return res.status(400).json({ success: false, message: "This event does not require sold-out confirmation" });
        }

        event.resellActivated = soldOutStatus === "sold-out";
        if (!event.resellActivated) {
            const attendees = Array.isArray(event.attendees) ? event.attendees : [];
            for (const attendee of attendees) {
                attendee.resaleTicketCount = 0;
            }
        }

        await event.save();

        const eventObject = event.toObject();
        const context = await buildEventClientContext({ events: [eventObject], viewerUser: user });

        return res.status(200).json({
            success: true,
            message: "Ticket re-sell availability updated",
            event: serializeEventWithContext({
                event: eventObject,
                viewerUserId: user._id,
                context,
            }),
        });
    } catch (error) {
        console.log("Error in updateCalendarEventResellAvailability", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateCalendarEventResellTickets = async (req, res) => {
    try {
        const { eventId } = req.params;
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const event = await CalendarEvent.findById(eventId)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email");
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        if (!isResellOpenForEvent(event)) {
            return res.status(400).json({ success: false, message: "Ticket re-sell is not currently available" });
        }

        const rawTicketCount = Number(req.body.ticketCount);
        if (!Number.isInteger(rawTicketCount) || rawTicketCount < 0 || rawTicketCount > RESALE_TICKETS_MAX) {
            return res.status(400).json({ success: false, message: `Ticket count must be between 0 and ${RESALE_TICKETS_MAX}` });
        }
        const resaleVisibility = normalizeResaleVisibility(req.body.resaleVisibility);

        const profileAvatarUrl = rawTicketCount > 0 ? await getProfileAvatarByUserId(user._id) : "";

        const attendeeIndex = Array.isArray(event.attendees)
            ? event.attendees.findIndex((attendee) => String(attendee?.user?._id || attendee?.user || "") === String(user._id))
            : -1;

        if (attendeeIndex < 0 && rawTicketCount > 0) {
            event.attendees.push({
                user: user._id,
                avatarUrl: profileAvatarUrl,
                resaleTicketCount: rawTicketCount,
                resaleVisibility,
            });
        } else if (attendeeIndex >= 0) {
            event.attendees[attendeeIndex].resaleTicketCount = rawTicketCount;
            event.attendees[attendeeIndex].resaleVisibility = resaleVisibility;

            if (rawTicketCount > 0) {
                event.attendees[attendeeIndex].avatarUrl = profileAvatarUrl;
            }
        }
        await event.save();

        const eventObject = event.toObject();
        const context = await buildEventClientContext({ events: [eventObject], viewerUser: user });

        return res.status(200).json({
            success: true,
            message: rawTicketCount === 0 ? "Re-sell ticket removed" : "Re-sell tickets updated",
            event: serializeEventWithContext({
                event: eventObject,
                viewerUserId: user._id,
                context,
            }),
        });
    } catch (error) {
        console.log("Error in updateCalendarEventResellTickets", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
