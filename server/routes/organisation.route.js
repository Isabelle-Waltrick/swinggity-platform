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

router.get("/me", verifyToken, getMyOrganisation);
router.get("/me/summary", verifyToken, getMyOrganisationMembershipSummary);
router.patch("/me", verifyToken, upsertMyOrganisation);
router.delete("/me", verifyToken, deleteMyOrganisation);
router.post("/me/image", verifyToken, uploadAvatarSingle, uploadMyOrganisationImage);
router.delete("/me/image", verifyToken, removeMyOrganisationImage);
router.post("/me/leave", verifyToken, leaveOrganisationAsParticipant);
router.get("/invitations/respond", respondToOrganisationInvitation);
router.get("/invitations/pending", verifyToken, getPendingOrganisationInvitations);
router.post("/invitations/respond-in-app", verifyToken, respondToOrganisationInvitationInApp);
router.get("/status-notifications/pending", verifyToken, getPendingOrganisationStatusNotifications);
router.post("/status-notifications/dismiss", verifyToken, dismissOrganisationStatusNotification);

export default router;
