// The code in this file were created with help of AI (Copilot)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';

export const isCloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);

if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: cloudinaryCloudName,
        api_key: cloudinaryApiKey,
        api_secret: cloudinaryApiSecret,
        secure: true,
    });
}

/**
 * resolveAbsoluteAssetUrl: handles this function's core responsibility.
 */
export const resolveAbsoluteAssetUrl = (req, rawUrl) => {
    // Guard clauses and normalization keep request handling predictable.
    const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${req.protocol}://${req.get('host')}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
};

/**
 * getAvatarCloudPublicId: handles this function's core responsibility.
 */
const getAvatarCloudPublicId = (userId) => `avatar-${String(userId || 'unknown')}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

/**
 * uploadAvatarToCloudinary: handles this function's core responsibility.
 */
export const uploadAvatarToCloudinary = async ({ fileBuffer, mimeType, userId }) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!isCloudinaryConfigured) {
        throw new Error('Cloudinary is not configured');
    }

    const publicId = getAvatarCloudPublicId(userId);
    const payload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                resource_type: 'image',
                overwrite: true,
                invalidate: true,
                folder: 'swinggity/avatars',
                format: (mimeType || '').includes('png') ? 'png' : undefined,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error('Cloud avatar upload failed'));
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

/**
 * deleteCloudinaryAvatar: handles this function's core responsibility.
 */
const deleteCloudinaryAvatar = async (avatarStorageId) => {
    // Guard clauses and normalization keep request handling predictable.
    if (!isCloudinaryConfigured || !avatarStorageId) return;

    await cloudinary.uploader.destroy(avatarStorageId, {
        resource_type: 'image',
        invalidate: true,
    }).catch(() => undefined);
};

const deleteAvatarFileIfLocal = async (assetUrl) => {
    if (!assetUrl || !assetUrl.startsWith('/uploads/avatars/')) return;
    const absolutePath = path.join(__dirname, '..', assetUrl.replace(/^\//, '').replace(/\//g, path.sep));
    await fs.unlink(absolutePath).catch(() => undefined);
};

export const deleteAvatarAsset = async ({ avatarUrl, avatarStorageId }) => {
    if (avatarStorageId) {
        await deleteCloudinaryAvatar(avatarStorageId);
        return;
    }
    await deleteAvatarFileIfLocal(avatarUrl);
};
