// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Controller Compatibility Barrel Guide
 * This file exists to keep import paths stable during refactors.
 * It re-exports handlers so callers do not break when internals are reorganized.
 */

export {
    createCalendarEvent,
    deleteCalendarEvent,
    getCalendarEventById,
    listCalendarEvents,
    markCalendarEventGoing,
    updateCalendarEvent,
} from "./calendarEvent.controllers.js";

export {
    updateCalendarEventResellAvailability,
    updateCalendarEventResellTickets,
} from "./calendarResale.controllers.js";
