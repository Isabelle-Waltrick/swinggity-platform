// Import the configured Mailtrap client and sender information
import { mailtrapClient, sender } from "./mailtrap.config.js";
// Import the HTML email templates
import {
	VERIFICATION_EMAIL_TEMPLATE,
	PASSWORD_RESET_REQUEST_TEMPLATE,
	PASSWORD_RESET_SUCCESS_TEMPLATE,
	JAM_CIRCLE_INVITE_TEMPLATE,
	ORGANISER_VERIFICATION_REQUEST_TEMPLATE,
	MEMBER_CONTACT_REQUEST_TEMPLATE,
	CO_HOST_INVITE_TEMPLATE,
	ORGANISATION_PARTICIPANT_INVITE_TEMPLATE,
} from "./emailTemplates.js";

// Async function to send verification email to newly registered users
// Parameters: email (recipient address), verificationToken (6-char cryptographic code)
export const sendVerificationEmail = async (email, verificationToken) => {
	// Format recipient as array of objects (required by Mailtrap API)
	const recipient = [{ email }];

	try {
		// Send email via Mailtrap API with template and dynamic token replacement
		const response = await mailtrapClient.send({
			from: sender, // Sender info from config (no-reply@swinggity.com)
			to: recipient, // Recipient email address
			subject: "Verify your email", // Email subject line
			html: VERIFICATION_EMAIL_TEMPLATE.replace("{verificationCode}", verificationToken), // HTML body with token inserted
			category: "Email Verification", // // Category tag for Mailtrap dashboard
		});
		// Log successful email transmission with API response for debugging
		console.log("Email sent successfully", response);
	} catch (error) {
		// Log email sending errors for debugging and monitoring
		console.error(`Error sending verification`, error);
		// Propagate error to calling function (signup controller) for proper error handling
		throw new Error(`Error sending verification email: ${error}`);
	}
};

// Async function to send welcome email to newly registered users
export const sendWelcomeEmail = async (email, firstName) => {
	const recipient = [{ email }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			template_uuid: "32671f07-33a1-4943-8b3f-332e04ae2f91",
			template_variables: {
				company_info_name: "Swinggity",
				firstName: firstName, // name of the registered user
			},
		});
		// Log successful email transmission with API response for debugging
		console.log("Welcome email sent successfully", response);
	} catch (error) {
		console.error(`Error sending welcome email`, error);
		throw new Error(`Error sending welcome email: ${error}`);
	}
};

// HTML email template for password reset requests
export const sendPasswordResetEmail = async (email, resetURL) => {
	const recipient = [{ email }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: "Reset your password",
			html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL),
			category: "Password Reset",
		});
	} catch (error) {
		console.error(`Error sending password reset email`, error);

		throw new Error(`Error sending password reset email: ${error}`);
	}
};

// HTML email template for password reset success notification
export const sendResetSuccessEmail = async (email) => {
	// Format recipient as array of objects (required by Mailtrap API)
	const recipient = [{ email }];

	try {
		// Send email via Mailtrap API with template
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: "Password Reset Successful",
			html: PASSWORD_RESET_SUCCESS_TEMPLATE,
			category: "Password Reset",
		});
		// Log successful email transmission with API response for debugging
		console.log("Password reset email sent successfully", response);
		// catch any errors during the process
	} catch (error) {
		console.error(`Error sending password reset success email`, error);

		throw new Error(`Error sending password reset success email: ${error}`);
	}
};

export const sendJamCircleInviteEmail = async (email, inviterName, inviterAvatarUrl, acceptUrl, denyUrl) => {
	const recipient = [{ email }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: `${inviterName} invited you to join their Jam Circle`,
			html: JAM_CIRCLE_INVITE_TEMPLATE
				.replaceAll("{inviterName}", inviterName)
				.replace("{inviterAvatarUrl}", inviterAvatarUrl)
				.replace("{acceptUrl}", acceptUrl)
				.replace("{denyUrl}", denyUrl),
			category: "Jam Circle Invite",
		});

		console.log("Jam circle invite email sent successfully", response);
	} catch (error) {
		console.error("Error sending jam circle invite email", error);
		throw new Error(`Error sending jam circle invite email: ${error}`);
	}
};

export const sendOrganiserVerificationRequestEmail = async ({ requesterName, requesterMessage, contactMethodsHtml }) => {
	const recipient = [{ email: "swinggity.team@gmail.com" }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: `New organiser verification request from ${requesterName}`,
			html: ORGANISER_VERIFICATION_REQUEST_TEMPLATE
				.replace("{requesterName}", requesterName)
				.replace("{requesterMessage}", requesterMessage)
				.replace("{contactMethods}", contactMethodsHtml),
			category: "Organiser Verification",
		});

		console.log("Organiser verification request email sent successfully", response);
	} catch (error) {
		console.error("Error sending organiser verification request email", error);
		throw new Error(`Error sending organiser verification request email: ${error}`);
	}
};

export const sendMemberContactRequestEmail = async ({ recipientEmail, recipientName, senderName, senderMessage, contactMethodsHtml }) => {
	const recipient = [{ email: recipientEmail }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: `New message from ${senderName} on Swinggity`,
			html: MEMBER_CONTACT_REQUEST_TEMPLATE
				.replaceAll("{recipientName}", recipientName)
				.replaceAll("{senderName}", senderName)
				.replace("{senderMessage}", senderMessage)
				.replace("{contactMethods}", contactMethodsHtml),
			category: "Member Contact",
		});

		console.log("Member contact request email sent successfully", response);
	} catch (error) {
		console.error("Error sending member contact request email", error);
		throw new Error(`Error sending member contact request email: ${error}`);
	}
};

export const sendCoHostInviteEmail = async ({ recipientEmail, inviterName, inviterAvatarUrl, eventTitle, coHostDisplayName = "you", acceptUrl, denyUrl }) => {
	const recipient = [{ email: recipientEmail }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: `${inviterName} invited ${coHostDisplayName} to co-host ${eventTitle}`,
			html: CO_HOST_INVITE_TEMPLATE
				.replaceAll("{inviterName}", inviterName)
				.replace("{inviterAvatarUrl}", inviterAvatarUrl)
				.replace("{eventTitle}", eventTitle)
				.replace("{coHostDisplayName}", coHostDisplayName)
				.replace("{acceptUrl}", acceptUrl)
				.replace("{denyUrl}", denyUrl),
			category: "Event Co-host Invite",
		});

		console.log("Co-host invite email sent successfully", response);
	} catch (error) {
		console.error("Error sending co-host invite email", error);
		throw new Error(`Error sending co-host invite email: ${error}`);
	}
};

export const sendOrganisationParticipantInviteEmail = async ({ recipientEmail, inviterName, inviterAvatarUrl, organisationName, acceptUrl, denyUrl }) => {
	const recipient = [{ email: recipientEmail }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: `${inviterName} invited you to join ${organisationName}`,
			html: ORGANISATION_PARTICIPANT_INVITE_TEMPLATE
				.replaceAll("{inviterName}", inviterName)
				.replace("{inviterAvatarUrl}", inviterAvatarUrl)
				.replaceAll("{organisationName}", organisationName)
				.replace("{acceptUrl}", acceptUrl)
				.replace("{denyUrl}", denyUrl),
			category: "Organisation Participant Invite",
		});

		console.log("Organisation participant invite email sent successfully", response);
	} catch (error) {
		console.error("Error sending organisation participant invite email", error);
		throw new Error(`Error sending organisation participant invite email: ${error}`);
	}
};
