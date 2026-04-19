import { User } from '../models/user.model.js';
import { isAdminRole } from '../utils/rolePermissions.js';
import { deleteAccountDataByUserId } from '../services/accountDeletion.service.js';

export const deleteMemberAccountAsAdmin = async (req, res) => {
    try {
        const adminUserId = String(req.userId || '');
        const { memberId } = req.params;

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (adminUserId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'Use Delete Account to delete your own account' });
        }

        const adminUser = await User.findById(adminUserId).select('role');
        if (!adminUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (!isAdminRole(adminUser.role)) {
            return res.status(403).json({ success: false, message: 'Only admins can delete member accounts' });
        }

        const result = await deleteAccountDataByUserId(memberId);
        if (!result.found) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        return res.status(200).json({ success: true, message: 'Member account deleted successfully' });
    } catch (error) {
        console.log('Error in deleteMemberAccountAsAdmin ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
