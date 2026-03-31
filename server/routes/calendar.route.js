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

router.get("/events", verifyToken, listCalendarEvents);
router.get("/events/:eventId", verifyToken, getCalendarEventById);
router.get("/places/autocomplete", verifyToken, autocompletePlaces);
router.get("/cities/autocomplete", verifyToken, autocompleteCities);
router.get("/cities/reverse", verifyToken, reverseCityLookup);
router.get("/cohost-invitations/respond", respondToCoHostInvitation);
router.get("/cohost-invitations/pending", verifyToken, getPendingCoHostInvitations);
router.get("/cohost-status-notifications/pending", verifyToken, getPendingCoHostStatusNotifications);
router.post("/events", verifyToken, uploadEventImageSingle, createCalendarEvent);
router.post("/cohost-status-notifications/dismiss", verifyToken, dismissCoHostStatusNotification);
router.post("/cohost-invitations/respond-in-app", verifyToken, respondToCoHostInvitationInApp);
router.post("/events/:eventId/going", verifyToken, markCalendarEventGoing);
router.patch("/events/:eventId/resell-availability", verifyToken, updateCalendarEventResellAvailability);
router.patch("/events/:eventId/resell-tickets", verifyToken, updateCalendarEventResellTickets);
router.post("/organiser-verification-request", verifyToken, submitOrganiserVerificationRequest);
router.patch("/events/:eventId", verifyToken, uploadEventImageSingle, updateCalendarEvent);
router.delete("/events/:eventId", verifyToken, deleteCalendarEvent);

export default router;
