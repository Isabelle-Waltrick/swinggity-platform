import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { sendAdminFeedback } from '../controllers/memberCommunication.controllers.js';

const router = express.Router();

router.post('/admins', verifyToken, sendAdminFeedback);

export default router;
