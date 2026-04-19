import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import {
    blockMember,
    getBlockedMembers,
    unblockMember,
} from '../controllers/memberSafety.controllers.js';

const router = express.Router();

router.post('/blocked-members/:memberId', verifyToken, blockMember); // POST /blocked-members/:memberId
router.get('/blocked-members', verifyToken, getBlockedMembers); // GET /blocked-members
router.delete('/blocked-members/:memberId', verifyToken, unblockMember); // DELETE /blocked-members/:memberId

export default router;
