import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { uploadEventImageSingle } from "../middleware/eventImageUpload.js";
import {
    createCalendarEvent,
    deleteCalendarEvent,
    listCalendarEvents,
    submitOrganiserVerificationRequest,
    updateCalendarEvent,
} from "../controllers/calendar.controllers.js";

const router = express.Router();

router.get("/events", verifyToken, listCalendarEvents);
router.post("/events", verifyToken, uploadEventImageSingle, createCalendarEvent);
router.post("/organiser-verification-request", verifyToken, submitOrganiserVerificationRequest);
router.patch("/events/:eventId", verifyToken, uploadEventImageSingle, updateCalendarEvent);
router.delete("/events/:eventId", verifyToken, deleteCalendarEvent);

export default router;
