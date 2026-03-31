import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import { User } from "../models/user.model.js";
import { Organisation } from "../models/organisation.model.js";

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

const isAllowedRole = (role) => {
    const normalized = String(role || "").trim().toLowerCase();
    return normalized === "organiser" || normalized === "admin";
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

const sanitizeSocialField = (value, fieldName) => {
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

const getOrganisationImageCloudPublicId = (userId) => `organisation-${String(userId || "unknown")}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const uploadOrganisationImageToCloudinary = async ({ fileBuffer, mimeType, userId }) => {
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

const deleteCloudinaryImage = async (imageStorageId) => {
    if (!isCloudinaryConfigured || !imageStorageId) return;

    await cloudinary.uploader.destroy(imageStorageId, {
        resource_type: "image",
        invalidate: true,
    }).catch(() => undefined);
};

const deleteImageFileIfLocal = async (imageUrl) => {
    if (!imageUrl || !imageUrl.startsWith("/uploads/avatars/")) {
        return;
    }

    const absoluteImagePath = path.join(__dirname, "..", imageUrl.replace(/^\//, "").replace(/\//g, path.sep));
    await fs.unlink(absoluteImagePath).catch(() => undefined);
};

const deleteImageAsset = async ({ imageUrl, imageStorageId }) => {
    if (imageStorageId) {
        await deleteCloudinaryImage(imageStorageId);
        return;
    }

    await deleteImageFileIfLocal(imageUrl);
};

const buildOrganisationPayload = (organisation) => {
    if (!organisation) {
        return null;
    }

    return {
        organisationName: organisation.organisationName || "",
        imageUrl: organisation.imageUrl || "",
        bio: organisation.bio || "",
        instagram: organisation.instagram || "",
        facebook: organisation.facebook || "",
        youtube: organisation.youtube || "",
        linkedin: organisation.linkedin || "",
        website: organisation.website || "",
        participants: organisation.participants || "",
        updatedAt: organisation.updatedAt || null,
    };
};

export const getMyOrganisation = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!isAllowedRole(user.role)) {
            return res.status(403).json({ success: false, message: "Only organisers can manage organisation pages" });
        }

        const organisation = await Organisation.findOne({ user: req.userId }).lean();
        return res.status(200).json({
            success: true,
            organisation: buildOrganisationPayload(organisation),
        });
    } catch (error) {
        console.log("Error in getMyOrganisation", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const upsertMyOrganisation = async (req, res) => {
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
        } = req.body;

        const validatedOrganisationName = sanitizeTextField(organisationName, "Organisation name", 120);
        const validatedBio = sanitizeTextField(bio, "Brief bio", 700);
        const validatedInstagram = sanitizeSocialField(instagram, "Instagram");
        const validatedFacebook = sanitizeSocialField(facebook, "Facebook");
        const validatedYouTube = sanitizeSocialField(youtube, "YouTube");
        const validatedLinkedin = sanitizeSocialField(linkedin, "LinkedIn");
        const validatedWebsite = sanitizeSocialField(website, "Website");
        const validatedParticipants = sanitizeTextField(participants, "Participants", 400);

        const validations = [
            validatedOrganisationName,
            validatedBio,
            validatedInstagram,
            validatedFacebook,
            validatedYouTube,
            validatedLinkedin,
            validatedWebsite,
            validatedParticipants,
        ];

        const firstError = validations.find((validation) => validation.error);
        if (firstError) {
            return res.status(400).json({ success: false, message: firstError.error });
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
            return res.status(400).json({ success: false, message: "No organisation fields provided to update" });
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

        return res.status(200).json({
            success: true,
            message: "Organisation updated successfully",
            organisation: buildOrganisationPayload(organisation),
        });
    } catch (error) {
        console.log("Error in upsertMyOrganisation", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const uploadMyOrganisationImage = async (req, res) => {
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

export const removeMyOrganisationImage = async (req, res) => {
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

export const deleteMyOrganisation = async (req, res) => {
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

        await Organisation.deleteOne({ _id: organisation._id });

        await deleteImageAsset({
            imageUrl: previousImageUrl,
            imageStorageId: previousImageStorageId,
        });

        return res.status(200).json({
            success: true,
            message: "Organisation deleted successfully",
        });
    } catch (error) {
        console.log("Error in deleteMyOrganisation", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
