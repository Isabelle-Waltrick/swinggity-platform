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

router.post('/members/:memberId/invite', verifyToken, inviteMemberToJamCircle); // POST /members/:memberId/invite
router.get('/circle-invitations/respond', respondToJamCircleInvite); // GET /circle-invitations/respond
router.get('/circle-invitations/pending', verifyToken, getPendingCircleInvitations); // GET /circle-invitations/pending
router.post('/circle-invitations/respond-in-app', verifyToken, respondToCircleInvitationInApp); // POST /circle-invitations/respond-in-app
router.get('/profile/jam-circle', verifyToken, getMyJamCircle); // GET /profile/jam-circle
router.delete('/profile/jam-circle/:memberId', verifyToken, removeJamCircleMember); // DELETE /profile/jam-circle/:memberId

export default router;
