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
import { deleteMemberAccountAsAdmin, updateMemberRoleAsAdmin } from '../controllers/adminMember.controllers.js';

const router = express.Router();

router.get('/', verifyToken, getMembersDiscovery); // GET / - Get members discovery page
router.get('/:memberId/profile', verifyToken, getMemberPublicProfile); // GET /:memberId/profile
router.patch('/:memberId/profile', verifyToken, updateProfile); // PATCH /:memberId/profile
router.get('/:memberId/social/:platform', verifyToken, redirectMemberSocialLink); // GET /:memberId/social/:platform
router.post('/:memberId/contact', verifyToken, contactMember); // POST /:memberId/contact
router.post('/:memberId/report', verifyToken, reportMemberProfile); // POST /:memberId/report
router.patch('/:memberId/role', verifyToken, updateMemberRoleAsAdmin); // PATCH /:memberId/role
router.delete('/:memberId/account', verifyToken, deleteMemberAccountAsAdmin); // DELETE /:memberId/account

export default router;
