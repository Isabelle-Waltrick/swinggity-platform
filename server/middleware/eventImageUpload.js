import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const eventImagesDir = path.join(__dirname, "..", "uploads", "events");
fs.mkdirSync(eventImagesDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, eventImagesDir);
    },
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname || "").toLowerCase() || ".jpg";
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `event-${req.userId}-${uniqueSuffix}${safeExt}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error("Only JPG, PNG, WEBP, or GIF image files are allowed"));
        return;
    }
    cb(null, true);
};

const uploader = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter,
});

export const uploadEventImageSingle = (req, res, next) => {
    const handler = uploader.single("eventImage");

    handler(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                res.status(400).json({ success: false, message: "Event image must be 5MB or smaller" });
                return;
            }
            res.status(400).json({ success: false, message: error.message });
            return;
        }

        res.status(400).json({ success: false, message: error.message || "Event image upload failed" });
    });
};
