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

router.patch('/', verifyToken, updateProfile); // PATCH /
router.post('/avatar', verifyToken, uploadAvatarSingle, uploadAvatar); // POST /avatar
router.delete('/avatar', verifyToken, removeAvatar); // DELETE /avatar
router.delete('/', verifyToken, deleteAccount); // DELETE /

export default router;
