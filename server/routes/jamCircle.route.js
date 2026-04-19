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

router.post('/members/:memberId/invite', verifyToken, inviteMemberToJamCircle);
router.get('/circle-invitations/respond', respondToJamCircleInvite);
router.get('/circle-invitations/pending', verifyToken, getPendingCircleInvitations);
router.post('/circle-invitations/respond-in-app', verifyToken, respondToCircleInvitationInApp);
router.get('/profile/jam-circle', verifyToken, getMyJamCircle);
router.delete('/profile/jam-circle/:memberId', verifyToken, removeJamCircleMember);

export default router;
