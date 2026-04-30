// The code in this file were created with help of AI (Copilot)

import { User } from '../models/user.model.js';
import { buildUserWithProfilePayload } from '../serializers/memberPayloads.serializer.js';
import { canDeleteMemberAccountAsAdmin } from '../utils/rolePermissions.js';
import { deleteUserAndRelatedDataByUserId } from '../services/accountDeletion.service.js';
import { canUpdateMemberRole } from '../utils/rolePermissions.js';
import { validateMemberRoleUpdatePayload } from '../validators/profile.validator.js';

/**
 * deleteMemberAccountAsAdmin: handles this function's core responsibility.
 */
export const deleteMemberAccountAsAdmin = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const adminUserId = String(req.userId || '');
        const { memberId } = req.params;
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (adminUserId === String(memberId)) {
            // Keeps intent clear: self-deletion has its own endpoint and cookie cleanup flow.
            return res.status(400).json({ success: false, message: 'Use Delete Account to delete your own account' });
        }

        const adminUser = await User.findById(adminUserId).select('role');
        if (!adminUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (!canDeleteMemberAccountAsAdmin(adminUser.role)) {
            return res.status(403).json({ success: false, message: 'Only admins can delete member accounts' });
        }

        const result = await deleteUserAndRelatedDataByUserId(memberId);
        if (!result.found) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        return res.status(200).json({ success: true, message: 'Member account deleted successfully' });
    } catch (error) {
        console.log('Error in deleteMemberAccountAsAdmin ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * updateMemberRoleAsAdmin: handles this function's core responsibility.
 */
export const updateMemberRoleAsAdmin = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const adminUserId = String(req.userId || '');
        const { memberId } = req.params;
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        const adminUser = await User.findById(adminUserId).select('role'); // DBSR04: only role is needed for the permission check
        if (!adminUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (!canUpdateMemberRole(adminUser.role)) {
            return res.status(403).json({ success: false, message: 'Only admins can update member roles' });
        }

        // We reuse the shared role sanitizer so accepted values stay consistent everywhere.
        const validationResult = validateMemberRoleUpdatePayload(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ success: false, message: validationResult.error });
        }

        const targetUser = await User.findById(memberId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        const currentRole = String(targetUser.role || '').trim().toLowerCase();
        const nextRole = validationResult.validatedRole.value;
        // Avoid no-op writes so callers get clear feedback when nothing changes.
        if (nextRole === currentRole) {
            return res.status(400).json({ success: false, message: 'No role change requested' });
        }

        targetUser.role = nextRole;
        await targetUser.save();

        return res.status(200).json({
            success: true,
            message: 'Member role updated successfully',
            updatedMember: await buildUserWithProfilePayload(targetUser),
            updatedMemberRole: nextRole,
        });
    } catch (error) {
        console.log('Error in updateMemberRoleAsAdmin ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
