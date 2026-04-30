// The code in this file were created with help of AI (Copilot)

import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

// Resolve runtime-safe equivalents of __filename/__dirname for ESM modules.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local filesystem target for event images when cloud storage is not configured.
const eventImagesDir = path.join(__dirname, "..", "uploads", "events");

// Cloud mode is enabled only when all required Cloudinary credentials exist.
const shouldUseCloudStorage = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET
);

// Creates disk storage config for multer and guarantees destination directory exists.
const createEventImageDiskStorage = () => {
    // Ensure the uploads/events folder is present before any write attempt.
    fs.mkdirSync(eventImagesDir, { recursive: true });
    return multer.diskStorage({
        // Persist files into the event image uploads directory.
        destination: (_req, _file, cb) => {
            cb(null, eventImagesDir);
        },
        // Build a unique filename that includes user context and preserves extension.
        filename: (req, file, cb) => {
            const safeExt = path.extname(file.originalname || "").toLowerCase() || ".jpg";
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `event-${req.userId}-${uniqueSuffix}${safeExt}`);
        },
    });
};

// Use in-memory buffering in cloud mode; otherwise write directly to local disk.
const storage = shouldUseCloudStorage
    ? multer.memoryStorage()
    : createEventImageDiskStorage();

// Restrict uploads to supported image MIME types.
const fileFilter = (_req, file, cb) => {
    // SSR19: allow-list accepted media types for event images.
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error("Only JPG, PNG, WEBP, or GIF image files are allowed"));
        return;
    }
    cb(null, true);
};

// Shared multer instance for event-image uploads, with size limit and MIME validation.
const uploader = multer({
    storage,
    limits: {
        // SSR19: enforce a safe maximum upload size (5MB) for event images.
        // Reject files larger than 5MB to control memory/disk usage and response times.
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter,
});

/**
 * uploadEventImageSingle:
 * Middleware wrapper for a single multipart field named "eventImage".
 * Handles multer and validation errors and converts them into consistent 400 responses.
 */
export const uploadEventImageSingle = (req, res, next) => {
    // Build a request-scoped handler that accepts one file from field "eventImage".
    const handler = uploader.single("eventImage");

    handler(req, res, (error) => {
        // Pass through when upload/parsing succeeds.
        if (!error) {
            next();
            return;
        }

        // Multer-specific errors include known codes like file size limits.
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                res.status(400).json({ success: false, message: "Event image must be 5MB or smaller" });
                return;
            }
            // GSR13: non-file-size MulterError codes use a generic message.
            res.status(400).json({ success: false, message: 'Event image upload failed' });
            return;
        }

        // Non-multer errors include custom fileFilter rejections and unexpected upload failures.
        // GSR13: generic message returned to avoid leaking internal error detail.
        res.status(400).json({ success: false, message: 'Event image upload failed' });
    });
};
