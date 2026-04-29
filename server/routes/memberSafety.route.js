// The code in this file were created with help of AI (Copilot)

/**
 * Member safety route guide.
 * Sort of traffic controller for member safety HTTP requests.
 * It decides the order of middleware checks and which controller handles each path.
 */

import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import {
    blockMember,
    getBlockedMembers,
    unblockMember,
} from '../controllers/memberSafety.controllers.js';

const router = express.Router();

// Blocks another member from the member safety flow and calls blockMember.
router.post('/blocked-members/:memberId', verifyToken, blockMember);
// Loads the current user's blocked member list and calls getBlockedMembers.
router.get('/blocked-members', verifyToken, getBlockedMembers);
// Removes a member from the current user's blocked list and calls unblockMember.
router.delete('/blocked-members/:memberId', verifyToken, unblockMember);

export default router;
