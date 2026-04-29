// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Route Guide
 * Sort of traffic controller for calendar HTTP requests.
 * It decides the order of middleware checks and which controller handles each path.
 */

import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { uploadEventImageSingle } from "../middleware/eventImageUpload.js";
import {
    requireEventPosterRole,
    validateCalendarEventIdParam,
} from "../middleware/calendarEventGuards.js";
import {
    createCalendarEvent,
    deleteCalendarEvent,
    getCalendarEventById,
    markCalendarEventGoing,
    listCalendarEvents,
    updateCalendarEvent,
} from "../controllers/calendarEvent.controllers.js";
import {
    updateCalendarEventResellAvailability,
    updateCalendarEventResellTickets,
} from "../controllers/calendarResale.controllers.js";
import {
    autocompleteCities,
    autocompletePlaces,
    reverseCityLookup,
} from "../controllers/calendarGeo.controllers.js";
import {
    dismissCoHostStatusNotification,
    getPendingCoHostInvitations,
    getPendingCoHostStatusNotifications,
    respondToCoHostInvitation,
    respondToCoHostInvitationInApp,
} from "../controllers/calendarCohost.controllers.js";
import { submitOrganiserVerificationRequest } from "../controllers/calendarAdmin.controllers.js";

const router = express.Router();

// Event read routes
// Loads the main calendar listing page and calls listCalendarEvents after auth succeeds.
router.get("/events", verifyToken, listCalendarEvents);
// Loads a single calendar event detail page and calls getCalendarEventById after auth and event-id validation.
router.get("/events/:eventId", verifyToken, validateCalendarEventIdParam, getCalendarEventById);

// Event write routes
// Submits the create-event form, runs auth/role/upload middleware, and then calls createCalendarEvent.
router.post("/events", verifyToken, requireEventPosterRole, uploadEventImageSingle, createCalendarEvent);
// Submits the edit-event form, runs auth/role/upload checks, and then calls updateCalendarEvent.
router.patch("/events/:eventId", verifyToken, validateCalendarEventIdParam, requireEventPosterRole, uploadEventImageSingle, updateCalendarEvent);
// Deletes an event from the management flow after auth/role validation and calls deleteCalendarEvent.
router.delete("/events/:eventId", verifyToken, validateCalendarEventIdParam, requireEventPosterRole, deleteCalendarEvent);
// Toggles the current user's Going status from an event card/detail page and calls markCalendarEventGoing.
router.post("/events/:eventId/going", verifyToken, validateCalendarEventIdParam, markCalendarEventGoing);

// Event resale routes
// Updates whether ticket resale is enabled for an event management flow and calls updateCalendarEventResellAvailability.
router.patch("/events/:eventId/resell-availability", verifyToken, validateCalendarEventIdParam, updateCalendarEventResellAvailability);
// Updates resale ticket counts/visibility for an attendee and calls updateCalendarEventResellTickets.
router.patch("/events/:eventId/resell-tickets", verifyToken, validateCalendarEventIdParam, updateCalendarEventResellTickets);

// Geo helper routes
// Powers the address search field on the create/edit event page and calls autocompletePlaces for place suggestions.
router.get("/places/autocomplete", verifyToken, autocompletePlaces);
// Powers city autocomplete inputs or filters and calls autocompleteCities for city suggestion results.
router.get("/cities/autocomplete", verifyToken, autocompleteCities);
// Supports reverse geocoding flows that turn map coordinates into a city and calls reverseCityLookup.
router.get("/cities/reverse", verifyToken, reverseCityLookup);

// Co-host routes
// Loads the email/browser co-host invitation response flow and calls respondToCoHostInvitation without login middleware.
router.get("/cohost-invitations/respond", respondToCoHostInvitation);
// Loads the authenticated user's pending co-host invitations view and calls getPendingCoHostInvitations.
router.get("/cohost-invitations/pending", verifyToken, getPendingCoHostInvitations);
// Loads pending co-host status notifications for the user dashboard and calls getPendingCoHostStatusNotifications.
router.get("/cohost-status-notifications/pending", verifyToken, getPendingCoHostStatusNotifications);
// Handles in-app acceptance or rejection of a co-host invite and calls respondToCoHostInvitationInApp.
router.post("/cohost-invitations/respond-in-app", verifyToken, respondToCoHostInvitationInApp);
// Dismisses a co-host status notification from the UI and calls dismissCoHostStatusNotification.
router.post("/cohost-status-notifications/dismiss", verifyToken, dismissCoHostStatusNotification);

// Admin/verification routes
// Submits the organiser verification request flow and calls submitOrganiserVerificationRequest.
router.post("/organiser-verification-request", verifyToken, submitOrganiserVerificationRequest);

export default router;
