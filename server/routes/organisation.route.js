// The code in this file were created with help of AI (Copilot)

import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { uploadAvatarSingle } from "../middleware/avatarUpload.js";
import {
    dismissOrganisationStatusNotification,
    getMyOrganisationMembershipSummary,
    getMyOrganisation,
    getPendingOrganisationInvitations,
    getPendingOrganisationStatusNotifications,
    leaveOrganisationAsParticipant,
    respondToOrganisationInvitation,
    respondToOrganisationInvitationInApp,
    upsertMyOrganisation,
    uploadMyOrganisationImage,
    removeMyOrganisationImage,
    deleteMyOrganisation,
} from "../controllers/organisation.controllers.js";

const router = express.Router();

router.get("/me", verifyToken, getMyOrganisation); // GET /me
router.get("/me/summary", verifyToken, getMyOrganisationMembershipSummary); // GET /me/summary
router.patch("/me", verifyToken, upsertMyOrganisation); // PATCH /me
router.delete("/me", verifyToken, deleteMyOrganisation); // DELETE /me
router.post("/me/image", verifyToken, uploadAvatarSingle, uploadMyOrganisationImage); // POST /me/image
router.delete("/me/image", verifyToken, removeMyOrganisationImage); // DELETE /me/image
router.post("/me/leave", verifyToken, leaveOrganisationAsParticipant); // POST /me/leave
router.get("/invitations/respond", respondToOrganisationInvitation); // GET /invitations/respond
router.get("/invitations/pending", verifyToken, getPendingOrganisationInvitations); // GET /invitations/pending
router.post("/invitations/respond-in-app", verifyToken, respondToOrganisationInvitationInApp); // POST /invitations/respond-in-app
router.get("/status-notifications/pending", verifyToken, getPendingOrganisationStatusNotifications); // GET /status-notifications/pending
router.post("/status-notifications/dismiss", verifyToken, dismissOrganisationStatusNotification); // POST /status-notifications/dismiss

export default router;
