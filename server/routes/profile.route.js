// The code in this file were created with help of AI (Copilot)

import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { uploadAvatarSingle } from '../middleware/avatarUpload.js';
import {
    deleteAccount,
    removeAvatar,
    uploadAvatar,
    updateProfile,
} from '../controllers/profile.controllers.js';

const router = express.Router();

// SSR12: all profile-management routes require verifyToken, which binds operations to the
// authenticated requester identity (req.userId) rather than trusting client-supplied user ids.
// SSR14 (NOT IMPLEMENTED, manage profile): there is currently no authenticated
// profile/password-change endpoint here that requires the current password before
// accepting a new password. Password changes are handled through forgot/reset flow,
// which is still a secure alternative (token-based, time-limited reset verification).
router.patch('/', verifyToken, updateProfile); // PATCH /
router.post('/avatar', verifyToken, uploadAvatarSingle, uploadAvatar); // POST /avatar
router.delete('/avatar', verifyToken, removeAvatar); // DELETE /avatar
router.delete('/', verifyToken, deleteAccount); // DELETE /

export default router;
