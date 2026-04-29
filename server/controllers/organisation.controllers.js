// The code in this file were created with help of AI (Copilot)

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { User } from "../models/user.model.js";
import { Organisation } from "../models/organisation.model.js";
import { Profile } from "../models/profile.model.js";
import { sendOrganisationParticipantInviteEmail } from "../mailtrap/emails.js";

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

/**
 * isAllowedRole: handles this function's core responsibility.
 */
const isAllowedRole = (role) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalized = String(role || "").trim().toLowerCase();
    return normalized === "organiser" || normalized === "organizer";
};

/**
 * isEligibleParticipantRole: handles this function's core responsibility.
 */
const isEligibleParticipantRole = (role) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalized = String(role || "").trim().toLowerCase();
    return normalized === "organiser" || normalized === "organizer";
};

const ORGANISATION_INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * isValidObjectIdString: handles this function's core responsibility.
 */
const isValidObjectIdString = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

/**
 * buildParticipantContactKey: handles this function's core responsibility.
 */
const buildParticipantContactKey = (entry) => {
    // Guard clauses and normalization keep request handling predictable.
    const userId = asTrimmedString(entry?.user || entry?.userId);
    const entityType = asTrimmedString(entry?.entityType) === "organisation" ? "organisation" : "member";
    const organisationId = asTrimmedString(entry?.organisationId);
    return `${userId}|${entityType}|${organisationId}`;
};

/**
 * buildParticipantContactPayload: handles this function's core responsibility.
 */
const buildParticipantContactPayload = (entry) => ({
    user: asTrimmedString(entry?.user || entry?.userId),
    entityType: asTrimmedString(entry?.entityType) === "organisation" ? "organisation" : "member",
    organisationId: asTrimmedString(entry?.organisationId) || null,
    displayName: asTrimmedString(entry?.displayName).slice(0, 120),
    avatarUrl: asTrimmedString(entry?.avatarUrl).slice(0, 500),
});

/**
 * buildProfileDisplayName: handles this function's core responsibility.
 */
const buildProfileDisplayName = (profile, user) => {
    // Guard clauses and normalization keep request handling predictable.
    const firstName = asTrimmedString(profile?.displayFirstName || user?.firstName);
    const lastName = asTrimmedString(profile?.displayLastName || user?.lastName);
    return `${firstName} ${lastName}`.trim() || asTrimmedString(user?.email) || "Swinggity Member";
};

/**
 * resolveAbsoluteAssetUrl: handles this function's core responsibility.
 */
const resolveAbsoluteAssetUrl = (req, rawUrl) => {
    // Guard clauses and normalization keep request handling predictable.
    const trimmed = asTrimmedString(rawUrl);
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${req.protocol}://${req.get("host")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
};

/**
 * findOrganisationByParticipantUserId: handles this function's core responsibility.
 */
const findOrganisationByParticipantUserId = async (userId) => Organisation.findOne({
    "participantContacts.user": userId,
}).lean();

/**
 * getPendingOrganisationParticipantContacts: handles this function's core responsibility.
 */
const getPendingOrganisationParticipantContacts = async (organisationId) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!isValidObjectIdString(organisationId)) return [];

    const profiles = await Profile.find({
        "pendingOrganisationInvitations.organisationId": organisationId,
    })
        .populate("user", "firstName lastName email")
        .lean();

    const now = Date.now();
    const pending = [];

    for (const profile of profiles) {
        const invites = Array.isArray(profile?.pendingOrganisationInvitations)
            ? profile.pendingOrganisationInvitations
            : [];
        const activeInvite = invites.find((invite) => {
            if (String(invite?.organisationId || "") !== String(organisationId || "")) return false;
            const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
            return expiresAt > now;
        });

        if (!activeInvite) continue;

        const displayName = asTrimmedString(activeInvite?.contactDisplayName)
            || `${asTrimmedString(profile?.displayFirstName || profile?.user?.firstName)} ${asTrimmedString(profile?.displayLastName || profile?.user?.lastName)}`.trim()
            || asTrimmedString(profile?.user?.email)
            || "Swinggity Member";

        pending.push({
            userId: String(profile?.user?._id || profile?.user || ""),
            entityType: "member",
            organisationId: "",
            displayName,
            avatarUrl: asTrimmedString(profile?.avatarUrl),
            inviteStatus: "pending",
        });
    }

    return pending;
};

/**
 * normalizeSocialUrl: handles this function's core responsibility.
 */
const normalizeSocialUrl = (value) => {
    // Guard clauses and normalization keep request handling predictable.
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

/**
 * sanitizeTextField: handles this function's core responsibility.
 */
const sanitizeTextField = (value, fieldName, maxLength) => {
    // Guard clauses and normalization keep request handling predictable.
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

/**
 * asTrimmedString: handles this function's core responsibility.
 */
const asTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * asIdString: handles this function's core responsibility.
 */
const asIdString = (value) => {
    // Guard clauses and normalization keep request handling predictable.
    if (value === null || value === undefined) return "";
    return String(value).trim();
};

/**
 * normalizeParticipantContacts: handles this function's core responsibility.
 */
const normalizeParticipantContacts = (value) => {
    // Guard clauses and normalization keep request handling predictable.
    if (value === undefined) {
        return { isProvided: false };
    }

    if (!Array.isArray(value)) {
        return { isProvided: true, error: "Participant contacts must be an array" };
    }

    const dedupe = new Set();
    const normalized = [];

    for (const entry of value) {
        if (!entry || typeof entry !== "object") continue;

        const userId = asTrimmedString(entry.userId || entry.user);
        if (!userId) continue;

        const entityType = asTrimmedString(entry.entityType) === "organisation" ? "organisation" : "member";
        const organisationId = asTrimmedString(entry.organisationId);
        const displayName = asTrimmedString(entry.displayName).slice(0, 120);
        const avatarUrl = asTrimmedString(entry.avatarUrl).slice(0, 500);
        const key = `${userId}|${entityType}|${organisationId}`;

        if (dedupe.has(key)) continue;
        dedupe.add(key);

        normalized.push({
            user: userId,
            entityType,
            organisationId: organisationId || null,
            displayName,
            avatarUrl,
        });

        if (normalized.length >= 50) break;
    }

    return { isProvided: true, value: normalized };
};

/**
 * validateParticipantContactUsers: handles this function's core responsibility.
 */
const validateParticipantContactUsers = async ({ participantContacts, ownerUserId }) => {
    // Guard clauses and normalization keep request handling predictable.
    const normalizedOwnerId = asTrimmedString(ownerUserId);
    const userIds = Array.from(
        new Set(
            (Array.isArray(participantContacts) ? participantContacts : [])
                .map((entry) => asTrimmedString(entry?.user))
                .filter(Boolean)
        )
    );

    const participantUserIds = userIds.filter((id) => id !== normalizedOwnerId);

    if (participantUserIds.length === 0) {
        return { valid: true };
    }

    const users = await User.find({ _id: { $in: participantUserIds } }, "role").lean();
    const rolesById = new Map(users.map((entry) => [String(entry?._id || ""), String(entry?.role || "").trim().toLowerCase()]));

    const hasInvalidUser = participantUserIds.some((id) => {
        const role = rolesById.get(id);
        return !role || !isEligibleParticipantRole(role);
    });

    if (hasInvalidUser) {
        return { valid: false, error: "Participant contacts must be organiser accounts" };
    }

    return { valid: true };
};

/**
 * buildParticipantsSummary: handles this function's core responsibility.
 */
const buildParticipantsSummary = (participantContacts) => {
    // Guard clauses and normalization keep request handling predictable.
    /**
     * names: handles this function's core responsibility.
     */
    const names = (Array.isArray(participantContacts) ? participantContacts : [])
        .map((entry) => asTrimmedString(entry?.displayName))
        .filter(Boolean)
        .slice(0, 20);

    return names.join(", ").slice(0, 400);
};

/**
 * sanitizeSocialField: handles this function's core responsibility.
 */
const sanitizeSocialField = (value, fieldName) => {
    // Guard clauses and normalization keep request handling predictable.
    const validated = sanitizeTextField(value, fieldName, 120);
    if (!validated.isProvided || validated.error) {
        return validated;
    }

    if (!validated.value) {
        return validated;
    }

    const normalized = normalizeSocialUrl(validated.value);
    if (!normalized) {
        return { isProvided: true, error: `${fieldName} must be a valid URL` };
    }

    return { isProvided: true, value: normalized };
};

/**
 * getOrganisationImageCloudPublicId: handles this function's core responsibility.
 */
const getOrganisationImageCloudPublicId = (userId) => `organisation-${String(userId || "unknown")}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

/**
 * uploadOrganisationImageToCloudinary: handles this function's core responsibility.
 */
const uploadOrganisationImageToCloudinary = async ({ fileBuffer, mimeType, userId }) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!isCloudinaryConfigured) {
        throw new Error("Cloudinary is not configured");
    }

    const publicId = getOrganisationImageCloudPublicId(userId);
    const payload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                resource_type: "image",
                overwrite: true,
                invalidate: true,
                folder: "swinggity/organisations",
                format: (mimeType || "").includes("png") ? "png" : undefined,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error("Cloud image upload failed"));
                    return;
                }
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });

    return {
        imageUrl: payload.secure_url,
        imageStorageId: payload.public_id,
    };
};

/**
 * deleteCloudinaryImage: handles this function's core responsibility.
 */
const deleteCloudinaryImage = async (imageStorageId) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!isCloudinaryConfigured || !imageStorageId) return;

    await cloudinary.uploader.destroy(imageStorageId, {
        resource_type: "image",
        invalidate: true,
    }).catch(() => undefined);
};

/**
 * deleteImageFileIfLocal: handles this function's core responsibility.
 */
const deleteImageFileIfLocal = async (imageUrl) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!imageUrl || !imageUrl.startsWith("/uploads/avatars/")) {
        return;
    }

    const absoluteImagePath = path.join(__dirname, "..", imageUrl.replace(/^\//, "").replace(/\//g, path.sep));
    await fs.unlink(absoluteImagePath).catch(() => undefined);
};

/**
 * deleteImageAsset: handles this function's core responsibility.
 */
const deleteImageAsset = async ({ imageUrl, imageStorageId }) => {
    // Guard clauses and normalization keep request handling predictable.
    if (imageStorageId) {
        await deleteCloudinaryImage(imageStorageId);
        return;
    }

    await deleteImageFileIfLocal(imageUrl);
};

/**
 * buildOrganisationPayload: handles this function's core responsibility.
 */
const buildOrganisationPayload = (organisation, options = {}) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!organisation) {
        return null;
    }

    const pendingParticipantContacts = Array.isArray(options.pendingParticipantContacts)
        ? options.pendingParticipantContacts
        : [];

    return {
        id: organisation?._id || null,
        userId: organisation?.user || null,
        organisationName: organisation.organisationName || "",
        imageUrl: organisation.imageUrl || "",
        bio: organisation.bio || "",
        instagram: organisation.instagram || "",
        facebook: organisation.facebook || "",
        youtube: organisation.youtube || "",
        linkedin: organisation.linkedin || "",
        website: organisation.website || "",
        participants: organisation.participants || "",
        participantContacts: Array.isArray(organisation.participantContacts)
            ? organisation.participantContacts.map((entry) => ({
                userId: String(entry?.user || ""),
                entityType: entry?.entityType === "organisation" ? "organisation" : "member",
                organisationId: String(entry?.organisationId || ""),
                displayName: entry?.displayName || "",
                avatarUrl: entry?.avatarUrl || "",
                inviteStatus: "accepted",
            }))
            : [],
        pendingParticipantContacts,
        updatedAt: organisation.updatedAt || null,
    };
};

/**
 * appendOrganisationResponseNotification: handles this function's core responsibility.
 */
const appendOrganisationResponseNotification = async ({ invitation, inviteeProfile, action }) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!invitation || (action !== "accept" && action !== "deny")) return;

    const inviterUserId = asIdString(invitation?.invitedBy);
    if (!isValidObjectIdString(inviterUserId)) return;

    const responseItem = {
        organisationId: invitation.organisationId,
        organisationName: asTrimmedString(invitation?.organisationName).slice(0, 120),
        inviteeUser: inviteeProfile.user,
        inviteeName: asTrimmedString(invitation?.contactDisplayName)
            || buildProfileDisplayName(inviteeProfile, null),
        inviteeAvatarUrl: asTrimmedString(inviteeProfile?.avatarUrl),
        response: action,
        respondedAt: new Date(),
    };

    const inviterProfile = await Profile.findOne({ user: inviterUserId });
    if (inviterProfile) {
        const existingResponses = Array.isArray(inviterProfile.organisationInvitationResponses)
            ? inviterProfile.organisationInvitationResponses
            : [];
        inviterProfile.organisationInvitationResponses = [responseItem, ...existingResponses].slice(0, 30);
        await inviterProfile.save();
        return;
    }

    await Profile.create({
        user: inviterUserId,
        organisationInvitationResponses: [responseItem],
    });
};

/**
 * addParticipantToOrganisation: handles this function's core responsibility.
 */
const addParticipantToOrganisation = async ({ organisationId, inviteeProfile, invitation }) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!isValidObjectIdString(organisationId)) return;

    const organisation = await Organisation.findById(organisationId);
    if (!organisation) return;

    const participantContacts = Array.isArray(organisation.participantContacts)
        ? organisation.participantContacts
        : [];

    const nextEntry = {
        user: inviteeProfile.user,
        entityType: "member",
        organisationId: null,
        displayName: asTrimmedString(invitation?.contactDisplayName)
            || buildProfileDisplayName(inviteeProfile, null),
        avatarUrl: asTrimmedString(inviteeProfile?.avatarUrl),
    };

    const nextKey = buildParticipantContactKey(nextEntry);
    const filtered = participantContacts.filter((entry) => buildParticipantContactKey(entry) !== nextKey);
    organisation.participantContacts = [...filtered, nextEntry].slice(0, 50);
    organisation.participants = buildParticipantsSummary(organisation.participantContacts);
    await organisation.save();
};

/**
 * syncParticipantInvitations: handles this function's core responsibility.
 */
const syncParticipantInvitations = async ({ req, organisation, ownerUser, desiredParticipantContacts }) => {
    // Guard clauses and normalization keep request handling predictable.
    const warnings = [];
    const ownerUserId = asIdString(ownerUser?._id);
    const organisationId = String(organisation?._id || "");
    const organisationName = asTrimmedString(organisation?.organisationName) || "Swinggity Organisation";

    /**
     * desired: handles this function's core responsibility.
     */
    const desired = (Array.isArray(desiredParticipantContacts) ? desiredParticipantContacts : [])
        .map((entry) => buildParticipantContactPayload(entry))
        .filter((entry) => asIdString(entry?.user) && asIdString(entry?.user) !== ownerUserId);

    const desiredByUserId = new Map();
    for (const entry of desired) {
        desiredByUserId.set(asIdString(entry.user), entry);
    }

    const existingAccepted = Array.isArray(organisation.participantContacts)
        ? organisation.participantContacts
        : [];
    const acceptedByUserId = new Map();
    for (const entry of existingAccepted) {
        const userId = asIdString(entry?.user);
        if (!userId || userId === ownerUserId) continue;
        acceptedByUserId.set(userId, entry);
    }

    const pendingProfiles = await Profile.find({
        "pendingOrganisationInvitations.organisationId": organisation._id,
    });
    const pendingByUserId = new Map();

    for (const profile of pendingProfiles) {
        const invites = Array.isArray(profile.pendingOrganisationInvitations)
            ? profile.pendingOrganisationInvitations
            : [];
        const activeInvite = invites.find((invite) => {
            if (String(invite?.organisationId || "") !== organisationId) return false;
            const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
            return expiresAt > Date.now();
        });

        if (activeInvite) {
            pendingByUserId.set(String(profile.user || ""), { profile, activeInvite });
        }
    }

    for (const [userId, acceptedEntry] of acceptedByUserId.entries()) {
        if (desiredByUserId.has(userId)) continue;
        organisation.participantContacts = (Array.isArray(organisation.participantContacts) ? organisation.participantContacts : [])
            .filter((entry) => asIdString(entry?.user) !== userId);
    }

    for (const [userId, pendingItem] of pendingByUserId.entries()) {
        if (desiredByUserId.has(userId)) continue;

        const currentInvites = Array.isArray(pendingItem.profile.pendingOrganisationInvitations)
            ? pendingItem.profile.pendingOrganisationInvitations
            : [];
        pendingItem.profile.pendingOrganisationInvitations = currentInvites.filter(
            (invite) => !(String(invite?.organisationId || "") === organisationId)
        );
        await pendingItem.profile.save();
    }

    const ownerProfile = await Profile.findOne({ user: ownerUserId }).lean();
    const inviterName = buildProfileDisplayName(ownerProfile, ownerUser);
    const inviterAvatarRelative = asTrimmedString(ownerProfile?.avatarUrl);
    const inviterAvatarAbsolute = resolveAbsoluteAssetUrl(req, inviterAvatarRelative)
        || "https://ui-avatars.com/api/?name=Swinggity+Member&background=FF6699&color=ffffff&size=256";

    for (const [userId, desiredEntry] of desiredByUserId.entries()) {
        if (acceptedByUserId.has(userId) || pendingByUserId.has(userId)) continue;

        const inviteeUser = await User.findById(userId).lean();
        if (!inviteeUser) {
            warnings.push(`Participant ${desiredEntry.displayName || userId} is no longer available.`);
            continue;
        }

        const inviteeProfile = await Profile.findOneAndUpdate(
            { user: userId },
            {
                $setOnInsert: {
                    displayFirstName: inviteeUser.firstName,
                    displayLastName: inviteeUser.lastName,
                },
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        const invitationToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(invitationToken).digest("hex");
        const expiresAt = new Date(Date.now() + ORGANISATION_INVITATION_EXPIRY_MS);
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const encodedToken = encodeURIComponent(invitationToken);
        const acceptUrl = `${baseUrl}/api/organisation/invitations/respond?token=${encodedToken}&action=accept`;
        const denyUrl = `${baseUrl}/api/organisation/invitations/respond?token=${encodedToken}&action=deny`;

        inviteeProfile.pendingOrganisationInvitations = [
            ...(Array.isArray(inviteeProfile.pendingOrganisationInvitations) ? inviteeProfile.pendingOrganisationInvitations : []),
            {
                tokenHash,
                organisationId: organisation._id,
                organisationName,
                invitedBy: ownerUser._id,
                invitedByName: inviterName,
                invitedByAvatarUrl: inviterAvatarRelative,
                contactDisplayName: desiredEntry.displayName || buildProfileDisplayName(inviteeProfile, inviteeUser),
                invitedAt: new Date(),
                expiresAt,
            },
        ];
        await inviteeProfile.save();

        try {
            await sendOrganisationParticipantInviteEmail({
                recipientEmail: inviteeUser.email,
                inviterName,
                inviterAvatarUrl: inviterAvatarAbsolute,
                organisationName,
                acceptUrl,
                denyUrl,
            });
        } catch {
            warnings.push(`Invite email could not be sent to ${desiredEntry.displayName || inviteeUser.email}.`);
        }
    }

    organisation.participants = buildParticipantsSummary(organisation.participantContacts);
    await organisation.save();

    return warnings;
};

/**
 * getMyOrganisation: handles this function's core responsibility.
 */
export const getMyOrganisation = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!isAllowedRole(user.role)) {
            return res.status(403).json({ success: false, message: "Only organisers can manage organisation pages" });
        }

        const organisation = await Organisation.findOne({ user: req.userId }).lean();
        const pendingParticipantContacts = organisation
            ? await getPendingOrganisationParticipantContacts(organisation._id)
            : [];

        return res.status(200).json({
            success: true,
            organisation: buildOrganisationPayload(organisation, { pendingParticipantContacts }),
        });
    } catch (error) {
        console.log("Error in getMyOrganisation", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * upsertMyOrganisation: handles this function's core responsibility.
 */
export const upsertMyOrganisation = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!isAllowedRole(user.role)) {
            return res.status(403).json({ success: false, message: "Only organisers can manage organisation pages" });
        }

        const {
            organisationName,
            bio,
            instagram,
            facebook,
            youtube,
            linkedin,
            website,
            participants,
            participantContacts,
        } = req.body;

        const validatedOrganisationName = sanitizeTextField(organisationName, "Organisation name", 120);
        const validatedBio = sanitizeTextField(bio, "Brief bio", 700);
        const validatedInstagram = sanitizeSocialField(instagram, "Instagram");
        const validatedFacebook = sanitizeSocialField(facebook, "Facebook");
        const validatedYouTube = sanitizeSocialField(youtube, "YouTube");
        const validatedLinkedin = sanitizeSocialField(linkedin, "LinkedIn");
        const validatedWebsite = sanitizeSocialField(website, "Website");
        const validatedParticipants = sanitizeTextField(participants, "Participants", 400);
        const validatedParticipantContacts = normalizeParticipantContacts(participantContacts);

        const validations = [
            validatedOrganisationName,
            validatedBio,
            validatedInstagram,
            validatedFacebook,
            validatedYouTube,
            validatedLinkedin,
            validatedWebsite,
            validatedParticipants,
            validatedParticipantContacts,
        ];

        const firstError = validations.find((validation) => validation.error);
        if (firstError) {
            return res.status(400).json({ success: false, message: firstError.error });
        }

        if (validatedParticipantContacts.isProvided) {
            const participantValidation = await validateParticipantContactUsers({
                participantContacts: validatedParticipantContacts.value,
                ownerUserId: req.userId,
            });

            if (!participantValidation.valid) {
                return res.status(400).json({ success: false, message: participantValidation.error });
            }
        }

        const updates = {};
        if (validatedOrganisationName.isProvided) updates.organisationName = validatedOrganisationName.value;
        if (validatedBio.isProvided) updates.bio = validatedBio.value;
        if (validatedInstagram.isProvided) updates.instagram = validatedInstagram.value;
        if (validatedFacebook.isProvided) updates.facebook = validatedFacebook.value;
        if (validatedYouTube.isProvided) updates.youtube = validatedYouTube.value;
        if (validatedLinkedin.isProvided) updates.linkedin = validatedLinkedin.value;
        if (validatedWebsite.isProvided) updates.website = validatedWebsite.value;
        if (validatedParticipants.isProvided) updates.participants = validatedParticipants.value;

        if (Object.keys(updates).length === 0) {
            if (!validatedParticipantContacts.isProvided) {
                return res.status(400).json({ success: false, message: "No organisation fields provided to update" });
            }
        }

        const organisation = await Organisation.findOneAndUpdate(
            { user: req.userId },
            updates,
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
                runValidators: true,
            }
        );

        let inviteWarnings = [];
        if (validatedParticipantContacts.isProvided) {
            inviteWarnings = await syncParticipantInvitations({
                req,
                organisation,
                ownerUser: user,
                desiredParticipantContacts: validatedParticipantContacts.value,
            });
        }

        const pendingParticipantContacts = await getPendingOrganisationParticipantContacts(organisation._id);

        return res.status(200).json({
            success: true,
            message: "Organisation updated successfully",
            inviteWarning: inviteWarnings.join(" ").trim(),
            organisation: buildOrganisationPayload(organisation, { pendingParticipantContacts }),
        });
    } catch (error) {
        console.log("Error in upsertMyOrganisation", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * getMyOrganisationMembershipSummary: handles this function's core responsibility.
 */
export const getMyOrganisationMembershipSummary = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const ownerOrganisation = await Organisation.findOne({ user: req.userId }).lean();
        if (ownerOrganisation) {
            const pendingParticipantContacts = await getPendingOrganisationParticipantContacts(ownerOrganisation._id);
            return res.status(200).json({
                success: true,
                membershipType: "owner",
                organisation: buildOrganisationPayload(ownerOrganisation, { pendingParticipantContacts }),
            });
        }

        const participantOrganisation = await findOrganisationByParticipantUserId(req.userId);
        if (participantOrganisation) {
            return res.status(200).json({
                success: true,
                membershipType: "participant",
                organisation: buildOrganisationPayload(participantOrganisation),
            });
        }

        return res.status(200).json({
            success: true,
            membershipType: "none",
            organisation: null,
        });
    } catch (error) {
        console.log("Error in getMyOrganisationMembershipSummary", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * getPendingOrganisationInvitations: handles this function's core responsibility.
 */
export const getPendingOrganisationInvitations = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const profile = await Profile.findOne({ user: req.userId }).lean();
        if (!profile) {
            return res.status(200).json({ success: true, invitations: [] });
        }

        /**
         * invitations: handles this function's core responsibility.
         */
        const invitations = (Array.isArray(profile.pendingOrganisationInvitations)
            ? profile.pendingOrganisationInvitations
            : [])
            .filter((invite) => {
                const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
                return expiresAt > Date.now();
            })
            .map((invite) => ({
                tokenHash: asTrimmedString(invite?.tokenHash),
                organisationId: String(invite?.organisationId || ""),
                organisationName: asTrimmedString(invite?.organisationName) || "Untitled organisation",
                invitedBy: String(invite?.invitedBy || ""),
                inviterName: asTrimmedString(invite?.invitedByName) || "A Swinggity member",
                inviterAvatarUrl: asTrimmedString(invite?.invitedByAvatarUrl),
                invitedAt: invite?.invitedAt || new Date(),
                expiresAt: invite?.expiresAt || new Date(),
                notificationType: "organisation",
                inviteText: `invited you to participate in ${asTrimmedString(invite?.organisationName) || "their organisation"}`,
            }));

        return res.status(200).json({
            success: true,
            invitations,
        });
    } catch (error) {
        console.log("Error in getPendingOrganisationInvitations", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * applyOrganisationInvitationAction: handles this function's core responsibility.
 */
const applyOrganisationInvitationAction = async ({ tokenHash, action, userId }) => {
    // Guard clauses and normalization keep request handling predictable.
    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
        return { status: 404, success: false, message: "Profile not found" };
    }

    const pendingInvites = Array.isArray(profile.pendingOrganisationInvitations)
        ? profile.pendingOrganisationInvitations
        : [];
    const invitation = pendingInvites.find((item) => asTrimmedString(item?.tokenHash) === asTrimmedString(tokenHash));

    if (!invitation) {
        return { status: 404, success: false, message: "Invitation not found" };
    }

    if (!invitation.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now()) {
        profile.pendingOrganisationInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== asTrimmedString(tokenHash));
        await profile.save();
        return { status: 410, success: false, message: "This invitation has expired" };
    }

    profile.pendingOrganisationInvitations = pendingInvites.filter((item) => asTrimmedString(item?.tokenHash) !== asTrimmedString(tokenHash));

    if (action === "accept") {
        await addParticipantToOrganisation({
            organisationId: invitation.organisationId,
            inviteeProfile: profile,
            invitation,
        });
    }

    await profile.save();
    await appendOrganisationResponseNotification({ invitation, inviteeProfile: profile, action });

    return {
        status: 200,
        success: true,
        message: action === "accept"
            ? "Organisation participant invitation accepted"
            : "Organisation participant invitation denied",
    };
};

/**
 * respondToOrganisationInvitationInApp: handles this function's core responsibility.
 */
export const respondToOrganisationInvitationInApp = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const tokenHash = asTrimmedString(req.body?.tokenHash);
        const action = req.body?.action;

        if (!tokenHash) {
            return res.status(400).json({ success: false, message: "Invalid invitation token" });
        }
        if (action !== "accept" && action !== "deny") {
            return res.status(400).json({ success: false, message: "Invalid action" });
        }

        const result = await applyOrganisationInvitationAction({
            tokenHash,
            action,
            userId: req.userId,
        });

        return res.status(result.status).json({ success: result.success, message: result.message });
    } catch (error) {
        console.log("Error in respondToOrganisationInvitationInApp", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * respondToOrganisationInvitation: handles this function's core responsibility.
 */
export const respondToOrganisationInvitation = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const token = asTrimmedString(req.query?.token);
        const action = req.query?.action;

        if (!token) {
            return res.status(400).send("Invalid invitation token.");
        }
        if (action !== "accept" && action !== "deny") {
            return res.status(400).send("Invalid invitation action.");
        }

        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const profile = await Profile.findOne({ "pendingOrganisationInvitations.tokenHash": tokenHash }).lean();
        if (!profile?.user) {
            return res.status(404).send("This invitation was not found or has already been used.");
        }

        const result = await applyOrganisationInvitationAction({
            tokenHash,
            action,
            userId: String(profile.user),
        });

        if (!result.success) {
            return res.status(result.status).send(result.message);
        }

        const statusText = action === "accept" ? "accepted" : "denied";
        const actionMessage = action === "accept"
            ? "Invitation accepted. The organisation now appears on your profile."
            : "Invitation denied. You were not added as a participant.";

        return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Organisation invitation ${statusText}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; max-width: 620px; margin: 40px auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; text-transform: capitalize;">Organisation invitation ${statusText}</h1>
  </div>
  <div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin: 0;">${actionMessage}</p>
  </div>
</body>
</html>
`);
    } catch (error) {
        console.log("Error in respondToOrganisationInvitation", error);
        return res.status(500).send("Server error");
    }
};

/**
 * getPendingOrganisationStatusNotifications: handles this function's core responsibility.
 */
export const getPendingOrganisationStatusNotifications = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const profile = await Profile.findOne({ user: req.userId }).lean();
        if (!profile) {
            return res.status(200).json({ success: true, notifications: [] });
        }

        /**
         * notifications: handles this function's core responsibility.
         */
        const notifications = (Array.isArray(profile.organisationInvitationResponses)
            ? profile.organisationInvitationResponses
            : [])
            .map((item) => {
                const response = asTrimmedString(item?.response) === "accept" ? "accept" : "deny";
                const organisationName = asTrimmedString(item?.organisationName) || "your organisation";
                return {
                    notificationId: String(item?._id || ""),
                    inviterName: asTrimmedString(item?.inviteeName) || "A Swinggity member",
                    inviterAvatarUrl: asTrimmedString(item?.inviteeAvatarUrl),
                    organisationId: String(item?.organisationId || ""),
                    organisationName,
                    response,
                    invitedAt: item?.respondedAt || new Date(),
                    notificationType: "organisation-status",
                    inviteText: response === "accept"
                        ? `accepted your participant invitation for ${organisationName}`
                        : `denied your participant invitation for ${organisationName}`,
                };
            })
            .sort((left, right) => new Date(right?.invitedAt || 0).getTime() - new Date(left?.invitedAt || 0).getTime());

        return res.status(200).json({
            success: true,
            notifications,
        });
    } catch (error) {
        console.log("Error in getPendingOrganisationStatusNotifications", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * dismissOrganisationStatusNotification: handles this function's core responsibility.
 */
export const dismissOrganisationStatusNotification = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const notificationId = asTrimmedString(req.body?.notificationId);
        if (!notificationId || !isValidObjectIdString(notificationId)) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        const profile = await Profile.findOne({ user: req.userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }

        const existingResponses = Array.isArray(profile.organisationInvitationResponses)
            ? profile.organisationInvitationResponses
            : [];
        profile.organisationInvitationResponses = existingResponses.filter(
            (entry) => String(entry?._id || "") !== notificationId
        );
        await profile.save();

        return res.status(200).json({ success: true, message: "Notification dismissed" });
    } catch (error) {
        console.log("Error in dismissOrganisationStatusNotification", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * leaveOrganisationAsParticipant: handles this function's core responsibility.
 */
export const leaveOrganisationAsParticipant = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const organisation = await Organisation.findOne({
            "participantContacts.user": req.userId,
            user: { $ne: req.userId },
        });

        if (!organisation) {
            return res.status(404).json({ success: false, message: "You are not a participant in any organisation" });
        }

        organisation.participantContacts = (Array.isArray(organisation.participantContacts)
            ? organisation.participantContacts
            : []).filter((entry) => asTrimmedString(entry?.user) !== asTrimmedString(req.userId));
        organisation.participants = buildParticipantsSummary(organisation.participantContacts);
        await organisation.save();

        return res.status(200).json({
            success: true,
            message: "You have left the organisation",
            organisationId: String(organisation._id || ""),
        });
    } catch (error) {
        console.log("Error in leaveOrganisationAsParticipant", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * uploadMyOrganisationImage: handles this function's core responsibility.
 */
export const uploadMyOrganisationImage = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Organisation image file is required" });
        }

        if (!isCloudinaryConfigured) {
            return res.status(500).json({
                success: false,
                message: "Cloudinary is not configured for organisation images",
            });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!isAllowedRole(user.role)) {
            return res.status(403).json({ success: false, message: "Only organisers can manage organisation pages" });
        }

        const existingOrganisation = await Organisation.findOne({ user: req.userId });
        const previousImageUrl = existingOrganisation?.imageUrl ?? "";
        const previousImageStorageId = existingOrganisation?.imageStorageId ?? "";

        const uploadedImage = await uploadOrganisationImageToCloudinary({
            fileBuffer: req.file.buffer,
            mimeType: req.file.mimetype,
            userId: req.userId,
        });
        const nextImageUrl = uploadedImage.imageUrl;
        const nextImageStorageId = uploadedImage.imageStorageId;

        const organisation = await Organisation.findOneAndUpdate(
            { user: req.userId },
            {
                imageUrl: nextImageUrl,
                imageStorageId: nextImageStorageId,
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
                runValidators: true,
            }
        );

        await deleteImageAsset({
            imageUrl: previousImageUrl,
            imageStorageId: previousImageStorageId,
        });

        return res.status(200).json({
            success: true,
            message: "Organisation image uploaded successfully",
            organisation: buildOrganisationPayload(organisation),
        });
    } catch (error) {
        console.log("Error in uploadMyOrganisationImage", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * removeMyOrganisationImage: handles this function's core responsibility.
 */
export const removeMyOrganisationImage = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!isAllowedRole(user.role)) {
            return res.status(403).json({ success: false, message: "Only organisers can manage organisation pages" });
        }

        const organisation = await Organisation.findOne({ user: req.userId });
        if (!organisation || !organisation.imageUrl) {
            return res.status(200).json({
                success: true,
                message: "No organisation image to remove",
                organisation: buildOrganisationPayload(organisation),
            });
        }

        const previousImageUrl = organisation.imageUrl;
        const previousImageStorageId = organisation.imageStorageId;
        organisation.imageUrl = "";
        organisation.imageStorageId = "";
        await organisation.save();

        await deleteImageAsset({
            imageUrl: previousImageUrl,
            imageStorageId: previousImageStorageId,
        });

        return res.status(200).json({
            success: true,
            message: "Organisation image removed successfully",
            organisation: buildOrganisationPayload(organisation),
        });
    } catch (error) {
        console.log("Error in removeMyOrganisationImage", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * deleteMyOrganisation: handles this function's core responsibility.
 */
export const deleteMyOrganisation = async (req, res) => {
    // Guard clauses and normalization keep request handling predictable.
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!isAllowedRole(user.role)) {
            return res.status(403).json({ success: false, message: "Only organisers can manage organisation pages" });
        }

        const organisation = await Organisation.findOne({ user: req.userId });
        if (!organisation) {
            return res.status(200).json({
                success: true,
                message: "Organisation already deleted",
            });
        }

        const previousImageUrl = organisation.imageUrl || "";
        const previousImageStorageId = organisation.imageStorageId || "";
        const organisationId = String(organisation._id || "");

        await Organisation.deleteOne({ _id: organisation._id });

        await Profile.updateMany(
            { "pendingOrganisationInvitations.organisationId": organisation._id },
            {
                $pull: {
                    pendingOrganisationInvitations: {
                        organisationId: organisation._id,
                    },
                },
            }
        );

        await deleteImageAsset({
            imageUrl: previousImageUrl,
            imageStorageId: previousImageStorageId,
        });

        return res.status(200).json({
            success: true,
            message: "Organisation deleted successfully",
            organisationId,
        });
    } catch (error) {
        console.log("Error in deleteMyOrganisation", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
