// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Admin Service Guide
 * This service handles organiser verification request business logic.
 * It keeps admin-oriented workflow behavior out of route/controller glue code.
 */

import { sendOrganiserVerificationRequestEmail } from "../mailtrap/emails.js";
import { CONTACT_MESSAGE_MAX_WORDS } from "../constants/calendar.constants.js";
import { Profile } from "../models/profile.model.js";
import { canSubmitOrganiserVerificationRequest } from "../utils/rolePermissions.js";
import {
    asTrimmedString,
    countWords,
    escapeHtml,
    parseBooleanField,
} from "../validators/calendar.utils.js";

export const submitOrganiserVerificationRequestService = async ({ user, body }) => {
    if (!canSubmitOrganiserVerificationRequest(user.role)) {
        return {
            status: 400,
            body: {
                success: false,
                message: "Organiser and admin users can already publish events.",
            },
        };
    }

    const message = asTrimmedString(body?.message);
    const allowEmailContact = parseBooleanField(body?.allowEmailContact);
    const allowPhoneContact = parseBooleanField(body?.allowPhoneContact);

    if (!message) {
        return {
            status: 400,
            body: { success: false, message: "Please provide a message before sending your request." },
        };
    }

    if (countWords(message) > CONTACT_MESSAGE_MAX_WORDS) {
        return {
            status: 400,
            body: { success: false, message: `Message must be ${CONTACT_MESSAGE_MAX_WORDS} words or fewer.` },
        };
    }

    if (!allowEmailContact && !allowPhoneContact) {
        return {
            status: 400,
            body: { success: false, message: "Choose at least one contact method." },
        };
    }

    const profile = await Profile.findOne({ user: user._id }).lean();
    const profilePhoneNumber = asTrimmedString(profile?.phoneNumber);
    const profileEmail = asTrimmedString(profile?.contactEmail);
    const accountEmail = asTrimmedString(user.email);
    const resolvedEmail = profileEmail || accountEmail;

    if (allowPhoneContact && !profilePhoneNumber) {
        return {
            status: 400,
            body: {
                success: false,
                message: "You haven't provided your phone number. Please add your phone number on your profile edit or select Email",
            },
        };
    }

    if (allowEmailContact && !resolvedEmail) {
        return {
            status: 400,
            body: {
                success: false,
                message: "You haven't provided your email. Please add your email on your profile edit or select Phone Number",
            },
        };
    }

    const displayFirstName = asTrimmedString(profile?.displayFirstName) || asTrimmedString(user.firstName);
    const displayLastName = asTrimmedString(profile?.displayLastName) || asTrimmedString(user.lastName);
    const requesterName = `${displayFirstName} ${displayLastName}`.trim() || resolvedEmail || "Swinggity user";

    const contactMethods = [];
    if (allowEmailContact) {
        contactMethods.push(`<li><strong>Email:</strong> ${escapeHtml(resolvedEmail)}</li>`);
    }
    if (allowPhoneContact) {
        contactMethods.push(`<li><strong>Phone Number:</strong> ${escapeHtml(profilePhoneNumber)}</li>`);
    }

    await sendOrganiserVerificationRequestEmail({
        requesterName: escapeHtml(requesterName),
        requesterMessage: escapeHtml(message).replaceAll("\n", "<br />"),
        contactMethodsHtml: contactMethods.join(""),
    });

    return {
        status: 200,
        body: {
            success: true,
            message: "Request sent successfully.",
        },
    };
};
