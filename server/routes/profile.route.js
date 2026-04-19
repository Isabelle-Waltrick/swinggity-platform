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

router.patch('/', verifyToken, updateProfile);
router.post('/avatar', verifyToken, uploadAvatarSingle, uploadAvatar);
router.delete('/avatar', verifyToken, removeAvatar);
router.delete('/', verifyToken, deleteAccount);

export default router;
