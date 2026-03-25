import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { uploadEventImageSingle } from "../middleware/eventImageUpload.js";
import { createCalendarEvent } from "../controllers/calendar.controllers.js";

const router = express.Router();

router.post("/events", verifyToken, uploadEventImageSingle, createCalendarEvent);

export default router;
