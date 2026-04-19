import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { uploadEventImageSingle } from "../middleware/eventImageUpload.js";
import {
    autocompleteCities,
    autocompletePlaces,
    createCalendarEvent,
    deleteCalendarEvent,
    dismissCoHostStatusNotification,
    getCalendarEventById,
    getPendingCoHostInvitations,
    getPendingCoHostStatusNotifications,
    markCalendarEventGoing,
    listCalendarEvents,
    respondToCoHostInvitation,
    respondToCoHostInvitationInApp,
    reverseCityLookup,
    submitOrganiserVerificationRequest,
    updateCalendarEvent,
    updateCalendarEventResellAvailability,
    updateCalendarEventResellTickets,
} from "../controllers/calendar.controllers.js";

const router = express.Router();

router.get("/events", verifyToken, listCalendarEvents); // GET /events
router.get("/events/:eventId", verifyToken, getCalendarEventById); // GET /events/:eventId
router.get("/places/autocomplete", verifyToken, autocompletePlaces); // GET /places/autocomplete
router.get("/cities/autocomplete", verifyToken, autocompleteCities); // GET /cities/autocomplete
router.get("/cities/reverse", verifyToken, reverseCityLookup); // GET /cities/reverse
router.get("/cohost-invitations/respond", respondToCoHostInvitation); // GET /cohost-invitations/respond
router.get("/cohost-invitations/pending", verifyToken, getPendingCoHostInvitations); // GET /cohost-invitations/pending
router.get("/cohost-status-notifications/pending", verifyToken, getPendingCoHostStatusNotifications); // GET /cohost-status-notifications/pending
router.post("/events", verifyToken, uploadEventImageSingle, createCalendarEvent); // POST /events
router.post("/cohost-status-notifications/dismiss", verifyToken, dismissCoHostStatusNotification); // POST /cohost-status-notifications/dismiss
router.post("/cohost-invitations/respond-in-app", verifyToken, respondToCoHostInvitationInApp); // POST /cohost-invitations/respond-in-app
router.post("/events/:eventId/going", verifyToken, markCalendarEventGoing); // POST /events/:eventId/going
router.patch("/events/:eventId/resell-availability", verifyToken, updateCalendarEventResellAvailability); // PATCH /events/:eventId/resell-availability
router.patch("/events/:eventId/resell-tickets", verifyToken, updateCalendarEventResellTickets); // PATCH /events/:eventId/resell-tickets
router.post("/organiser-verification-request", verifyToken, submitOrganiserVerificationRequest); // POST /organiser-verification-request
router.patch("/events/:eventId", verifyToken, uploadEventImageSingle, updateCalendarEvent); // PATCH /events/:eventId
router.delete("/events/:eventId", verifyToken, deleteCalendarEvent); // DELETE /events/:eventId

export default router;
