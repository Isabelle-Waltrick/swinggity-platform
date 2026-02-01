// Import the configured Mailtrap client and sender information
import { mailtrapClient, sender } from "./mailtrap.config.js";
// Import the HTML email template containing the verification code placeholder
import { VERIFICATION_EMAIL_TEMPLATE } from "./emailTemplates.js";

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
				name: firstName, // name of the registered user
			},
		});
		// Log successful email transmission with API response for debugging
		console.log("Welcome email sent successfully", response);
	} catch (error) {
		console.error(`Error sending welcome email`, error);
		throw new Error(`Error sending welcome email: ${error}`);
	}
};