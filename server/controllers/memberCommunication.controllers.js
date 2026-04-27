import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { sendAdminFeedbackToAdmins, sendMemberContactRequestEmail } from '../mailtrap/emails.js';
import {
    ADMIN_FEEDBACK_MAX_WORDS,
    CONTACT_MESSAGE_MAX_WORDS,
} from '../constants/memberRules.constants.js';
import {
    canContactMember,
    hasBlockingRelationship,
} from '../utils/memberPrivacy.utils.js';
import {
    countWords,
    escapeHtml,
    parseBooleanField,
} from '../utils/formatters.utils.js';

/**
 * contactMember:
 * Validates a member-to-member contact request and sends the message using the
 * recipient's allowed contact channels.
 */
export const contactMember = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        // Extract sender identity and target recipient id from the request.
        const senderUserId = String(req.userId || '');
        const { memberId } = req.params;
        // Reject malformed member ids before doing any database work.
        if (!/^[a-f\d]{24}$/i.test(memberId)) {
            return res.status(400).json({ success: false, message: 'Invalid member id' });
        }
        // Prevent self-contact requests.
        if (senderUserId === String(memberId)) {
            return res.status(400).json({ success: false, message: 'You cannot contact yourself' });
        }
        // Normalize message text and contact-channel checkboxes from the request body.
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        const allowEmailContact = parseBooleanField(req.body?.allowEmailContact);
        const allowPhoneContact = parseBooleanField(req.body?.allowPhoneContact);
        // A request must include some message content.
        if (!message) {
            return res.status(400).json({ success: false, message: 'Please provide a message before sending.' });
        }
        // Enforce the configured word-count limit before attempting delivery.
        if (countWords(message) > CONTACT_MESSAGE_MAX_WORDS) {
            return res.status(400).json({ success: false, message: `Message must be ${CONTACT_MESSAGE_MAX_WORDS} words or fewer.` });
        }
        // At least one contact method must be offered to the recipient.
        if (!allowEmailContact && !allowPhoneContact) {
            return res.status(400).json({ success: false, message: 'Choose at least one contact method.' });
        }
        // Load sender/recipient account + profile data together for permission and contact checks.
        const [senderUser, senderProfile, targetUser, targetProfile] = await Promise.all([
            User.findById(senderUserId),
            Profile.findOne({ user: senderUserId }),
            User.findById(memberId),
            Profile.findOne({ user: memberId }),
        ]);
        // Both sender and recipient must exist to proceed.
        if (!senderUser || !senderProfile || !targetUser || !targetProfile) {
            return res.status(404).json({ success: false, message: 'Member not available' });
        }
        // Block contact when either side has blocked the other.
        if (hasBlockingRelationship(senderProfile, targetProfile, senderUserId, memberId)) {
            return res.status(403).json({ success: false, message: 'You cannot contact this member' });
        }
        // Respect recipient privacy/contact settings.
        if (!canContactMember(senderProfile, targetProfile, senderUserId, memberId, senderUser.role)) {
            return res.status(403).json({ success: false, message: 'This member is not accepting contact requests from you.' });
        }
        // Build sender display name using profile overrides first, then account defaults.
        const senderDisplayFirstName = (senderProfile.displayFirstName || senderUser.firstName || '').trim();
        const senderDisplayLastName = (senderProfile.displayLastName || senderUser.lastName || '').trim();
        const senderName = `${senderDisplayFirstName} ${senderDisplayLastName}`.trim() || 'Swinggity Member';

        // Build recipient display name for the outgoing email template.
        const targetDisplayFirstName = (targetProfile.displayFirstName || targetUser.firstName || '').trim();
        const targetDisplayLastName = (targetProfile.displayLastName || targetUser.lastName || '').trim();
        const targetName = `${targetDisplayFirstName} ${targetDisplayLastName}`.trim() || 'Swinggity Member';

        // Pull sender contact details and recipient destination email from profile/account data.
        const senderContactEmail = (senderProfile.contactEmail || senderUser.email || '').trim();
        const senderPhoneNumber = (senderProfile.phoneNumber || '').trim();
        const recipientEmail = (targetProfile.contactEmail || targetUser.email || '').trim();

        // Recipient must have an email destination because delivery happens by email.
        if (!recipientEmail) {
            return res.status(400).json({ success: false, message: 'This member does not have a contact email configured.' });
        }
        // If the sender offers email contact, ensure an email address exists to share.
        if (allowEmailContact && !senderContactEmail) {
            return res.status(400).json({ success: false, message: "You haven't provided your email. Please update your profile or use phone contact only." });
        }
        // If the sender offers phone contact, ensure a phone number exists to share.
        if (allowPhoneContact && !senderPhoneNumber) {
            return res.status(400).json({ success: false, message: "You haven't provided your phone number. Please update your profile or use email contact only." });
        }
        // Build the HTML list of contact methods to embed in the outgoing message.
        const contactMethods = [];
        if (allowEmailContact) {
            contactMethods.push(`<li><strong>Email:</strong> ${escapeHtml(senderContactEmail)}</li>`);
        }
        if (allowPhoneContact) {
            contactMethods.push(`<li><strong>Phone:</strong> ${escapeHtml(senderPhoneNumber)}</li>`);
        }
        // Escape user-supplied content before handing it to the email template.
        await sendMemberContactRequestEmail({
            recipientEmail,
            recipientName: escapeHtml(targetName),
            senderName: escapeHtml(senderName),
            senderMessage: escapeHtml(message),
            contactMethodsHtml: contactMethods.join(''),
        });
        // If we made it this far, the message was sent successfully!
        return res.status(200).json({
            success: true,
            message: 'Your message has been sent.',
        });
    } catch (error) {
        console.log('Error in contactMember ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * sendAdminFeedback:
 * Validates a feedback message from the current user and delivers it to all
 * admin email recipients.
 */
export const sendAdminFeedback = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const reporterUserId = String(req.userId || '');
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

        // Feedback submissions must contain some message content.
        if (!message) {
            return res.status(400).json({ success: false, message: 'Please provide a message before sending.' });
        }

        // Enforce the configured feedback word-count limit.
        if (countWords(message) > ADMIN_FEEDBACK_MAX_WORDS) {
            return res.status(400).json({
                success: false,
                message: `Message must be ${ADMIN_FEEDBACK_MAX_WORDS} words or fewer.`,
            });
        }

        // Load reporter identity plus admin email recipients in parallel.
        const [reporterUser, reporterProfile, adminUsers] = await Promise.all([
            User.findById(reporterUserId),
            Profile.findOne({ user: reporterUserId }),
            User.find({ role: 'admin' }).select('email').lean(),
        ]);

        if (!reporterUser) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Deduplicate and normalize admin email addresses before delivery.
        const adminEmails = [...new Set(
            (Array.isArray(adminUsers) ? adminUsers : [])
                .map((admin) => String(admin?.email || '').trim())
                .filter(Boolean)
        )];

        // Fail loudly if there is nowhere to send the feedback.
        if (adminEmails.length === 0) {
            return res.status(500).json({ success: false, message: 'No admin recipients available to receive this feedback.' });
        }

        // Build reporter display name using profile overrides first, then account defaults.
        const reporterDisplayFirstName = (reporterProfile?.displayFirstName || reporterUser.firstName || '').trim();
        const reporterDisplayLastName = (reporterProfile?.displayLastName || reporterUser.lastName || '').trim();
        const reporterName = `${reporterDisplayFirstName} ${reporterDisplayLastName}`.trim() || 'Swinggity Member';

        // Escape user-supplied content before passing it into the admin email template.
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
