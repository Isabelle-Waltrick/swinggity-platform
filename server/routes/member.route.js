import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import {
    getMemberPublicProfile,
    getMembersDiscovery,
    redirectMemberSocialLink,
} from '../controllers/member.controllers.js';
import { updateProfile } from '../controllers/profile.controllers.js';
import { contactMember } from '../controllers/memberCommunication.controllers.js';
import { reportMemberProfile } from '../controllers/memberSafety.controllers.js';
import { deleteMemberAccountAsAdmin } from '../controllers/adminMember.controllers.js';

const router = express.Router();

router.get('/', verifyToken, getMembersDiscovery);
router.get('/:memberId/profile', verifyToken, getMemberPublicProfile);
router.patch('/:memberId/profile', verifyToken, updateProfile);
router.get('/:memberId/social/:platform', verifyToken, redirectMemberSocialLink);
router.post('/:memberId/contact', verifyToken, contactMember);
router.post('/:memberId/report', verifyToken, reportMemberProfile);
router.delete('/:memberId/account', verifyToken, deleteMemberAccountAsAdmin);

export default router;
