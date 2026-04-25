/**
 * Calendar Read Controllers Guide
 * This file is responsible for listing events and fetching one event detail.
 * It focuses on query/populate work and response shaping, not mutation behavior.
 * Good place to explain how read-only endpoints stay consistent.
 */

import { CalendarEvent } from "../../models/calendarEvent.model.js";
import { buildEventClientContext, serializeEventWithContext } from "../../services/calendar.eventResponse.service.js";
import { findUserOrReject } from "../calendar.controllerShared.js";

export const listCalendarEvents = async (req, res) => {
    try {
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const events = await CalendarEvent.find({})
            .sort({ startDate: 1, startTime: 1, createdAt: -1 })
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();

        const context = await buildEventClientContext({ events, viewerUser: user });

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

export const getCalendarEventById = async (req, res) => {
    try {
        const { eventId } = req.params;
        const user = await findUserOrReject(req.userId, res);
        if (!user) return;

        const event = await CalendarEvent.findById(eventId)
            .populate("createdBy", "firstName lastName email role")
            .populate("attendees.user", "firstName lastName email")
            .lean();

        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

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
