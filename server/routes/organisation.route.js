import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { uploadAvatarSingle } from "../middleware/avatarUpload.js";
import {
    getMyOrganisation,
    upsertMyOrganisation,
    uploadMyOrganisationImage,
    removeMyOrganisationImage,
} from "../controllers/organisation.controllers.js";

const router = express.Router();

router.get("/me", verifyToken, getMyOrganisation);
router.patch("/me", verifyToken, upsertMyOrganisation);
router.post("/me/image", verifyToken, uploadAvatarSingle, uploadMyOrganisationImage);
router.delete("/me/image", verifyToken, removeMyOrganisationImage);

export default router;
