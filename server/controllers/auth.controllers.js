import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { clearCsrfSecretCookie } from '../utils/csrf.js';
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
 * signup: handles this function's core responsibility.
 */
export const signup = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    const { email, password, firstName, lastName } = req.body;

    try {
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

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: emailValidation.error,
                errors: { email: emailValidation.error },
            });
        }

        const firstNameValidation = validateName(firstName, 'First name');
        if (!firstNameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: firstNameValidation.error,
                errors: { firstName: firstNameValidation.error },
            });
        }

        const lastNameValidation = validateName(lastName, 'Last name');
        if (!lastNameValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: lastNameValidation.error,
                errors: { lastName: lastNameValidation.error },
            });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Password does not meet requirements',
                errors: { password: passwordValidation.errors },
            });
        }

        const userAlreadyExists = await User.findOne({ email: emailValidation.email });
        if (userAlreadyExists) {
            console.log(`Signup attempt for existing email: ${emailValidation.email}`);
            return res.status(400).json({
                success: false,
                message: 'Unable to create account. Please check your information or try a different email.',
            });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        const verificationToken = crypto.randomInt(0, 1000000).toString().padStart(6, '0');

        const user = new User({
            email: emailValidation.email,
            password: hashedPassword,
            firstName: firstNameValidation.name,
            lastName: lastNameValidation.name,
            role: 'regular',
            verificationToken,
            verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });

        await user.save();
        await Profile.create({
            user: user._id,
            displayFirstName: firstNameValidation.name,
            displayLastName: lastNameValidation.name,
        });

        await sendVerificationEmail(user.email, verificationToken);
        generateTokenAndSetCookie(res, user._id);

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        console.log('Error in signup ', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * verifyEmail: handles this function's core responsibility.
 */
export const verifyEmail = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    const { code } = req.body;
    try {
        if (!code || typeof code !== 'string' || code.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Verification code is required',
            });
        }

        const sanitizedCode = code.trim();
        if (!/^\d{6}$/.test(sanitizedCode)) {
            return res.status(400).json({
                success: false,
                message: 'Verification code must be a 6-digit number',
            });
        }

        const user = await User.findOne({
            verificationToken: sanitizedCode,
            verificationTokenExpiresAt: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        await user.save();
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
 * login: handles this function's core responsibility.
 */
export const login = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const user = await User.findOne({ email: emailValidation.email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        generateTokenAndSetCookie(res, user._id);
        user.lastLogin = new Date();
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            user: await buildUserWithProfilePayload(user),
        });
    } catch (error) {
        console.log('Error in login ', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * logout: handles this function's core responsibility.
 */
export const logout = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
    });
    clearCsrfSecretCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * verify: handles this function's core responsibility.
 */
export const verify = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

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
 * forgotPassword: handles this function's core responsibility.
 */
export const forgotPassword = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
            });
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: emailValidation.error,
            });
        }

        const user = await User.findOne({ email: emailValidation.email });
        const successMessage = 'If an account exists with this email, you will receive a password reset link shortly.';

        if (!user) {
            console.log(`Password reset attempted for non-existent email: ${emailValidation.email}`);
            return res.status(200).json({ success: true, message: successMessage });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000;

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiresAt = resetTokenExpiresAt;
        await user.save();

        await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);

        return res.status(200).json({ success: true, message: successMessage });
    } catch (error) {
        console.log('Error in forgotPassword ', error);
        return res.status(400).json({ success: false, message: 'Error on password reet' });
    }
};

/**
 * resetPassword: handles this function's core responsibility.
 */
export const resetPassword = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required',
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required',
            });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Password does not meet requirements',
                errors: passwordValidation.errors,
            });
        }

        const sanitizedToken = token.trim();
        const user = await User.findOne({
            resetPasswordToken: sanitizedToken,
            resetPasswordExpiresAt: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }

        user.password = await bcryptjs.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiresAt = undefined;
        await user.save();

        await sendResetSuccessEmail(user.email);
        return res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        console.log('Error in resetPassword ', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};
