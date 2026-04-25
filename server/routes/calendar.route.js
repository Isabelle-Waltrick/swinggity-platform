/**
 * Calendar Route Guide
 * Think of this file as the traffic controller for calendar HTTP requests.
 * It decides the order of middleware checks and which controller handles each path.
 * When explaining request flow end-to-end, this is the best starting point.
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

router.get("/events", verifyToken, listCalendarEvents); // GET /events
router.get("/events/:eventId", verifyToken, validateCalendarEventIdParam, getCalendarEventById); // GET /events/:eventId
router.get("/places/autocomplete", verifyToken, autocompletePlaces); // GET /places/autocomplete
router.get("/cities/autocomplete", verifyToken, autocompleteCities); // GET /cities/autocomplete
router.get("/cities/reverse", verifyToken, reverseCityLookup); // GET /cities/reverse
router.get("/cohost-invitations/respond", respondToCoHostInvitation); // GET /cohost-invitations/respond
router.get("/cohost-invitations/pending", verifyToken, getPendingCoHostInvitations); // GET /cohost-invitations/pending
router.get("/cohost-status-notifications/pending", verifyToken, getPendingCoHostStatusNotifications); // GET /cohost-status-notifications/pending
router.post("/events", verifyToken, requireEventPosterRole, uploadEventImageSingle, createCalendarEvent); // POST /events
router.post("/cohost-status-notifications/dismiss", verifyToken, dismissCoHostStatusNotification); // POST /cohost-status-notifications/dismiss
router.post("/cohost-invitations/respond-in-app", verifyToken, respondToCoHostInvitationInApp); // POST /cohost-invitations/respond-in-app
router.post("/events/:eventId/going", verifyToken, validateCalendarEventIdParam, markCalendarEventGoing); // POST /events/:eventId/going
router.patch("/events/:eventId/resell-availability", verifyToken, validateCalendarEventIdParam, updateCalendarEventResellAvailability); // PATCH /events/:eventId/resell-availability
router.patch("/events/:eventId/resell-tickets", verifyToken, validateCalendarEventIdParam, updateCalendarEventResellTickets); // PATCH /events/:eventId/resell-tickets
router.post("/organiser-verification-request", verifyToken, submitOrganiserVerificationRequest); // POST /organiser-verification-request
router.patch("/events/:eventId", verifyToken, validateCalendarEventIdParam, requireEventPosterRole, uploadEventImageSingle, updateCalendarEvent); // PATCH /events/:eventId
router.delete("/events/:eventId", verifyToken, validateCalendarEventIdParam, requireEventPosterRole, deleteCalendarEvent); // DELETE /events/:eventId

export default router;
