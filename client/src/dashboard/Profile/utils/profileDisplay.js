// The code in this file were created with help of AI (Copilot)
// Normalize user-entered social links into safe absolute http/https URLs.
export const normalizeSocialUrl = (rawUrl) => {
    if (typeof rawUrl !== 'string') return '';

    const trimmed = rawUrl.trim();
    if (!trimmed) return '';

    const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;

    try {
        const parsed = new URL(prefixed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
};

// Build a full display name from first/last name parts with a safe fallback.
export const getDisplayName = (firstName, lastName, fallback = 'New Member') => (
    `${firstName || ''} ${lastName || ''}`.trim() || fallback
);

// Build avatar initials from first/last name parts with a safe fallback.
export const getInitials = (firstName, lastName, fallback = 'NM') => (
    `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || fallback
);

// Trim string tags and drop empty values before rendering.
export const normalizeTagList = (tags) => (
    (Array.isArray(tags) ? tags : [])
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean)
);