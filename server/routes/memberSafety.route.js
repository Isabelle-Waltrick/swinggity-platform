import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import {
    blockMember,
    getBlockedMembers,
    unblockMember,
} from '../controllers/memberSafety.controllers.js';

const router = express.Router();

router.post('/blocked-members/:memberId', verifyToken, blockMember);
router.get('/blocked-members', verifyToken, getBlockedMembers);
router.delete('/blocked-members/:memberId', verifyToken, unblockMember);

export default router;
