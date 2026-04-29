// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Event Controller Barrel Guide
 * This barrel exposes create/read/manage/attendance handlers from split files.
 * It keeps the feature modular without forcing route import churn everywhere.
 */

export { createCalendarEvent } from "./calendarEvent/calendarEvent.create.controllers.js";
export { listCalendarEvents, getCalendarEventById } from "./calendarEvent/calendarEvent.read.controllers.js";
export { updateCalendarEvent, deleteCalendarEvent } from "./calendarEvent/calendarEvent.manage.controllers.js";
export { markCalendarEventGoing } from "./calendarEvent/calendarEvent.attendance.controllers.js";


