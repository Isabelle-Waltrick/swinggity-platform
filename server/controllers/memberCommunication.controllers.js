import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { sendAdminFeedbackToAdmins, sendMemberContactRequestEmail } from '../mailtrap/emails.js';
import {
    ADMIN_FEEDBACK_MAX_WORDS,
    canContactMember,
    CONTACT_MESSAGE_MAX_WORDS,
    countWords,
    escapeHtml,
    hasBlockingRelationship,
    parseBooleanField,
} from './controllerShared.js';

export const contactMember = async (req, res) => {
    try {
        const senderUserId = String(req.userId || '');
        const { memberId } = req.params;

        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }

        if (senderUserId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot contact yourself' });
        }

        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        const allowEmailContact = parseBooleanField(req.body?.allowEmailContact);
        const allowPhoneContact = parseBooleanField(req.body?.allowPhoneContact);

        if (!message) {
            return res.status(400).json({ success: false, message: 'Please provide a message before sending.' });
        }

        if (countWords(message) > CONTACT_MESSAGE_MAX_WORDS) {
            return res.status(400).json({ success: false, message: `Message must be ${CONTACT_MESSAGE_MAX_WORDS} words or fewer.` });
        }

        if (!allowEmailContact && !allowPhoneContact) {
            return res.status(400).json({ success: false, message: 'Choose at least one contact method.' });
        }

        const [senderUser, senderProfile, targetUser, targetProfile] = await Promise.all([
            User.findById(senderUserId),
            Profile.findOne({ user: senderUserId }),
            User.findById(memberId),
            Profile.findOne({ user: memberId }),
        ]);

        if (!senderUser || !senderProfile || !targetUser || !targetProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }

        if (hasBlockingRelationship(senderProfile, targetProfile, senderUserId, memberId)) {
            return res.status(403).json({ success: false, message: 'You cannot contact this member' });
        }

        if (!canContactMember(senderProfile, targetProfile, senderUserId, memberId, senderUser.role)) {
            return res.status(403).json({ success: false, message: 'This member is not accepting contact requests from you.' });
        }

        const senderDisplayFirstName = (senderProfile.displayFirstName || senderUser.firstName || '').trim();
        const senderDisplayLastName = (senderProfile.displayLastName || senderUser.lastName || '').trim();
        const senderName = `${senderDisplayFirstName} ${senderDisplayLastName}`.trim() || 'Swinggity Member';

        const targetDisplayFirstName = (targetProfile.displayFirstName || targetUser.firstName || '').trim();
        const targetDisplayLastName = (targetProfile.displayLastName || targetUser.lastName || '').trim();
        const targetName = `${targetDisplayFirstName} ${targetDisplayLastName}`.trim() || 'Swinggity Member';

        const senderContactEmail = (senderProfile.contactEmail || senderUser.email || '').trim();
        const senderPhoneNumber = (senderProfile.phoneNumber || '').trim();
        const recipientEmail = (targetProfile.contactEmail || targetUser.email || '').trim();

        if (!recipientEmail) {
            return res.status(400).json({ success: false, message: 'This member does not have a contact email configured.' });
        }

        if (allowEmailContact && !senderContactEmail) {
            return res.status(400).json({ success: false, message: "You haven't provided your email. Please update your profile or use phone contact only." });
        }

        if (allowPhoneContact && !senderPhoneNumber) {
            return res.status(400).json({ success: false, message: "You haven't provided your phone number. Please update your profile or use email contact only." });
        }

        const contactMethods = [];
        if (allowEmailContact) {
            contactMethods.push(`<li><strong>Email:</strong> ${escapeHtml(senderContactEmail)}</li>`);
        }
        if (allowPhoneContact) {
            contactMethods.push(`<li><strong>Phone:</strong> ${escapeHtml(senderPhoneNumber)}</li>`);
        }

        await sendMemberContactRequestEmail({
            recipientEmail,
            recipientName: escapeHtml(targetName),
            senderName: escapeHtml(senderName),
            senderMessage: escapeHtml(message),
            contactMethodsHtml: contactMethods.join(''),
        });

        return res.status(200).json({
            success: true,
            message: 'Your message has been sent.',
        });
    } catch (error) {
        console.log('Error in contactMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const sendAdminFeedback = async (req, res) => {
    try {
        const reporterUserId = String(req.userId || '');
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

        if (!message) {
            return res.status(400).json({ success: false, message: 'Please provide a message before sending.' });
        }

        if (countWords(message) > ADMIN_FEEDBACK_MAX_WORDS) {
            return res.status(400).json({
                success: false,
                message: `Message must be ${ADMIN_FEEDBACK_MAX_WORDS} words or fewer.`,
            });
        }

        const [reporterUser, reporterProfile, adminUsers] = await Promise.all([
            User.findById(reporterUserId),
            Profile.findOne({ user: reporterUserId }),
            User.find({ role: 'admin' }).select('email').lean(),
        ]);

        if (!reporterUser) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const adminEmails = [...new Set(
            (Array.isArray(adminUsers) ? adminUsers : [])
                .map((admin) => String(admin?.email || '').trim())
                .filter(Boolean)
        )];

        if (adminEmails.length === 0) {
            return res.status(500).json({ success: false, message: 'No admin recipients available to receive this feedback.' });
        }

        const reporterDisplayFirstName = (reporterProfile?.displayFirstName || reporterUser.firstName || '').trim();
        const reporterDisplayLastName = (reporterProfile?.displayLastName || reporterUser.lastName || '').trim();
        const reporterName = `${reporterDisplayFirstName} ${reporterDisplayLastName}`.trim() || 'Swinggity Member';

        await sendAdminFeedbackToAdmins({
            adminEmails,
            reporterName: escapeHtml(reporterName),
            reporterEmail: escapeHtml(reporterUser.email || ''),
            reporterUserId: escapeHtml(reporterUserId),
            feedbackMessage: escapeHtml(message),
        });

        return res.status(200).json({
            success: true,
            message: 'Your feedback has been sent.',
        });
    } catch (error) {
        console.log('Error in sendAdminFeedback ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
