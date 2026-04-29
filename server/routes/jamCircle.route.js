// The code in this file were created with help of AI (Copilot)

import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import {
    getMyJamCircle,
    getPendingCircleInvitations,
    inviteMemberToJamCircle,
    removeJamCircleMember,
    respondToCircleInvitationInApp,
    respondToJamCircleInvite,
} from '../controllers/jamCircle.controllers.js';

const router = express.Router();

// Sends a jam circle invitation to another member — the current user (via verifyToken) is inviting the target member
router.post('/members/:memberId/invite', verifyToken, inviteMemberToJamCircle);

// Handles external email link responses — allows unauthenticated users to accept/decline invitation via emailed token in query params
router.get('/circle-invitations/respond', respondToJamCircleInvite);

// Fetches all pending jam circle invitations the current user has received (awaiting accept/decline)
router.get('/circle-invitations/pending', verifyToken, getPendingCircleInvitations);

// Processes in-app invite response — the current user accepts or declines a pending invitation from within the app
router.post('/circle-invitations/respond-in-app', verifyToken, respondToCircleInvitationInApp);

// Retrieves the current user's jam circle — lists all members they've successfully added to their circle
router.get('/profile/jam-circle', verifyToken, getMyJamCircle);

// Removes a member from the current user's jam circle — permanently deletes the circle relationship
router.delete('/profile/jam-circle/:memberId', verifyToken, removeJamCircleMember);

export default router;
