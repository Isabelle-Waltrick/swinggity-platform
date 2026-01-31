// import Mongoose library
import mongoose from "mongoose";

// Define the User schema with validation rules and data types
const userSchema = new mongoose.Schema(
	{
        // email field: required, unique, of type String
		email: {
			type: String,
			required: true,
			unique: true,
		},
        // password field: required, of type String
		password: {
			type: String,
			required: true,
		},
        // firstName field: required, of type String
		firstName: {
			type: String,
			required: true,
		},
        // lastName field: required, of type String
        lastName: {
			type: String,
			required: true,
		},
        // Track last login timestamp
		lastLogin: {
			type: Date,
			default: Date.now,
		},
        // Email verification status
		isVerified: {
			type: Boolean,
			default: false,
		},
         // Token for password reset functionality
		resetPasswordToken: String,
        // Expiration date for password reset token
		resetPasswordExpiresAt: Date,
        // Expiration date for password reset token
		verificationToken: String,
        // Expiration date for verification token
		verificationTokenExpiresAt: Date,
	},
    // Enable automatic createdAt and updatedAt timestamps
	{ timestamps: true }
);
// Create and export the User model based on the schema
export const User = mongoose.model("User", userSchema);