// The code in this file were created with help of AI (Copilot)

import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { clearCsrfSecretCookie } from '../utils/csrf.js';
import { getBaseCookieOptions } from '../utils/cookieOptions.js';
import { generateTokenAndSetCookie } from '../utils/generateTokenAndSetCookie.js';
import {
    sendPasswordResetEmail,
    sendResetSuccessEmail,
    sendVerificationEmail,
    sendWelcomeEmail,
} from '../mailtrap/emails.js';
import { buildUserWithProfilePayload } from '../serializers/memberPayloads.serializer.js';
import { validateEmail, validateName, validatePassword } from '../validators/auth.validators.js';

/**
 * signup:
 * Creates a new user account and its related profile record. The flow validates input,
 * enforces password policy, prevents duplicate emails, hashes the password, and issues
 * an email verification token so account activation can happen in a separate step.
 */
export const signup = async (req, res) => {
    // We pull the expected signup fields from the request body up front.
    const { email, password, firstName, lastName } = req.body;

    try {
        // If any required field is missing, we stop early and return field-specific feedback.
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
                errors: {
                    email: !email ? 'Email is required' : null,
                    password: !password ? 'Password is required' : null,
                    firstName: !firstName ? 'First name is required' : null,
                    lastName: !lastName ? 'Last name is required' : null,
                },
            });
        }

        // Normalize and validate the email before touching the database.
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: emailValidation.error,
                errors: { email: emailValidation.error },
            });
        }

        // Validate first name and last name independently so the UI can show precise errors.
        const firstNameValidation = validateName(firstName, 'First name');
        if (!firstNameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: firstNameValidation.error,
                errors: { firstName: firstNameValidation.error },
            });
        }
        // Validate last name with the same rules as first name.
        const lastNameValidation = validateName(lastName, 'Last name');
        if (!lastNameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: lastNameValidation.error,
                errors: { lastName: lastNameValidation.error },
            });
        }

        // SSR15: registration password quality baseline is enforced here via
        // validatePassword(). The same validator is reused in password-change flows.
        // Enforce password policy before we hash anything.
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Password does not meet requirements',
                errors: { password: passwordValidation.errors },
            });
        }

        // Check whether this email already exists to avoid duplicate accounts.
        const userAlreadyExists = await User.findOne({ email: emailValidation.email });
        if (userAlreadyExists) {
            console.log(`Signup attempt for existing email: ${emailValidation.email}`);
            return res.status(400).json({
                success: false,
                message: 'Unable to create account. Please check your information or try a different email.',
            });
        }

        // SSR05: passwords are stored using bcrypt (approved adaptive password hashing).
        // Plain-text passwords are never persisted to the database.
        // Hash the password and generate a 6-digit verification code for email confirmation.
        const hashedPassword = await bcryptjs.hash(password, 10);
        // Using crypto.randomInt to generate a secure 6-digit code, then padding with zeros if necessary to ensure it's always 6 digits.
        const verificationToken = crypto.randomInt(0, 1000000).toString().padStart(6, '0');

        // Create the user with verification metadata.
        const user = new User({
            email: emailValidation.email,
            password: hashedPassword,
            firstName: firstNameValidation.name,
            lastName: lastNameValidation.name,
            role: 'regular',
            verificationToken,
            verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });

        // Persist user and create a matching profile document so downstream features can rely on it.
        await user.save();
        await Profile.create({
            user: user._id,
            displayFirstName: firstNameValidation.name,
            displayLastName: lastNameValidation.name,
        });

        // Send verification email. We do not create a login session until email verification is complete.
        await sendVerificationEmail(user.email, verificationToken);

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        console.log('Error in signup ', error);
        // GSR13: all validation failures are handled with early returns above; this catch
        // only fires on unexpected infrastructure errors (DB, bcrypt, email). A generic
        // message is returned so no stack trace, query, or internal detail is exposed.
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * verifyEmail:
 * Completes account activation by validating the submitted 6-digit verification code.
 * If the token is valid and unexpired, the account is marked verified, verification
 * fields are cleared to enforce single use, and a welcome email is dispatched.
 */
export const verifyEmail = async (req, res) => {
    // Grab the submitted verification code from the request body.
    const { code } = req.body;
    try {
        // Reject empty or missing codes before querying Mongo.
        if (!code || typeof code !== 'string' || code.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Verification code is required',
            });
        }

        // Accept only 6-digit numeric tokens to match what signup generates.
        const sanitizedCode = code.trim();
        if (!/^\d{6}$/.test(sanitizedCode)) {
            return res.status(400).json({
                success: false,
                message: 'Verification code must be a 6-digit number',
            });
        }

        // Find a user with a matching, non-expired verification token.
        const user = await User.findOne({
            verificationToken: sanitizedCode,
            verificationTokenExpiresAt: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
        }

        // Mark the account verified and clear token fields so the code cannot be reused.
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        await user.save();

        // Send the welcome message after verification succeeds.
        await sendWelcomeEmail(user.email, user.firstName);

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        console.log('error in verifyEmail ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * login:
 * Authenticates a user and initializes a browser session. The handler validates input,
 * verifies credentials against the stored password hash, enforces email verification,
 * and then sets the auth cookie token used by protected routes.
 */
export const login = async (req, res) => {
    // Pull credentials from the request body.
    const { email, password } = req.body;
    try {
        // Require both fields before we run any expensive checks.
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }

        // Normalize and validate email format first.
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            // SSR09: login returns the same generic error used for unknown users and wrong
            // passwords, reducing account-existence leakage through login error messages.
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Look up user by normalized email.
        const user = await User.findOne({ email: emailValidation.email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // SSR05: login verifies bcrypt hash output rather than comparing plain-text values.
        // Compare the provided password with the stored hash.
        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Require email verification before creating an authenticated session.
        if (!user.isVerified) {
            // SSR09: this branch intentionally returns the same generic response as other
            // login failures so attackers cannot infer account state from login errors.
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // GSR14 (NOT IMPLEMENTED): MFA is not applied at login. A second factor (e.g. a
        // time-based OTP via an authenticator app, or an email/SMS one-time code) should be
        // issued and verified here before the session cookie is set. The email verification
        // on signup is a one-time account activation step and does not constitute MFA.

        // Create auth cookie, then record the latest login timestamp.
        generateTokenAndSetCookie(res, user._id);
        user.lastLogin = new Date();
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        // SSR10 (partial, login domain): unexpected login failures are logged, but login
        // success/failure outcomes are not logged in a full structured auth audit trail yet.
        // SSR11 (implemented, login domain): this log line does not include credentials.
        console.log('Error in login ', error);
        // GSR13: same as signup — only unexpected infrastructure errors reach here;
        // generic message returned to avoid leaking internals.
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * logout:
 * Terminates the current authenticated session by clearing both auth and CSRF cookies.
 * This ensures the browser no longer carries session state for protected requests.
 */
export const logout = async (req, res) => {
    // Clear auth cookie to invalidate the current session in the browser.
    res.clearCookie('token', getBaseCookieOptions());

    // Also clear CSRF secret cookie so a future session gets a fresh token pair.
    clearCsrfSecretCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * verify:
 * Validates and rehydrates an existing session for frontend app initialization.
 * After middleware validates the token, this handler returns the current user payload.
 * If the user is missing or unverified, it clears cookies and returns an auth failure.
 */
export const verify = async (req, res) => {
    // req.userId comes from auth middleware after token verification.
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            res.clearCookie('token', getBaseCookieOptions());
            clearCsrfSecretCookie(res);
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }

        if (!user.isVerified) {
            res.clearCookie('token', getBaseCookieOptions());
            clearCsrfSecretCookie(res);
            return res.status(401).json({
                success: false,
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before logging in.',
            });
        }

        // Return hydrated user payload used by the frontend session management to populate the app state on page refreshes.
        return res.status(200).json({
            success: true,
            message: 'User is authenticated',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        console.log('Error in verify ', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * forgotPassword:
 * Initiates the password reset workflow. The handler validates email input, creates a
 * short-lived reset token for existing accounts, and sends a reset link by email.
 * It returns a uniform success response to reduce account-enumeration risk.
 */
export const forgotPassword = async (req, res) => {
    // Read the email from the request body.
    const { email } = req.body;
    try {
        // Require email before continuing.
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
            });
        }
        // Validate and normalize email input.
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: emailValidation.error,
            });
        }
        // Find account by email, but always return the same success message to prevent user enumeration.
        const user = await User.findOne({ email: emailValidation.email });
        const successMessage = 'If an account exists with this email, you will receive a password reset link shortly.';

        if (!user) {
            console.log(`Password reset attempted for non-existent email: ${emailValidation.email}`);
            return res.status(200).json({ success: true, message: successMessage });
        }
        // Generate short-lived reset token and store it on the user record.
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000;

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiresAt = resetTokenExpiresAt;
        await user.save();

        // Send the reset link to the client route that handles password reset flow.
        await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);

        return res.status(200).json({ success: true, message: successMessage });
    } catch (error) {
        console.log('Error in forgotPassword ', error);
        return res.status(400).json({ success: false, message: 'Error on password reet' });
    }
};

/**
 * resetPassword:
 * Completes password reset by validating token + new password, confirming token expiry,
 * persisting a newly hashed password, and invalidating reset token fields so the link
 * cannot be reused.
 */
export const resetPassword = async (req, res) => {
    // Token comes from URL params, new password comes from request body.
    try {
        const { token } = req.params;
        const { password } = req.body;

        // Reject empty reset token.
        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required',
            });
        }
        // Reject missing password.
        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required',
            });
        }
        // SSR15: password changes use the same quality rules as registration by calling
        // the same shared validatePassword() validator used in signup.
        // Validate password complexity before hashing.
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Password does not meet requirements',
                errors: passwordValidation.errors,
            });
        }
        // Find user by reset token and ensure token has not expired.
        const sanitizedToken = token.trim();
        const user = await User.findOne({
            resetPasswordToken: sanitizedToken,
            resetPasswordExpiresAt: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }
        // SSR05: password resets are also stored as bcrypt hashes before persistence.
        // Save new password and clear reset token fields so the link is single-use.
        user.password = await bcryptjs.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiresAt = undefined;
        await user.save();

        // Let the user know the reset flow has completed successfully.
        await sendResetSuccessEmail(user.email);
        return res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        console.log('Error in resetPassword ', error);
        // GSR13: same as signup — only unexpected infrastructure errors reach here;
        // generic message returned to avoid leaking internals.
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
