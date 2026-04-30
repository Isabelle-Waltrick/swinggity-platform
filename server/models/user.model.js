// The code in this file were created with help of AI (Copilot)

// import Mongoose library
import mongoose from "mongoose";

// Define the User schema with validation rules and data types
// DBSR03 (partial): schema validation is enforced here at the Mongoose/application layer (required, unique, enum, type).
// This does not constitute full compliance — no native MongoDB $jsonSchema validator is set on the collection,
// so these rules are bypassed by any write that does not go through this model (e.g. Atlas UI, raw driver).
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
		// role field: of type String, can only be "regular", "organiser", or "admin", defaults to "regular"
		role: {
			type: String,
			enum: ["regular", "organiser", "admin"],
			required: true,
			default: "regular",
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
		// DBSR04 (partial): expiry is enforced in application code (checked against Date.now() before use and cleared on success).
		// A MongoDB TTL index on this field would automatically purge stale documents without application involvement,
		// but no such index is defined here, so expired tokens remain in the database until the user document is deleted.
		resetPasswordExpiresAt: Date,
		// Expiration date for password reset token
		verificationToken: String,
		// Expiration date for verification token
		// DBSR04 (partial): same as resetPasswordExpiresAt — expiry is application-enforced only; no TTL index is set
		// so unverified user documents with stale tokens are never automatically removed from the database.
		verificationTokenExpiresAt: Date,
	},
	// Enable automatic createdAt and updatedAt timestamps
	{ timestamps: true }
);
// Create and export the User model based on the schema
export const User = mongoose.model("User", userSchema);