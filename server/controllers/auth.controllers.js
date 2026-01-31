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
import { sendVerificationEmail } from '../mailtrap/emails.js';

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

// route for user login
export const login = async (req, res) => {
    res.send('Signup route');
};

// route for user logout
export const logout = async (req, res) => {
    res.send('Signup route');
};