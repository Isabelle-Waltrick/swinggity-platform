// The code in this file were created with help of AI (Copilot)

/**
 * Member route guide.
 * Sort of traffic controller for member HTTP requests.
 * It decides the order of middleware checks and which controller handles each path.
 */

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

// Loads the member discovery page and calls getMembersDiscovery after auth succeeds.
router.get('/', verifyToken, getMembersDiscovery);
// Loads a public member profile page and calls getMemberPublicProfile for the selected member id.
router.get('/:memberId/profile', verifyToken, getMemberPublicProfile);
// Submits profile updates for the selected member profile and calls updateProfile.
router.patch('/:memberId/profile', verifyToken, updateProfile);
// Redirects the user to a member's social link and calls redirectMemberSocialLink.
router.get('/:memberId/social/:platform', verifyToken, redirectMemberSocialLink);
// Submits a contact request to another member and calls contactMember.
router.post('/:memberId/contact', verifyToken, contactMember);
// Submits a report about a member profile and calls reportMemberProfile.
router.post('/:memberId/report', verifyToken, reportMemberProfile);
// Updates a member's role from the admin flow and calls updateMemberRoleAsAdmin.
router.patch('/:memberId/role', verifyToken, updateMemberRoleAsAdmin);
// Deletes a member account from the admin flow and calls deleteMemberAccountAsAdmin.
router.delete('/:memberId/account', verifyToken, deleteMemberAccountAsAdmin);

export default router;
