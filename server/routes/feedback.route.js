// The code in this file were created with help of AI (Copilot)

import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { sendAdminFeedback } from '../controllers/memberCommunication.controllers.js';

const router = express.Router();

router.post('/admins', verifyToken, sendAdminFeedback); // POST /admins

export default router;
