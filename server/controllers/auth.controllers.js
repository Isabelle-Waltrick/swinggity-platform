// import express framework
import express from 'express';
// import User model
import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { Organisation } from '../models/organisation.model.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
// import utility function to generate JWT token and set cookie
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
// import bcryptjs for password hashing
import bcryptjs from 'bcryptjs';
// import crypto for token generation
import crypto from 'crypto';
import { canJamCircleInvite, isAdminRole } from '../utils/rolePermissions.js';
// import sendVerificationEmail function
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccessEmail, sendJamCircleInviteEmail, sendMemberContactRequestEmail } from '../mailtrap/emails.js';

// Password validation function
const validatePassword = (password) => {
	const errors = [];

	if (typeof password !== "string") {
		errors.push("Password must be a string");
		return {
			isValid: false,
			errors,
		};
	}

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

const normalizeSocialUrl = (value) => {
	const raw = typeof value === "string" ? value.trim() : "";
	if (!raw) return "";

	const prefixed = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/\//, "")}`;
	try {
		const parsed = new URL(prefixed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return "";
		}
		return parsed.toString();
	} catch {
		return "";
	}
};

const CONTACT_MESSAGE_MAX_WORDS = 200;

const countWords = (value) => {
	const normalized = typeof value === "string" ? value.trim() : "";
	if (!normalized) return 0;
	return normalized.split(/\s+/).filter(Boolean).length;
};

const parseBooleanField = (value) => value === true || value === "true" || value === 1 || value === "1";

const escapeHtml = (value) => String(value || "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/\"/g, "&quot;")
	.replace(/'/g, "&#39;");

const canContactMember = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
	const privacy = typeof targetProfile?.privacyContact === "string" ? targetProfile.privacyContact : "anyone";
	if (privacy === "nobody") return false;
	if (privacy === "anyone") return true;

	const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
	const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
	const normalizedViewerUserId = String(viewerUserId || "");
	const normalizedTargetUserId = String(targetUserId || "");

	if (privacy === "circle") {
		return viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);
	}

	if (privacy === "mutual") {
		for (const memberId of viewerCircleSet) {
			if (targetCircleSet.has(memberId)) return true;
		}
		return false;
	}

	return false;
};

const canViewMemberProfile = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
	const privacy = typeof targetProfile?.privacyProfile === "string" ? targetProfile.privacyProfile : "anyone";
	if (String(viewerUserId || "") === String(targetUserId || "")) return true;
	if (privacy === "nobody") return false;
	if (privacy === "anyone") return true;

	const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
	const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
	const normalizedViewerUserId = String(viewerUserId || "");
	const normalizedTargetUserId = String(targetUserId || "");
	const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

	if (privacy === "circle") {
		return directConnection;
	}

	if (privacy === "mutual") {
		if (directConnection) return true;

		for (const memberId of viewerCircleSet) {
			if (targetCircleSet.has(memberId)) return true;
		}
		return false;
	}

	return false;
};

const canViewMemberInDiscovery = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
	const privacy = typeof targetProfile?.privacyMembers === "string" ? targetProfile.privacyMembers : "anyone";
	if (String(viewerUserId || "") === String(targetUserId || "")) return true;
	if (privacy === "nobody") return false;
	if (privacy === "anyone") return true;

	const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
	const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
	const normalizedViewerUserId = String(viewerUserId || "");
	const normalizedTargetUserId = String(targetUserId || "");
	const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

	if (privacy === "circle") {
		return directConnection;
	}

	if (privacy === "mutual") {
		if (directConnection) return true;

		for (const memberId of viewerCircleSet) {
			if (targetCircleSet.has(memberId)) return true;
		}
		return false;
	}

	return false;
};

const canViewMemberActivity = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
	const privacy = typeof targetProfile?.privacyActivity === "string" ? targetProfile.privacyActivity : "anyone";
	if (String(viewerUserId || "") === String(targetUserId || "")) return true;
	if (privacy === "nobody") return false;
	if (privacy === "anyone") return true;

	const viewerCircleSet = getIdSet(viewerProfile?.jamCircleMembers);
	const targetCircleSet = getIdSet(targetProfile?.jamCircleMembers);
	const normalizedViewerUserId = String(viewerUserId || "");
	const normalizedTargetUserId = String(targetUserId || "");
	const directConnection = viewerCircleSet.has(normalizedTargetUserId) || targetCircleSet.has(normalizedViewerUserId);

	if (privacy === "circle") {
		return directConnection;
	}

	if (privacy === "mutual") {
		if (directConnection) return true;

		for (const memberId of viewerCircleSet) {
			if (targetCircleSet.has(memberId)) return true;
		}
		return false;
	}

	return false;
};

const buildPublicMemberPayload = (profile, viewerProfile = null, viewerUserId = "") => {
	const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
	const firstName = normalizeText(profile?.displayFirstName) || normalizeText(profile?.user?.firstName);
	const lastName = normalizeText(profile?.displayLastName) || normalizeText(profile?.user?.lastName);
	const targetUserId = String(profile?.user?._id || profile?.user || "");
	const canViewActivity = canViewMemberActivity(viewerProfile, profile, viewerUserId, targetUserId);
	const canContact = canContactMember(viewerProfile, profile, viewerUserId, targetUserId);
	const profileTags = Array.isArray(profile?.profileTags)
		? profile.profileTags
			.map((tag) => normalizeText(tag))
			.filter(Boolean)
		: [];
	const onlineLinks = {
		instagram: normalizeSocialUrl(profile?.instagram),
		facebook: normalizeSocialUrl(profile?.facebook),
		youtube: normalizeSocialUrl(profile?.youtube),
		linkedin: normalizeSocialUrl(profile?.linkedin),
		website: normalizeSocialUrl(profile?.website),
	};

	return {
		userId: profile?.user?._id,
		entityType: "member",
		role: normalizeText(profile?.user?.role).toLowerCase(),
		displayFirstName: firstName,
		displayLastName: lastName,
		avatarUrl: normalizeText(profile?.avatarUrl),
		pronouns: normalizeText(profile?.pronouns),
		bio: normalizeText(profile?.bio),
		tags: profileTags,
		jamCircle: normalizeText(profile?.jamCircle),
		activity: canViewActivity ? normalizeText(profile?.activity) : "",
		activityFeed: canViewActivity && Array.isArray(profile?.activityFeed) ? profile.activityFeed : [],
		showOnlineLinks: true,
		onlineLinks,
		privacyProfile: profile?.privacyProfile ?? "anyone",
		canContact: String(viewerUserId || "") === String(targetUserId || "") ? false : canContact,
	};
};

const parseParticipantsToTags = (participants) => {
	const normalized = typeof participants === "string" ? participants.trim() : "";
	if (!normalized) return [];

	return normalized
		.split(/[,;\n]/)
		.map((value) => value.trim())
		.filter(Boolean)
		.slice(0, 20);
};

const parseParticipantContactsToTags = (participantContacts) => {
	if (!Array.isArray(participantContacts)) return [];

	return participantContacts
		.map((entry) => (typeof entry?.displayName === "string" ? entry.displayName.trim() : ""))
		.filter(Boolean)
		.slice(0, 20);
};

const buildPublicOrganisationPayload = (organisation, viewerUserId = "", ownerProfile = null) => {
	if (!organisation) return null;

	const normalise = (value) => (typeof value === "string" ? value.trim() : "");
	const displayName = normalise(organisation.organisationName) || "Swinggity Organisation";
	const onlineLinks = {
		instagram: normalizeSocialUrl(organisation.instagram),
		facebook: normalizeSocialUrl(organisation.facebook),
		youtube: normalizeSocialUrl(organisation.youtube),
		linkedin: normalizeSocialUrl(organisation.linkedin),
		website: normalizeSocialUrl(organisation.website),
	};

	const ownerDisplayName = `${normalise(ownerProfile?.displayFirstName)} ${normalise(ownerProfile?.displayLastName)}`.trim() || "Main contact";
	const ownerAvatarUrl = normalise(ownerProfile?.avatarUrl);

	const participantContacts = Array.isArray(organisation.participantContacts)
		? organisation.participantContacts.map((entry) => ({
			userId: normalise(String(entry?.user || entry?.userId || "")),
			entityType: entry?.entityType === "organisation" ? "organisation" : "member",
			organisationId: normalise(String(entry?.organisationId || "")),
			displayName: normalise(entry?.displayName || ""),
			avatarUrl: normalise(entry?.avatarUrl || ""),
		}))
		: [];

	const ownerParticipant = {
		userId: normalise(String(organisation?.user || "")),
		entityType: "member",
		organisationId: "",
		displayName: ownerDisplayName,
		avatarUrl: ownerAvatarUrl,
	};

	const participantContactsWithOwner = [ownerParticipant, ...participantContacts]
		.filter((entry) => entry.userId && entry.displayName)
		.filter((entry, index, allEntries) => {
			const key = `${entry.userId}|${entry.entityType}|${entry.organisationId}`;
			return allEntries.findIndex((candidate) => `${candidate.userId}|${candidate.entityType}|${candidate.organisationId}` === key) === index;
		});

	return {
		userId: organisation?._id,
		entityType: "organisation",
		organisationId: organisation?._id,
		organisationOwnerUserId: organisation?.user,
		displayFirstName: displayName,
		displayLastName: "",
		avatarUrl: normalise(organisation.imageUrl),
		pronouns: "",
		bio: normalise(organisation.bio),
		tags: parseParticipantContactsToTags(participantContactsWithOwner).length > 0
			? parseParticipantContactsToTags(participantContactsWithOwner)
			: parseParticipantsToTags(organisation.participants),
		participantContacts: participantContactsWithOwner,
		jamCircle: "",
		activity: "",
		activityFeed: [],
		showOnlineLinks: true,
		onlineLinks,
		isCurrentUser: String(organisation?.user || "") === String(viewerUserId || ""),
	};
};

const resolveAbsoluteAssetUrl = (req, rawUrl) => {
	const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `${req.protocol}://${req.get("host")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
};

const buildJamCircleMemberPayload = (profile) => {
	if (!profile?.user) return null;

	const firstName = (profile.displayFirstName || profile.user.firstName || "").trim();
	const lastName = (profile.displayLastName || profile.user.lastName || "").trim();
	return {
		userId: profile.user._id,
		role: String(profile.user.role || "").trim().toLowerCase(),
		displayFirstName: firstName,
		displayLastName: lastName,
		fullName: `${firstName} ${lastName}`.trim() || "Swinggity Member",
		avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl.trim() : "",
	};
};

const getIdSet = (values) => new Set(
	(Array.isArray(values) ? values : []).map((value) => String(value))
);

const hasBlockingRelationship = (viewerProfile, targetProfile, viewerUserId, targetUserId) => {
	const viewerBlockedSet = getIdSet(viewerProfile?.blockedMembers);
	const targetBlockedSet = getIdSet(targetProfile?.blockedMembers);
	return viewerBlockedSet.has(String(targetUserId || "")) || targetBlockedSet.has(String(viewerUserId || ""));
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || "";
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || "";
const isCloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);

if (isCloudinaryConfigured) {
	cloudinary.config({
		cloud_name: cloudinaryCloudName,
		api_key: cloudinaryApiKey,
		api_secret: cloudinaryApiSecret,
		secure: true,
	});
}

const getAvatarCloudPublicId = (userId) => `avatar-${String(userId || "unknown")}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const uploadAvatarToCloudinary = async ({ fileBuffer, mimeType, userId }) => {
	if (!isCloudinaryConfigured) {
		throw new Error("Cloudinary is not configured");
	}

	const publicId = getAvatarCloudPublicId(userId);
	const payload = await new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				public_id: publicId,
				resource_type: "image",
				overwrite: true,
				invalidate: true,
				folder: "swinggity/avatars",
				format: (mimeType || "").includes("png") ? "png" : undefined,
			},
			(error, result) => {
				if (error || !result) {
					reject(error || new Error("Cloud avatar upload failed"));
					return;
				}
				resolve(result);
			}
		);

		uploadStream.end(fileBuffer);
	});

	return {
		avatarUrl: payload.secure_url,
		avatarStorageId: payload.public_id,
	};
};

const deleteCloudinaryAvatar = async (avatarStorageId) => {
	if (!isCloudinaryConfigured || !avatarStorageId) return;

	await cloudinary.uploader.destroy(avatarStorageId, {
		resource_type: "image",
		invalidate: true,
	}).catch(() => undefined);
};

const getJamCircleMembersPayload = async (memberIds) => {
	const normalizedIds = (Array.isArray(memberIds) ? memberIds : []).map((id) => String(id));
	if (normalizedIds.length === 0) return [];

	const circleProfiles = await Profile.find({ user: { $in: normalizedIds } })
		.populate("user", "firstName lastName")
		.lean();

	const byUserId = new Map(circleProfiles.map((item) => [String(item?.user?._id), item]));
	return normalizedIds
		.map((id) => buildJamCircleMemberPayload(byUserId.get(id)))
		.filter(Boolean);
};

const buildUserWithProfilePayload = async (user) => {
	if (!user) return null;

	const profile = await Profile.findOne({ user: user._id });
	const resolvedDisplayFirstName = profile?.displayFirstName?.trim() || user.firstName;
	const resolvedDisplayLastName = profile?.displayLastName?.trim() || user.lastName;

	// Backfill legacy profiles created before display name fields were introduced.
	if (profile && (!profile.displayFirstName?.trim() || !profile.displayLastName?.trim())) {
		profile.displayFirstName = resolvedDisplayFirstName;
		profile.displayLastName = resolvedDisplayLastName;
		await profile.save();
	}

	const jamCircleMemberIds = Array.isArray(profile?.jamCircleMembers)
		? profile.jamCircleMembers.map((id) => String(id))
		: [];
	const blockedMemberIds = Array.isArray(profile?.blockedMembers)
		? profile.blockedMembers.map((id) => String(id))
		: [];

	const jamCircleMembers = await getJamCircleMembersPayload(jamCircleMemberIds);
	const blockedMembers = await getJamCircleMembersPayload(blockedMemberIds);

	return {
		...user._doc,
		password: undefined,
		displayFirstName: resolvedDisplayFirstName,
		displayLastName: resolvedDisplayLastName,
		avatarUrl: profile?.avatarUrl ?? "",
		bio: profile?.bio ?? "",
		pronouns: profile?.pronouns ?? "",
		contactEmail: profile?.contactEmail ?? "",
		phoneNumber: profile?.phoneNumber ?? "",
		instagram: profile?.instagram ?? "",
		facebook: profile?.facebook ?? "",
		youtube: profile?.youtube ?? profile?.x ?? "",
		linkedin: profile?.linkedin ?? "",
		website: profile?.website ?? "",
		profileTags: profile?.profileTags ?? [],
		jamCircle: profile?.jamCircle ?? "",
		jamCircleMembers,
		blockedMembers,
		interests: profile?.interests ?? "",
		activity: profile?.activity ?? "",
		activityFeed: Array.isArray(profile?.activityFeed) ? profile.activityFeed : [],
		privacyMembers: profile?.privacyMembers ?? "anyone",
		privacyProfile: profile?.privacyProfile ?? "anyone",
		privacyContact: profile?.privacyContact ?? "anyone",
		privacyActivity: profile?.privacyActivity ?? "anyone",
	};
};

const deleteAvatarFileIfLocal = async (avatarUrl) => {
	if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) {
		return;
	}

	const absoluteAvatarPath = path.join(__dirname, '..', avatarUrl.replace(/^\//, '').replace(/\//g, path.sep));
	await fs.unlink(absoluteAvatarPath).catch(() => undefined);
};

const deleteAvatarAsset = async ({ avatarUrl, avatarStorageId }) => {
	if (avatarStorageId) {
		await deleteCloudinaryAvatar(avatarStorageId);
		return;
	}

	await deleteAvatarFileIfLocal(avatarUrl);
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
			role: "regular",
			verificationToken,
			verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
		});

		// Save the new user to the database
		await user.save();
		await Profile.create({
			user: user._id,
			displayFirstName: firstNameValidation.name,
			displayLastName: lastNameValidation.name,
		});

		// Send verification email to the user
		await sendVerificationEmail(user.email, verificationToken);

		// jwt token generation and setting cookie function
		generateTokenAndSetCookie(res, user._id);

		// Send a success response
		res.status(201).json({
			success: true,
			message: "User created successfully",
			user: await buildUserWithProfilePayload(user),
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
			user: await buildUserWithProfilePayload(user),
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
			user: await buildUserWithProfilePayload(user),
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
	res.clearCookie("token", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
	});
	// send success response
	res.status(200).json({ success: true, message: "Logged out successfully" });
};

// verify session controller function - checks if user is logged in
export const verify = async (req, res) => {
	try {
		// get userId from the verified token (set by verifyToken middleware)
		const userId = req.userId;

		// find user by ID
		const user = await User.findById(userId);

		if (!user) {
			return res.status(401).json({ success: false, message: "User not found" });
		}

		// send success response with user data
		res.status(200).json({
			success: true,
			message: "User is authenticated",
			user: await buildUserWithProfilePayload(user),
		});
	} catch (error) {
		console.log("Error in verify ", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// update authenticated user profile controller function
export const updateProfile = async (req, res) => {
	try {
		const userId = req.userId;
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const isAdminUser = isAdminRole(user.role);
		const {
			displayFirstName,
			displayLastName,
			bio,
			pronouns,
			contactEmail,
			phoneNumber,
			instagram,
			facebook,
			youtube,
			x,
			linkedin,
			website,
			profileTags,
			jamCircle,
			interests,
			activity,
			privacyMembers,
			privacyProfile,
			privacyContact,
			privacyActivity,
		} = req.body;

		const sanitizeTextField = (value, fieldName, maxLength) => {
			if (value === undefined) {
				return { isProvided: false };
			}

			if (typeof value !== "string") {
				return { isProvided: true, error: `${fieldName} must be a string` };
			}

			const sanitizedValue = value.trim();
			if (sanitizedValue.length > maxLength) {
				return {
					isProvided: true,
					error: `${fieldName} must be less than or equal to ${maxLength} characters`,
				};
			}

			return { isProvided: true, value: sanitizedValue };
		};

		const validatedBio = sanitizeTextField(bio, "Bio", 500);
		const validatedPronouns = sanitizeTextField(pronouns, "Pronouns", 50);
		const validatedContactEmail = sanitizeTextField(contactEmail, "Contact email", 254);
		const validatedPhoneNumber = sanitizeTextField(phoneNumber, "Phone number", 30);
		const validatedInstagram = sanitizeTextField(instagram, "Instagram", 120);
		const validatedFacebook = sanitizeTextField(facebook, "Facebook", 120);
		const validatedYouTube = sanitizeTextField(youtube ?? x, "YouTube", 120);
		const validatedLinkedin = sanitizeTextField(linkedin, "LinkedIn", 120);
		const validatedWebsite = sanitizeTextField(website, "Website", 300);
		const validatedJamCircle = sanitizeTextField(jamCircle, "Jam circle", 1000);
		const validatedInterests = sanitizeTextField(interests, "Interests", 1000);
		const validatedActivity = sanitizeTextField(activity, "Activity", 1000);

		const sanitizeDisplayName = (value, fieldName) => {
			if (value === undefined) {
				return { isProvided: false };
			}

			if (typeof value !== "string") {
				return { isProvided: true, error: `${fieldName} must be a string` };
			}

			const trimmed = value.trim();
			if (trimmed.length === 0) {
				// Empty string is allowed so users can hide their public name later.
				return { isProvided: true, value: "" };
			}

			const validated = validateName(trimmed, fieldName);
			if (!validated.isValid) {
				return { isProvided: true, error: validated.error };
			}

			return { isProvided: true, value: validated.name };
		};

		const validatedDisplayFirstName = sanitizeDisplayName(displayFirstName, "Display first name");
		const validatedDisplayLastName = sanitizeDisplayName(displayLastName, "Display last name");

		const sanitizeTags = (value) => {
			if (value === undefined) {
				return { isProvided: false };
			}

			if (!Array.isArray(value)) {
				return { isProvided: true, error: "Profile tags must be an array" };
			}

			if (value.length > 20) {
				return { isProvided: true, error: "Profile tags cannot exceed 20 items" };
			}

			const normalized = [];
			for (const rawTag of value) {
				if (typeof rawTag !== "string") {
					return { isProvided: true, error: "Each profile tag must be a string" };
				}
				const tag = rawTag.trim();
				if (!tag) {
					continue;
				}
				if (tag.length > 40) {
					return { isProvided: true, error: "Each profile tag must be 40 characters or fewer" };
				}
				normalized.push(tag);
			}

			const uniqueTags = [...new Set(normalized)];
			return { isProvided: true, value: uniqueTags };
		};

		const privacyOptions = ["anyone", "circle", "mutual", "nobody"];
		const sanitizePrivacy = (value, fieldName) => {
			if (value === undefined) {
				return { isProvided: false };
			}

			if (typeof value !== "string") {
				return { isProvided: true, error: `${fieldName} must be a string` };
			}

			if (!privacyOptions.includes(value)) {
				return { isProvided: true, error: `${fieldName} has an invalid value` };
			}

			return { isProvided: true, value };
		};

		const validatedProfileTags = sanitizeTags(profileTags);
		const validatedPrivacyMembers = sanitizePrivacy(privacyMembers, "privacyMembers");
		const validatedPrivacyProfile = sanitizePrivacy(privacyProfile, "privacyProfile");
		const validatedPrivacyContact = sanitizePrivacy(privacyContact, "privacyContact");
		const validatedPrivacyActivity = sanitizePrivacy(privacyActivity, "privacyActivity");

		const validations = [
			validatedDisplayFirstName,
			validatedDisplayLastName,
			validatedBio,
			validatedPronouns,
			validatedContactEmail,
			validatedPhoneNumber,
			validatedInstagram,
			validatedFacebook,
			validatedYouTube,
			validatedLinkedin,
			validatedWebsite,
			validatedProfileTags,
			validatedJamCircle,
			validatedInterests,
			validatedActivity,
			validatedPrivacyMembers,
			validatedPrivacyProfile,
			validatedPrivacyContact,
			validatedPrivacyActivity,
		];
		const firstError = validations.find((validation) => validation.error);
		if (firstError) {
			return res.status(400).json({ success: false, message: firstError.error });
		}

		const updates = {};
		if (validatedDisplayFirstName.isProvided) updates.displayFirstName = validatedDisplayFirstName.value;
		if (validatedDisplayLastName.isProvided) updates.displayLastName = validatedDisplayLastName.value;
		if (validatedBio.isProvided) updates.bio = validatedBio.value;
		if (!isAdminUser && validatedPronouns.isProvided) updates.pronouns = validatedPronouns.value;
		if (validatedContactEmail.isProvided) updates.contactEmail = validatedContactEmail.value;
		if (validatedPhoneNumber.isProvided) updates.phoneNumber = validatedPhoneNumber.value;
		if (validatedInstagram.isProvided) updates.instagram = validatedInstagram.value;
		if (validatedFacebook.isProvided) updates.facebook = validatedFacebook.value;
		if (validatedYouTube.isProvided) updates.youtube = validatedYouTube.value;
		if (validatedLinkedin.isProvided) updates.linkedin = validatedLinkedin.value;
		if (validatedWebsite.isProvided) updates.website = validatedWebsite.value;
		if (!isAdminUser && validatedProfileTags.isProvided) updates.profileTags = validatedProfileTags.value;
		if (validatedJamCircle.isProvided) updates.jamCircle = validatedJamCircle.value;
		if (validatedInterests.isProvided) updates.interests = validatedInterests.value;
		if (validatedActivity.isProvided) updates.activity = validatedActivity.value;
		if (!isAdminUser && validatedPrivacyMembers.isProvided) updates.privacyMembers = validatedPrivacyMembers.value;
		if (!isAdminUser && validatedPrivacyProfile.isProvided) updates.privacyProfile = validatedPrivacyProfile.value;
		if (!isAdminUser && validatedPrivacyContact.isProvided) updates.privacyContact = validatedPrivacyContact.value;
		if (!isAdminUser && validatedPrivacyActivity.isProvided) updates.privacyActivity = validatedPrivacyActivity.value;

		if (Object.keys(updates).length === 0) {
			return res.status(400).json({ success: false, message: "No profile fields provided to update" });
		}

		const updatedProfile = await Profile.findOneAndUpdate({ user: userId }, updates, {
			new: true,
			upsert: true,
			setDefaultsOnInsert: true,
			runValidators: true,
		});

		// Safety check for unexpected null on upsert/update path.
		if (!updatedProfile) {
			return res.status(500).json({ success: false, message: "Unable to update profile" });
		}

		return res.status(200).json({
			success: true,
			message: "Profile updated successfully",
			user: await buildUserWithProfilePayload(user),
		});
	} catch (error) {
		console.log("Error in updateProfile ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

// upload authenticated user avatar and persist avatarUrl in profile
export const uploadAvatar = async (req, res) => {
	try {
		const userId = req.userId;

		if (!req.file) {
			return res.status(400).json({ success: false, message: "Avatar file is required" });
		}

		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const existingProfile = await Profile.findOne({ user: userId });
		const previousAvatarUrl = existingProfile?.avatarUrl ?? "";
		const previousAvatarStorageId = existingProfile?.avatarStorageId ?? "";

		let nextAvatarUrl = "";
		let nextAvatarStorageId = "";

		if (isCloudinaryConfigured) {
			const uploadedAvatar = await uploadAvatarToCloudinary({
				fileBuffer: req.file.buffer,
				mimeType: req.file.mimetype,
				userId,
			});
			nextAvatarUrl = uploadedAvatar.avatarUrl;
			nextAvatarStorageId = uploadedAvatar.avatarStorageId;
		} else {
			nextAvatarUrl = `/uploads/avatars/${req.file.filename}`;
		}

		const profile = await Profile.findOneAndUpdate(
			{ user: userId },
			{ avatarUrl: nextAvatarUrl, avatarStorageId: nextAvatarStorageId },
			{ new: true, upsert: true, setDefaultsOnInsert: true }
		);

		if (!profile) {
			return res.status(500).json({ success: false, message: "Unable to save avatar" });
		}

		if (previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
			await deleteAvatarAsset({
				avatarUrl: previousAvatarUrl,
				avatarStorageId: previousAvatarStorageId,
			});
		}

		return res.status(200).json({
			success: true,
			message: "Avatar uploaded successfully",
			user: await buildUserWithProfilePayload(user),
		});
	} catch (error) {
		console.log("Error in uploadAvatar ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

// remove authenticated user avatar and fallback to initials rendering
export const removeAvatar = async (req, res) => {
	try {
		const userId = req.userId;
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		const profile = await Profile.findOne({ user: userId });
		if (profile?.avatarUrl) {
			await deleteAvatarAsset({
				avatarUrl: profile.avatarUrl,
				avatarStorageId: profile.avatarStorageId,
			});
			profile.avatarUrl = '';
			profile.avatarStorageId = '';
			await profile.save();
		}

		return res.status(200).json({
			success: true,
			message: 'Avatar removed successfully',
			user: await buildUserWithProfilePayload(user),
		});
	} catch (error) {
		console.log('Error in removeAvatar ', error);
		return res.status(500).json({ success: false, message: 'Server error' });
	}
};

// get privacy-filtered member discovery data for the members page
export const getMembersDiscovery = async (req, res) => {
	try {
		const currentUserId = String(req.userId || "");
		const currentUserProfile = await Profile.findOne({ user: currentUserId }).lean();
		const currentCircleSet = new Set(
			(Array.isArray(currentUserProfile?.jamCircleMembers) ? currentUserProfile.jamCircleMembers : [])
				.map((id) => String(id))
		);
		const currentBlockedSet = getIdSet(currentUserProfile?.blockedMembers);

		const profiles = await Profile.find({})
			.populate("user", "firstName lastName role")
			.lean();

		const members = profiles
			.filter((profile) => profile?.user)
			.filter((profile) => !isAdminRole(profile?.user?.role))
			.filter((profile) => {
				const memberUserId = String(profile.user._id);
				if (memberUserId === currentUserId) return true;

				if (!canViewMemberInDiscovery(currentUserProfile, profile, currentUserId, memberUserId)) {
					return false;
				}

				const memberBlockedSet = getIdSet(profile?.blockedMembers);
				const isBlockedEitherDirection = currentBlockedSet.has(memberUserId) || memberBlockedSet.has(currentUserId);
				return !isBlockedEitherDirection;
			})
			.map((profile) => {
				const memberUserId = String(profile.user._id);
				const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
					? profile.pendingCircleInvitations
					: [];
				const hasPendingInviteFromCurrentUser = pendingInvites.some((invite) => String(invite?.invitedBy || "") === currentUserId);
				const isCurrentUser = memberUserId === currentUserId;
				const isInJamCircle = currentCircleSet.has(memberUserId);

				return {
					...buildPublicMemberPayload(profile, currentUserProfile, currentUserId),
					isCurrentUser,
					isInJamCircle,
					hasPendingInviteFromCurrentUser,
				};
			});

		const organisations = await Organisation.find({
			$or: [
				{ organisationName: { $exists: true, $ne: "" } },
				{ bio: { $exists: true, $ne: "" } },
				{ imageUrl: { $exists: true, $ne: "" } },
			],
		}).lean();

		const organisationOwnerIds = organisations
			.map((organisation) => String(organisation?.user || ""))
			.filter(Boolean);
		const ownerProfiles = await Profile.find({ user: { $in: organisationOwnerIds } }).lean();
		const ownerProfilesByUserId = new Map(ownerProfiles.map((profile) => [String(profile?.user || ""), profile]));

		const organisationEntries = organisations
			.filter((organisation) => {
				const ownerUserId = String(organisation?.user || "");
				if (!ownerUserId) return false;
				const ownerProfile = ownerProfilesByUserId.get(ownerUserId);
				if (!ownerProfile) return true;

				const ownerBlockedSet = getIdSet(ownerProfile?.blockedMembers);
				const isBlockedEitherDirection = currentBlockedSet.has(ownerUserId) || ownerBlockedSet.has(currentUserId);
				return !isBlockedEitherDirection;
			})
			.map((organisation) => ({
				...buildPublicOrganisationPayload(
					organisation,
					currentUserId,
					ownerProfilesByUserId.get(String(organisation?.user || "")) || null
				),
				isInJamCircle: currentCircleSet.has(String(organisation?.user || "")),
				hasPendingInviteFromCurrentUser: false,
			}));

		return res.status(200).json({
			success: true,
			members: [...members, ...organisationEntries],
		});
	} catch (error) {
		console.log("Error in getMembersDiscovery ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

// get one member or organisation's public profile payload for /dashboard/members/:id
export const getMemberPublicProfile = async (req, res) => {
	try {
		const viewerUserId = String(req.userId || "");
		const { memberId } = req.params;
		if (!/^[a-f\d]{24}$/i.test(memberId)) {
			return res.status(400).json({ success: false, message: "Invalid member id" });
		}

		const viewerProfile = await Profile.findOne({ user: viewerUserId }).lean();
		const profile = await Profile.findOne({ user: memberId })
			.populate("user", "firstName lastName")
			.lean();

		if (profile?.user && canViewMemberProfile(viewerProfile, profile, viewerUserId, memberId)) {
			if (hasBlockingRelationship(viewerProfile, profile, viewerUserId, memberId)) {
				return res.status(404).json({ success: false, message: "Member not available" });
			}

			const jamCircleMembers = await getJamCircleMembersPayload(profile.jamCircleMembers);
			return res.status(200).json({
				success: true,
				member: {
					...buildPublicMemberPayload(profile, viewerProfile, viewerUserId),
					jamCircleMembers,
					isCurrentUser: String(memberId) === viewerUserId,
				},
			});
		}

		const organisation = await Organisation.findById(memberId).lean();
		if (!organisation) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		const ownerUserId = String(organisation.user || "");
		const ownerProfile = ownerUserId ? await Profile.findOne({ user: ownerUserId }).lean() : null;
		if (ownerProfile && hasBlockingRelationship(viewerProfile, ownerProfile, viewerUserId, ownerUserId)) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		return res.status(200).json({
			success: true,
			member: {
				...buildPublicOrganisationPayload(organisation, viewerUserId, ownerProfile),
				jamCircleMembers: [],
				activityFeed: [],
			},
		});
	} catch (error) {
		console.log("Error in getMemberPublicProfile ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

// redirect to a member's or organisation's allowed social link for members-page icon clicks
export const redirectMemberSocialLink = async (req, res) => {
	try {
		const viewerUserId = String(req.userId || "");
		const { memberId, platform } = req.params;
		const supportedPlatforms = ["instagram", "facebook", "youtube", "linkedin", "website"];

		if (!/^[a-f\d]{24}$/i.test(memberId)) {
			return res.status(400).json({ success: false, message: "Invalid member id" });
		}

		if (!supportedPlatforms.includes(platform)) {
			return res.status(400).json({ success: false, message: "Invalid social platform" });
		}

		const [viewerProfile, profile] = await Promise.all([
			Profile.findOne({ user: viewerUserId }).lean(),
			Profile.findOne({ user: memberId }).lean(),
		]);

		if (canViewMemberProfile(viewerProfile, profile, viewerUserId, memberId)) {
			if (hasBlockingRelationship(viewerProfile, profile, viewerUserId, memberId)) {
				return res.status(404).json({ success: false, message: "Member not available" });
			}

			const memberLink = normalizeSocialUrl(profile[platform]);
			if (!memberLink) {
				return res.status(404).json({ success: false, message: "Social link not found" });
			}

			return res.redirect(memberLink);
		}

		const organisation = await Organisation.findById(memberId).lean();
		if (!organisation) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		const ownerUserId = String(organisation.user || "");
		const ownerProfile = ownerUserId ? await Profile.findOne({ user: ownerUserId }).lean() : null;
		if (ownerProfile && hasBlockingRelationship(viewerProfile, ownerProfile, viewerUserId, ownerUserId)) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		const organisationLink = normalizeSocialUrl(organisation[platform]);
		if (!organisationLink) {
			return res.status(404).json({ success: false, message: "Social link not found" });
		}

		return res.redirect(organisationLink);
	} catch (error) {
		console.log("Error in redirectMemberSocialLink ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const contactMember = async (req, res) => {
	try {
		const senderUserId = String(req.userId || "");
		const { memberId } = req.params;

		if (!/^[a-f\d]{24}$/i.test(memberId)) {
			return res.status(400).json({ success: false, message: "Invalid member id" });
		}

		if (senderUserId === String(memberId)) {
			return res.status(400).json({ success: false, message: "You cannot contact yourself" });
		}

		const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
		const allowEmailContact = parseBooleanField(req.body?.allowEmailContact);
		const allowPhoneContact = parseBooleanField(req.body?.allowPhoneContact);

		if (!message) {
			return res.status(400).json({ success: false, message: "Please provide a message before sending." });
		}

		if (countWords(message) > CONTACT_MESSAGE_MAX_WORDS) {
			return res.status(400).json({ success: false, message: `Message must be ${CONTACT_MESSAGE_MAX_WORDS} words or fewer.` });
		}

		if (!allowEmailContact && !allowPhoneContact) {
			return res.status(400).json({ success: false, message: "Choose at least one contact method." });
		}

		const [senderUser, senderProfile, targetUser, targetProfile] = await Promise.all([
			User.findById(senderUserId),
			Profile.findOne({ user: senderUserId }),
			User.findById(memberId),
			Profile.findOne({ user: memberId }),
		]);

		if (!senderUser || !senderProfile || !targetUser || !targetProfile) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		if (hasBlockingRelationship(senderProfile, targetProfile, senderUserId, memberId)) {
			return res.status(403).json({ success: false, message: "You cannot contact this member" });
		}

		if (!canContactMember(senderProfile, targetProfile, senderUserId, memberId)) {
			return res.status(403).json({ success: false, message: "This member is not accepting contact requests from you." });
		}

		const senderDisplayFirstName = (senderProfile.displayFirstName || senderUser.firstName || "").trim();
		const senderDisplayLastName = (senderProfile.displayLastName || senderUser.lastName || "").trim();
		const senderName = `${senderDisplayFirstName} ${senderDisplayLastName}`.trim() || "Swinggity Member";

		const targetDisplayFirstName = (targetProfile.displayFirstName || targetUser.firstName || "").trim();
		const targetDisplayLastName = (targetProfile.displayLastName || targetUser.lastName || "").trim();
		const targetName = `${targetDisplayFirstName} ${targetDisplayLastName}`.trim() || "Swinggity Member";

		const senderContactEmail = (senderProfile.contactEmail || senderUser.email || "").trim();
		const senderPhoneNumber = (senderProfile.phoneNumber || "").trim();
		const recipientEmail = (targetProfile.contactEmail || targetUser.email || "").trim();

		if (!recipientEmail) {
			return res.status(400).json({ success: false, message: "This member does not have a contact email configured." });
		}

		if (allowEmailContact && !senderContactEmail) {
			return res.status(400).json({ success: false, message: "You haven't provided your email. Please update your profile or use phone contact only." });
		}

		if (allowPhoneContact && !senderPhoneNumber) {
			return res.status(400).json({ success: false, message: "You haven't provided your phone number. Please update your profile or use email contact only." });
		}

		const contactMethods = [];
		if (allowEmailContact) {
			contactMethods.push(`<li><strong>Email:</strong> ${escapeHtml(senderContactEmail)}</li>`);
		}
		if (allowPhoneContact) {
			contactMethods.push(`<li><strong>Phone:</strong> ${escapeHtml(senderPhoneNumber)}</li>`);
		}

		await sendMemberContactRequestEmail({
			recipientEmail,
			recipientName: escapeHtml(targetName),
			senderName: escapeHtml(senderName),
			senderMessage: escapeHtml(message),
			contactMethodsHtml: contactMethods.join(""),
		});

		return res.status(200).json({
			success: true,
			message: "Your message has been sent.",
		});
	} catch (error) {
		console.log("Error in contactMember ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const inviteMemberToJamCircle = async (req, res) => {
	try {
		const inviterUserId = String(req.userId || "");
		const { memberId } = req.params;

		if (!/^[a-f\d]{24}$/i.test(memberId)) {
			return res.status(400).json({ success: false, message: "Invalid member id" });
		}

		if (inviterUserId === String(memberId)) {
			return res.status(400).json({ success: false, message: "You cannot invite yourself" });
		}

		const inviterUser = await User.findById(inviterUserId);
		const inviterProfile = await Profile.findOne({ user: inviterUserId });
		const inviteeUser = await User.findById(memberId);
		const inviteeProfile = await Profile.findOne({ user: memberId });

		if (!inviterUser || !inviteeUser || !inviterProfile || !inviteeProfile) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		if (!canJamCircleInvite({ inviterRole: inviterUser.role, inviteeRole: inviteeUser.role })) {
			if (isAdminRole(inviterUser.role)) {
				return res.status(403).json({ success: false, message: "Admin accounts cannot add members to a Jam Circle" });
			}

			return res.status(403).json({ success: false, message: "You cannot add an admin account to your Jam Circle" });
		}

		if (hasBlockingRelationship(inviterProfile, inviteeProfile, inviterUserId, memberId)) {
			return res.status(403).json({ success: false, message: "You cannot invite this member" });
		}

		const alreadyInCircle = (Array.isArray(inviterProfile.jamCircleMembers) ? inviterProfile.jamCircleMembers : [])
			.some((id) => String(id) === String(memberId));
		if (alreadyInCircle) {
			return res.status(400).json({ success: false, message: "This member is already in your Jam Circle" });
		}

		const activeInviteExists = (Array.isArray(inviteeProfile.pendingCircleInvitations) ? inviteeProfile.pendingCircleInvitations : [])
			.some((invite) => String(invite?.invitedBy || "") === inviterUserId && invite?.expiresAt && new Date(invite.expiresAt).getTime() > Date.now());
		if (activeInviteExists) {
			return res.status(400).json({ success: false, message: "You already sent an active invitation to this member" });
		}

		const invitationToken = crypto.randomBytes(32).toString("hex");
		const invitationTokenHash = crypto.createHash("sha256").update(invitationToken).digest("hex");
		const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		const inviterDisplayFirstName = inviterProfile.displayFirstName?.trim() || inviterUser.firstName;
		const inviterDisplayLastName = inviterProfile.displayLastName?.trim() || inviterUser.lastName;
		const inviterName = `${inviterDisplayFirstName} ${inviterDisplayLastName}`.trim() || "A Swinggity member";
		const inviterAvatarAbsolute = resolveAbsoluteAssetUrl(req, inviterProfile.avatarUrl);
		const fallbackAvatar = "https://ui-avatars.com/api/?name=Swinggity+Member&background=FF6699&color=ffffff&size=256";
		const avatarForEmail = inviterAvatarAbsolute || fallbackAvatar;

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const encodedToken = encodeURIComponent(invitationToken);
		const acceptUrl = `${baseUrl}/api/auth/circle-invitations/respond?token=${encodedToken}&action=accept`;
		const denyUrl = `${baseUrl}/api/auth/circle-invitations/respond?token=${encodedToken}&action=deny`;

		inviteeProfile.pendingCircleInvitations = [
			...(Array.isArray(inviteeProfile.pendingCircleInvitations) ? inviteeProfile.pendingCircleInvitations : []),
			{
				tokenHash: invitationTokenHash,
				invitedBy: inviterUser._id,
				invitedByName: inviterName,
				invitedByAvatarUrl: inviterProfile.avatarUrl || "",
				invitedAt: new Date(),
				expiresAt: inviteExpiresAt,
			},
		];

		await inviteeProfile.save();

		await sendJamCircleInviteEmail(inviteeUser.email, inviterName, avatarForEmail, acceptUrl, denyUrl);

		return res.status(200).json({
			success: true,
			message: "Invitation sent successfully",
		});
	} catch (error) {
		console.log("Error in inviteMemberToJamCircle ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const respondToJamCircleInvite = async (req, res) => {
	try {
		const { token, action } = req.query;
		if (!token || typeof token !== "string") {
			return res.status(400).send("Invalid invitation token.");
		}

		if (action !== "accept" && action !== "deny") {
			return res.status(400).send("Invalid invitation action.");
		}

		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
		const inviteeProfile = await Profile.findOne({ "pendingCircleInvitations.tokenHash": tokenHash });
		if (!inviteeProfile) {
			return res.status(404).send("This invitation was not found or has already been used.");
		}

		const pendingInvites = Array.isArray(inviteeProfile.pendingCircleInvitations)
			? inviteeProfile.pendingCircleInvitations
			: [];
		const invitation = pendingInvites.find((item) => item?.tokenHash === tokenHash);
		if (!invitation) {
			return res.status(404).send("This invitation was not found or has already been used.");
		}

		if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
			inviteeProfile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
			await inviteeProfile.save();
			return res.status(410).send("This invitation has expired.");
		}

		inviteeProfile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);

		const inviterUserId = String(invitation.invitedBy);
		const inviteeUser = await User.findById(inviteeProfile.user).select("role");
		const isAdminInvitee = isAdminRole(inviteeUser?.role);

		if (action === "accept") {
			if (isAdminInvitee) {
				await inviteeProfile.save();
				return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Jam Circle Invitation Denied</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; max-width: 620px; margin: 40px auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0;">Invitation denied</h1>
  </div>
  <div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin: 0;">Admin accounts cannot accept Jam Circle invitations.</p>
  </div>
</body>
</html>
`);
			}

			const inviteeMembers = new Set((Array.isArray(inviteeProfile.jamCircleMembers) ? inviteeProfile.jamCircleMembers : []).map((id) => String(id)));
			inviteeMembers.add(inviterUserId);
			inviteeProfile.jamCircleMembers = [...inviteeMembers];

			await Profile.findOneAndUpdate(
				{ user: inviterUserId },
				{ $addToSet: { jamCircleMembers: inviteeProfile.user } },
				{ new: true, upsert: true, setDefaultsOnInsert: true }
			);
		}

		await inviteeProfile.save();

		const statusText = action === "accept" ? "accepted" : "denied";
		const actionMessage = action === "accept"
			? "Invitation accepted. This member is now in your Jam Circle."
			: "Invitation denied. No changes were made to your Jam Circle.";
		return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Jam Circle Invitation ${statusText}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; max-width: 620px; margin: 40px auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; text-transform: capitalize;">Invitation ${statusText}</h1>
  </div>
  <div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin: 0;">${actionMessage}</p>
  </div>
</body>
</html>
`);
	} catch (error) {
		console.log("Error in respondToJamCircleInvite ", error);
		return res.status(500).send("Something went wrong while processing this invitation.");
	}
};

export const getMyJamCircle = async (req, res) => {
	try {
		const userId = String(req.userId || "");
		const profile = await Profile.findOne({ user: userId }).lean();
		if (!profile) {
			return res.status(200).json({ success: true, members: [] });
		}

		const memberIds = (Array.isArray(profile.jamCircleMembers) ? profile.jamCircleMembers : []).map((id) => String(id));
		if (memberIds.length === 0) {
			return res.status(200).json({ success: true, members: [] });
		}

		const circleProfiles = await Profile.find({ user: { $in: memberIds } })
			.populate("user", "firstName lastName")
			.lean();

		const byUserId = new Map(circleProfiles.map((item) => [String(item?.user?._id), item]));
		const members = memberIds
			.map((id) => buildJamCircleMemberPayload(byUserId.get(id)))
			.filter(Boolean);

		return res.status(200).json({ success: true, members });
	} catch (error) {
		console.log("Error in getMyJamCircle ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const removeJamCircleMember = async (req, res) => {
	try {
		const userId = String(req.userId || "");
		const { memberId } = req.params;

		if (!/^[a-f\d]{24}$/i.test(memberId)) {
			return res.status(400).json({ success: false, message: "Invalid member id" });
		}

		if (userId === String(memberId)) {
			return res.status(400).json({ success: false, message: "You cannot remove yourself" });
		}

		const [myProfile, memberProfile] = await Promise.all([
			Profile.findOne({ user: userId }),
			Profile.findOne({ user: memberId }),
		]);

		if (!myProfile || !memberProfile) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		myProfile.jamCircleMembers = (Array.isArray(myProfile.jamCircleMembers) ? myProfile.jamCircleMembers : [])
			.filter((id) => String(id) !== String(memberId));
		memberProfile.jamCircleMembers = (Array.isArray(memberProfile.jamCircleMembers) ? memberProfile.jamCircleMembers : [])
			.filter((id) => String(id) !== userId);

		await Promise.all([myProfile.save(), memberProfile.save()]);

		return res.status(200).json({
			success: true,
			message: "Member removed from your Jam Circle",
		});
	} catch (error) {
		console.log("Error in removeJamCircleMember ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const blockMember = async (req, res) => {
	try {
		const userId = String(req.userId || "");
		const { memberId } = req.params;

		if (!/^[a-f\d]{24}$/i.test(memberId)) {
			return res.status(400).json({ success: false, message: "Invalid member id" });
		}

		if (userId === String(memberId)) {
			return res.status(400).json({ success: false, message: "You cannot block yourself" });
		}

		const [myProfile, memberProfile] = await Promise.all([
			Profile.findOne({ user: userId }),
			Profile.findOne({ user: memberId }),
		]);

		if (!myProfile || !memberProfile) {
			return res.status(404).json({ success: false, message: "Member not available" });
		}

		const blockedSet = getIdSet(myProfile.blockedMembers);
		blockedSet.add(String(memberId));
		myProfile.blockedMembers = [...blockedSet];

		myProfile.jamCircleMembers = (Array.isArray(myProfile.jamCircleMembers) ? myProfile.jamCircleMembers : [])
			.filter((id) => String(id) !== String(memberId));
		memberProfile.jamCircleMembers = (Array.isArray(memberProfile.jamCircleMembers) ? memberProfile.jamCircleMembers : [])
			.filter((id) => String(id) !== userId);

		myProfile.pendingCircleInvitations = (Array.isArray(myProfile.pendingCircleInvitations) ? myProfile.pendingCircleInvitations : [])
			.filter((invite) => String(invite?.invitedBy || "") !== String(memberId));
		memberProfile.pendingCircleInvitations = (Array.isArray(memberProfile.pendingCircleInvitations) ? memberProfile.pendingCircleInvitations : [])
			.filter((invite) => String(invite?.invitedBy || "") !== userId);

		await Promise.all([myProfile.save(), memberProfile.save()]);

		return res.status(200).json({
			success: true,
			message: "Member blocked",
		});
	} catch (error) {
		console.log("Error in blockMember ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getBlockedMembers = async (req, res) => {
	try {
		const userId = String(req.userId || "");
		const profile = await Profile.findOne({ user: userId }).lean();
		if (!profile) {
			return res.status(200).json({ success: true, members: [] });
		}

		const memberIds = (Array.isArray(profile.blockedMembers) ? profile.blockedMembers : []).map((id) => String(id));
		const members = await getJamCircleMembersPayload(memberIds);

		return res.status(200).json({ success: true, members });
	} catch (error) {
		console.log("Error in getBlockedMembers ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const unblockMember = async (req, res) => {
	try {
		const userId = String(req.userId || "");
		const { memberId } = req.params;

		if (!/^[a-f\d]{24}$/i.test(memberId)) {
			return res.status(400).json({ success: false, message: "Invalid member id" });
		}

		const profile = await Profile.findOne({ user: userId });
		if (!profile) {
			return res.status(404).json({ success: false, message: "Profile not found" });
		}

		profile.blockedMembers = (Array.isArray(profile.blockedMembers) ? profile.blockedMembers : [])
			.filter((id) => String(id) !== String(memberId));
		await profile.save();

		return res.status(200).json({ success: true, message: "Member unblocked" });
	} catch (error) {
		console.log("Error in unblockMember ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getPendingCircleInvitations = async (req, res) => {
	try {
		const userId = String(req.userId || "");
		const profile = await Profile.findOne({ user: userId })
			.populate("pendingCircleInvitations.invitedBy", "firstName lastName")
			.lean();

		if (!profile) {
			return res.status(200).json({ success: true, invitations: [] });
		}

		const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
			? profile.pendingCircleInvitations.filter((invite) => {
				const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
				return expiresAt > Date.now();
			})
			: [];

		const formattedInvitations = pendingInvites.map((invite) => ({
			tokenHash: invite?.tokenHash || "",
			invitedBy: invite?.invitedBy?._id || invite?.invitedBy || "",
			inviterName: invite?.invitedByName || "A Swinggity member",
			inviterAvatarUrl: invite?.invitedByAvatarUrl || "",
			invitedAt: invite?.invitedAt || new Date(),
			expiresAt: invite?.expiresAt || new Date(),
		}));

		return res.status(200).json({ success: true, invitations: formattedInvitations });
	} catch (error) {
		console.log("Error in getPendingCircleInvitations ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
};

export const respondToCircleInvitationInApp = async (req, res) => {
	try {
		const userId = String(req.userId || "");
		const { tokenHash, action } = req.body;

		if (!tokenHash || typeof tokenHash !== "string") {
			return res.status(400).json({ success: false, message: "Invalid invitation token" });
		}

		if (action !== "accept" && action !== "deny") {
			return res.status(400).json({ success: false, message: "Invalid action" });
		}

		const profile = await Profile.findOne({ user: userId });
		const user = await User.findById(userId).select("role");
		if (!profile) {
			return res.status(404).json({ success: false, message: "Profile not found" });
		}

		const isAdminUser = isAdminRole(user?.role);

		const pendingInvites = Array.isArray(profile.pendingCircleInvitations)
			? profile.pendingCircleInvitations
			: [];
		const invitation = pendingInvites.find((item) => item?.tokenHash === tokenHash);

		if (!invitation) {
			return res.status(404).json({ success: false, message: "Invitation not found" });
		}

		if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
			profile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);
			await profile.save();
			return res.status(410).json({ success: false, message: "This invitation has expired" });
		}

		profile.pendingCircleInvitations = pendingInvites.filter((item) => item?.tokenHash !== tokenHash);

		const inviterUserId = String(invitation.invitedBy);

		if (action === "accept") {
			if (isAdminUser) {
				await profile.save();
				return res.status(403).json({ success: false, message: "Admin accounts cannot accept Jam Circle invitations" });
			}

			const myMembers = new Set((Array.isArray(profile.jamCircleMembers) ? profile.jamCircleMembers : []).map((id) => String(id)));
			myMembers.add(inviterUserId);
			profile.jamCircleMembers = [...myMembers];

			await Profile.findOneAndUpdate(
				{ user: inviterUserId },
				{ $addToSet: { jamCircleMembers: profile.user } },
				{ new: true, upsert: true, setDefaultsOnInsert: true }
			);
		}

		await profile.save();

		return res.status(200).json({
			success: true,
			message: action === "accept" ? "Invitation accepted" : "Invitation denied",
		});
	} catch (error) {
		console.log("Error in respondToCircleInvitationInApp ", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
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