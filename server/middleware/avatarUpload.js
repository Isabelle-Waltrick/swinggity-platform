import fs from 'fs';
import path from 'path';
import multer from 'multer';

const avatarsDir = path.join(process.cwd(), 'server', 'uploads', 'avatars');
fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname || '').toLowerCase() || '.jpg';
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `avatar-${req.userId}-${uniqueSuffix}${safeExt}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error('Only JPG, PNG, WEBP, or GIF image files are allowed'));
        return;
    }
    cb(null, true);
};

const uploader = multer({
    storage,
    limits: {
        fileSize: 3 * 1024 * 1024,
    },
    fileFilter,
});

export const uploadAvatarSingle = (req, res, next) => {
    const handler = uploader.single('avatar');

    handler(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                res.status(400).json({ success: false, message: 'Avatar image must be 3MB or smaller' });
                return;
            }
            res.status(400).json({ success: false, message: error.message });
            return;
        }

        res.status(400).json({ success: false, message: error.message || 'Avatar upload failed' });
    });
};
