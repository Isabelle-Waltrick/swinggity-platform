// import express framework
import express from 'express';
// import User model
import { User } from '../models/user.model.js';
// import utility function to generate JWT token and set cookie
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
// import bcryptjs for password hashing
import bcryptjs from 'bcryptjs';
// import crypto for token generation
import crypto from 'crypto';
// import sendVerificationEmail function
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccessEmail } from '../mailtrap/emails.js';

// Password validation function
const validatePassword = (password) => {
	const errors = [];

	if (password.length < 8) {
		errors.push("Password must be at least 8 characters long");
	}
	if (!/[A-Z]/.test(password)) {
		errors.push("Password must contain at least one uppercase letter");
	}
	if (!/[a-z]/.test(password)) {
		errors.push("Password must contain at least one lowercase letter");
	}
	if (!/[0-9]/.test(password)) {
		errors.push("Password must contain at least one number");
	}
	if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
		errors.push("Password must contain at least one special character");
	}

	return {
		isValid: errors.length === 0,
		errors
	};
};

// Email validation function
const validateEmail = (email) => {
	// RFC 5322 compliant email regex
	const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
	
	// Check if email is provided and is a string
	if (!email || typeof email !== 'string') {
		return { isValid: false, error: "Email is required" };
	}

	// Trim and convert to lowercase for validation
	const trimmedEmail = email.trim().toLowerCase();

	// Check if email is empty after trimming
	if (trimmedEmail.length === 0) {
		return { isValid: false, error: "Email is required" };
	}

	// Check if email exceeds maximum length
	if (trimmedEmail.length > 254) {
		return { isValid: false, error: "Email address is too long" };
	}

	// Validate email format using regex
	if (!emailRegex.test(trimmedEmail)) {
		return { isValid: false, error: "Please enter a valid email address" };
	}
	// If all checks pass, return valid with sanitized email
	return { isValid: true, email: trimmedEmail };
};

// Name validation function
const validateName = (name, fieldName) => {
	if (!name || typeof name !== 'string') {
		return { isValid: false, error: `${fieldName} is required` };
	}

	const trimmedName = name.trim();

	if (trimmedName.length === 0) {
		return { isValid: false, error: `${fieldName} is required` };
	}

	if (trimmedName.length < 2) {
		return { isValid: false, error: `${fieldName} must be at least 2 characters long` };
	}

	if (trimmedName.length > 50) {
		return { isValid: false, error: `${fieldName} must be less than 50 characters` };
	}

	// Only allow letters, spaces, hyphens, and apostrophes
	if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
		return { isValid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
	}

	return { isValid: true, name: trimmedName };
};

// signup controller function
export const signup = async (req, res) => {
	// extract user details from request body
	const { email, password, firstName, lastName } = req.body;

	try {
		// Validate required fields
		if (!email || !password || !firstName || !lastName) {
			return res.status(400).json({
				success: false,
				message: "All fields are required",
				errors: {
					email: !email ? "Email is required" : null,
					password: !password ? "Password is required" : null,
					firstName: !firstName ? "First name is required" : null,
					lastName: !lastName ? "Last name is required" : null
				}
			});
		}

		// Validate email format
		const emailValidation = validateEmail(email);
		if (!emailValidation.isValid) {
			return res.status(400).json({
				success: false,
				message: emailValidation.error,
				errors: { email: emailValidation.error }
			});
		}

		// Validate first name
		const firstNameValidation = validateName(firstName, "First name");
		if (!firstNameValidation.isValid) {
			return res.status(400).json({
				success: false,
				message: firstNameValidation.error,
				errors: { firstName: firstNameValidation.error }
			});
		}

		// Validate last name
		const lastNameValidation = validateName(lastName, "Last name");
		if (!lastNameValidation.isValid) {
			return res.status(400).json({
				success: false,
				message: lastNameValidation.error,
				errors: { lastName: lastNameValidation.error }
			});
		}

		// Validate password strength
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			return res.status(400).json({
				success: false,
				message: "Password does not meet requirements",
				errors: { password: passwordValidation.errors }
			});
		}

		// Check if a user with the given email already exists
		const userAlreadyExists = await User.findOne({ email: emailValidation.email });
		// If user exists, return a generic error response (prevents email enumeration)
		if (userAlreadyExists) {
			// Log for internal monitoring (do not expose to client)
			console.log(`Signup attempt for existing email: ${emailValidation.email}`);
			return res.status(400).json({
				success: false,
				message: "Unable to create account. Please check your information or try a different email."
			});
		}

		//PASSWORD SECURITY:
		// Hash the password before storing it
		const hashedPassword = await bcryptjs.hash(password, 10);
		// Generate cryptographically secure 6-character hexadecimal token
		const verificationToken = crypto.randomBytes(3).toString('hex').padStart(6, '0');

		// Create a new user instance with the provided details (using sanitized values)
		const user = new User({
			email: emailValidation.email,
			password: hashedPassword,
			firstName: firstNameValidation.name,
			lastName: lastNameValidation.name,
			verificationToken,
			verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
		});

		// Save the new user to the database
		await user.save();

		// Send verification email to the user
		await sendVerificationEmail(user.email, verificationToken);

		// jwt token generation and setting cookie function
		generateTokenAndSetCookie(res, user._id);

		// Send a success response
		res.status(201).json({
			success: true,
			message: "User created successfully",
			user: {
				...user._doc,
				password: undefined,
			},
		});

	} catch (error) {
		console.log("Error in signup ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

// verify email controller function
export const verifyEmail = async (req, res) => {
	// verification code from request body
	const { code } = req.body;
	try {
		// Validate code format
		if (!code || typeof code !== 'string' || code.trim().length === 0) {
			return res.status(400).json({
				success: false,
				message: "Verification code is required"
			});
		}

		// Sanitize the code
		const sanitizedCode = code.trim();

		// find user with matching verification token
		const user = await User.findOne({
			verificationToken: sanitizedCode,
			// check if token is not expired
			verificationTokenExpiresAt: { $gt: Date.now() },
		});
		// if no user found, return error response
		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
		}
		// mark user as verified
		user.isVerified = true;
		// clear verification token
		user.verificationToken = undefined;
		// clear token expiry
		user.verificationTokenExpiresAt = undefined;

		// save updated user to database
		await user.save();

		// send welcome email
		await sendWelcomeEmail(user.email, user.firstName);

		// send success response
		res.status(200).json({
			success: true,
			message: "Email verified successfully",
			user: {
				...user._doc,
				password: undefined,
			},
		});
	} catch (error) {
		console.log("error in verifyEmail ", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// user login controller function
export const login = async (req, res) => {
	// extract email and password from request body
	const { email, password } = req.body;
	try {
		// Validate required fields
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: "Email and password are required"
			});
		}

		// Validate and sanitize email
		const emailValidation = validateEmail(email);
		if (!emailValidation.isValid) {
			return res.status(400).json({
				success: false,
				message: "Invalid credentials"
			});
		}

		// find user by email
		const user = await User.findOne({ email: emailValidation.email });
		// if user not found, return error response
		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid credentials" });
		}
		// compare provided password with stored hashed password in the db
		const isPasswordValid = await bcryptjs.compare(password, user.password);
		// if password is invalid, return error response
		if (!isPasswordValid) {
			return res.status(400).json({ success: false, message: "Invalid credentials" });
		}
		// generate jwt token and set cookie
		generateTokenAndSetCookie(res, user._id);
		// update user's last login time
		user.lastLogin = new Date();

		// save updated user to database
		await user.save();

		// send success response
		res.status(200).json({
			success: true,
			message: "Logged in successfully",
			user: {
				...user._doc,
				password: undefined,
			},
		});
		// catch any errors during the process
	} catch (error) {
		console.log("Error in login ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

// user logout controller function
export const logout = async (req, res) => {
	// clear the token cookie
	res.clearCookie("token");
	// send success response
	res.status(200).json({ success: true, message: "Logged out successfully" });
};

// forgot password controller function
export const forgotPassword = async (req, res) => {
	// extract email from request body
	const { email } = req.body;
	try {
		// Validate email
		if (!email) {
			return res.status(400).json({
				success: false,
				message: "Email is required"
			});
		}

		// Validate and sanitize email
		const emailValidation = validateEmail(email);
		if (!emailValidation.isValid) {
			return res.status(400).json({
				success: false,
				message: emailValidation.error
			});
		}

		// find user by email
		const user = await User.findOne({ email: emailValidation.email });

		// Generic success message (prevents email enumeration)
		const successMessage = "If an account exists with this email, you will receive a password reset link shortly.";

		// if user not found, return success response anyway (prevents email enumeration)
		if (!user) {
			// Log for internal monitoring (do not expose to client)
			console.log(`Password reset attempted for non-existent email: ${emailValidation.email}`);
			return res.status(200).json({ success: true, message: successMessage });
		}

		// Generate reset token
		const resetToken = crypto.randomBytes(20).toString("hex");
		const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

		// save reset token
		user.resetPasswordToken = resetToken;
		// save token expiry time
		user.resetPasswordExpiresAt = resetTokenExpiresAt;

		// save updated user to database
		await user.save();

		// send reset password email
		await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);

		res.status(200).json({ success: true, message: successMessage });
	} catch (error) {
		console.log("Error in forgotPassword ", error);
		res.status(400).json({ success: false, message: "Error on password reet" });
	}
};

// reset password controller function
export const resetPassword = async (req, res) => {
	try {
		// extract token from request params
		const { token } = req.params;
		// extract new password from request body
		const { password } = req.body;

		// Validate token
		if (!token || typeof token !== 'string' || token.trim().length === 0) {
			return res.status(400).json({
				success: false,
				message: "Reset token is required"
			});
		}

		// Validate password
		if (!password) {
			return res.status(400).json({
				success: false,
				message: "Password is required"
			});
		}

		// Validate password strength
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			return res.status(400).json({
				success: false,
				message: "Password does not meet requirements",
				errors: passwordValidation.errors
			});
		}

		// Sanitize token
		const sanitizedToken = token.trim();

		// find user by reset token and check if token is not expired
		const user = await User.findOne({
			resetPasswordToken: sanitizedToken,
			resetPasswordExpiresAt: { $gt: Date.now() },
		});
		// if no user found, return error response
		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
		}
		// update password
		const hashedPassword = await bcryptjs.hash(password, 10);

		// save new hashed password
		user.password = hashedPassword;
		// clear reset token
		user.resetPasswordToken = undefined;
		// clear token expiry
		user.resetPasswordExpiresAt = undefined;

		// save updated user to database
		await user.save();

		// send reset success email
		await sendResetSuccessEmail(user.email);

		// send success response
		res.status(200).json({ success: true, message: "Password reset successful" });
		// catch any errors during the process  
	} catch (error) {
		console.log("Error in resetPassword ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

// check authentication controller function
// export const checkAuth = async (req, res) => {
// 	try {
// 		// find user by userId attached to request object by verifyToken middleware
// 		const user = await User.findById(req.userId).select("-password");
// 		// if no user found, return error response
// 		if (!user) {
// 			return res.status(400).json({ success: false, message: "User not found" });
// 		}
// 		// send success response with user details
// 		res.status(200).json({ success: true, user });
// 		// catch any errors during the process
// 	} catch (error) {
// 		console.log("Error in checkAuth ", error);
// 		res.status(400).json({ success: false, message: error.message });
// 	}
// };