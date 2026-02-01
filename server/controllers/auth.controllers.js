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
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../mailtrap/emails.js';

// signup controller function
export const signup = async (req, res) => {
    // extract user details from request body
    const { email, password, firstName, lastName } = req.body;

    try {
        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            throw new Error("All fields are required");
        }
        // Check if a user with the given email already exists
        const userAlreadyExists = await User.findOne({ email });
        // test log
        console.log("userAlreadyExists", userAlreadyExists);
        // If user exists, return an error response
        if (userAlreadyExists) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        //PASSWORD SECURITY:
        // Hash the password before storing it
        const hashedPassword = await bcryptjs.hash(password, 10);
        // Generate cryptographically secure 6-character hexadecimal token
        const verificationToken = crypto.randomBytes(3).toString('hex').padStart(6, '0');

        // Create a new user instance with the provided details
        const user = new User({
            email,
            password: hashedPassword,
            firstName,
            lastName,
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
        res.status(400).json({ success: false, message: error.message });
    }
};

// verify email controller function
export const verifyEmail = async (req, res) => {
	// verification code from request body
    const { code } = req.body;
	try {
        // find user with matching verification token
		const user = await User.findOne({
			verificationToken: code,
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
        // find user by email
		const user = await User.findOne({ email });
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
        // find user by email
		const user = await User.findOne({ email });

        // if user not found, return error response
		if (!user) {
			return res.status(400).json({ success: false, message: "User not found" });
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

		res.status(200).json({ success: true, message: "Password reset link sent to your email" });
	} catch (error) {
		console.log("Error in forgotPassword ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};