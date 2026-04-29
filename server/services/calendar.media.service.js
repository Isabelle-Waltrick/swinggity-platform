// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Media Service Guide
 * This service encapsulates event image storage and cleanup behavior.
 * It abstracts Cloudinary/local handling so controllers stay business-focused.
 * Use this file to explain upload/delete lifecycle decisions.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

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

const getEventCloudPublicId = (userId) => `event-${String(userId || "unknown")}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const uploadEventImageToCloudinary = async ({ fileBuffer, mimeType, userId }) => {
    if (!isCloudinaryConfigured) {
        throw new Error("Cloudinary is not configured");
    }

    const publicId = getEventCloudPublicId(userId);
    const payload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                resource_type: "image",
                overwrite: true,
                invalidate: true,
                folder: "swinggity/events",
                format: (mimeType || "").includes("png") ? "png" : undefined,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error("Cloud event image upload failed"));
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

const deleteCloudinaryEventImage = async (imageStorageId) => {
    if (!isCloudinaryConfigured || !imageStorageId) return;

    await cloudinary.uploader.destroy(imageStorageId, {
        resource_type: "image",
        invalidate: true,
    }).catch(() => undefined);
};

const deleteEventImageFileIfLocal = async (imageUrl) => {
    if (!imageUrl || !imageUrl.startsWith("/uploads/events/")) return;

    const absoluteImagePath = path.join(__dirname, "..", imageUrl.replace(/^\//, "").replace(/\//g, path.sep));
    await fs.unlink(absoluteImagePath).catch(() => undefined);
};

export const deleteEventImageAsset = async ({ imageUrl, imageStorageId }) => {
    if (imageStorageId) {
        await deleteCloudinaryEventImage(imageStorageId);
        return;
    }

    await deleteEventImageFileIfLocal(imageUrl);
};

export const storeEventImageAsset = async ({ file, userId }) => {
    if (!file) {
        return { imageUrl: "", imageStorageId: "" };
    }

    if (isCloudinaryConfigured) {
        if (!file.buffer) {
            throw new Error("Event image buffer is missing");
        }
        return uploadEventImageToCloudinary({
            fileBuffer: file.buffer,
            mimeType: file.mimetype,
            userId,
        });
    }

    return {
        imageUrl: file.filename ? `/uploads/events/${file.filename}` : "",
        imageStorageId: "",
    };
};
