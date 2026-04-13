// importing express framework
import express from 'express';
// importing controller functions for auth operations
import { signup, login, logout, verify, verifyEmail, forgotPassword, resetPassword, updateProfile, removeAvatar, deleteAccount, getMembersDiscovery, redirectMemberSocialLink, getMemberPublicProfile, inviteMemberToJamCircle, respondToJamCircleInvite, getMyJamCircle, getPendingCircleInvitations, respondToCircleInvitationInApp, removeJamCircleMember, blockMember, getBlockedMembers, unblockMember, contactMember } from '../controllers/auth.controllers.js';
// importing middleware to verify JWT tokens
import { verifyToken } from "../middleware/verifyToken.js";
import { uploadAvatarSingle } from '../middleware/avatarUpload.js';
import { uploadAvatar } from '../controllers/auth.controllers.js';
// importing rate limiters to prevent brute force and DoS attacks
import {
    signupLimiter,
    loginLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    verifyEmailLimiter
} from "../middleware/rateLimiter.js";

// create a router instance for authentication routes
const router = express.Router();

// verify JWT token for protected routes
router.get("/verify", verifyToken, verify);

// PATCH route for authenticated user profile updates
router.patch("/profile", verifyToken, updateProfile);

// GET route for members discovery data, filtered by each member's privacy settings
router.get('/members', verifyToken, getMembersDiscovery);

// GET route for a member's public profile payload
router.get('/members/:memberId/profile', verifyToken, getMemberPublicProfile);

// POST route to send a jam circle invitation to another member
router.post('/members/:memberId/invite', verifyToken, inviteMemberToJamCircle);

// GET route to respond to an email invitation (accept or deny)
router.get('/circle-invitations/respond', respondToJamCircleInvite);

// GET route for authenticated user's jam circle members
router.get('/profile/jam-circle', verifyToken, getMyJamCircle);

// DELETE route to remove one user from authenticated user's jam circle
router.delete('/profile/jam-circle/:memberId', verifyToken, removeJamCircleMember);

// POST route to block a member and remove any existing circle/invitation relationship
router.post('/profile/blocked-members/:memberId', verifyToken, blockMember);

// GET route for authenticated user's blocked members list
router.get('/profile/blocked-members', verifyToken, getBlockedMembers);

// DELETE route to unblock a previously blocked member
router.delete('/profile/blocked-members/:memberId', verifyToken, unblockMember);

// GET route for authenticated user's pending circle invitations
router.get('/circle-invitations/pending', verifyToken, getPendingCircleInvitations);

// POST route to respond to circle invitation in-app (accept/deny)
router.post('/circle-invitations/respond-in-app', verifyToken, respondToCircleInvitationInApp);

// GET route to open a member social link through a server-side validated redirect
router.get('/members/:memberId/social/:platform', verifyToken, redirectMemberSocialLink);

// POST route to send a contact message to a member
router.post('/members/:memberId/contact', verifyToken, contactMember);

// POST route for authenticated user avatar upload
router.post('/profile/avatar', verifyToken, uploadAvatarSingle, uploadAvatar);

// DELETE route for authenticated user avatar removal
router.delete('/profile/avatar', verifyToken, removeAvatar);

// DELETE route for authenticated user account removal
router.delete('/profile', verifyToken, deleteAccount);

// POST route for user signup/registration (rate limited: 5 attempts per 15 min)
router.post('/signup', signupLimiter, signup);

// POST route for user login (rate limited: 5 attempts per 15 min)
router.post('/login', loginLimiter, login);

// POST route for user logout (no rate limit needed)
router.post('/logout', logout);

// POST route for email verification (rate limited: 5 attempts per 15 min)
router.post('/verify-email', verifyEmailLimiter, verifyEmail);

// POST route for password reset request (rate limited: 3 attempts per 15 min)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

// POST route for password reset (rate limited: 5 attempts per 15 min)
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);

// Export the router to be used in main application
export default router;