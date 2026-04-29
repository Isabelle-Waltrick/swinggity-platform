import defaultEventBackground from '../../../assets/event-background-default.png';

// Shared fallback image keeps event cards visually consistent when media is missing or invalid.
export const FALLBACK_EVENT_IMAGE = defaultEventBackground;

// Build a display-ready date label for cards (for example: "Tue, 28 Apr at 19:30").
// Falls back to the raw date text if parsing fails.
export const formatEventDateLabel = (startDate, startTime) => {
    const normalizedDate = typeof startDate === 'string' ? startDate.trim() : '';
    const normalizedTime = typeof startTime === 'string' ? startTime.trim() : '';
    if (!normalizedDate) return '';

    const date = new Date(`${normalizedDate}T${normalizedTime || '00:00'}`);
    if (Number.isNaN(date.getTime())) return normalizedDate;

    const datePart = date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
    });

    if (!normalizedTime) return datePart;
    return `${datePart} at ${normalizedTime}`;
};

// Format edit timestamps for "last updated" metadata shown on event cards.
export const formatEventEditedAtLabel = (editedAt) => {
    const edited = new Date(editedAt || '');

    if (Number.isNaN(edited.getTime())) return '';

    return edited.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// Resolve an event image source safely:
// 1) allow valid absolute HTTP(S) URLs,
// 2) allow known local uploads paths,
// 3) otherwise return fallback image.
export const resolveEventImageUrl = (apiUrl, rawUrl) => {
    const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!normalized) return FALLBACK_EVENT_IMAGE;
    // Absolute URL validation is done via regex and URL constructor to prevent XSS or invalid URLs.
    if (/^https?:\/\//i.test(normalized)) {
        try {
            const parsed = new URL(normalized);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.toString();
            }
            return FALLBACK_EVENT_IMAGE;
        } catch {
            return FALLBACK_EVENT_IMAGE;
        }
    }
    // Allow local uploads but ensure they are properly prefixed with the API URL to prevent broken images.
    if (/^\/uploads\/events\//.test(normalized)) {
        return `${apiUrl}${normalized}`;
    }
    // For any other cases (invalid format, potential XSS, etc.), return the fallback image.
    return FALLBACK_EVENT_IMAGE;
};

/**
 * buildCalendarEventCardModel:
 * Normalizes raw event payloads into a presentation model consumed by CalendarEventCard.
 * It derives role-based permissions, normalizes attendees, and ensures robust fallbacks.
 */
export const buildCalendarEventCardModel = (event, apiUrl, currentUserId, currentUserRole = '') => {
    // Normalize attendee payload to avoid null/undefined access in downstream UI rendering.
    const attendeeList = Array.isArray(event?.attendees) ? event.attendees : [];
    // Permission derivation is based on ownership and admin role.
    const createdById = String(event?.createdById || '').trim();
    const organizerId = String(event?.organizerProfileId || event?.publisherOrganisationId || createdById).trim();
    const normalizedCurrentUserRole = String(currentUserRole || '').trim().toLowerCase();
    const isAdminUser = normalizedCurrentUserRole === 'admin';
    const isOwner = createdById === String(currentUserId || '').trim();
    const isEditable = isOwner;
    const isDeletable = isOwner || isAdminUser;
    // Return one UI-friendly object so event cards remain dumb presentational components.
    return {
        id: String(event?.id || '').trim(),
        startDate: String(event?.startDate || '').trim(),
        startTime: String(event?.startTime || '').trim(),
        date: formatEventDateLabel(event?.startDate, event?.startTime),
        editedAtLabel: formatEventEditedAtLabel(event?.editedAt),
        organizer: event?.organizerName || 'Swinggity Host',
        organizerId,
        title: event?.title || 'Untitled event',
        // Prefer backend count; fall back to local attendee list length.
        attendees: Number.isFinite(event?.attendeesCount) ? event.attendeesCount : attendeeList.length,
        // Render only first 3 avatars to keep card layout compact.
        attendeeAvatars: attendeeList
            .map((attendee) => resolveEventImageUrl(apiUrl, attendee?.avatarUrl))
            .filter(Boolean)
            .slice(0, 3),
        // Keep richer attendee objects for popups/profile navigation.
        attendeeProfiles: attendeeList
            .map((attendee) => ({
                userId: String(attendee?.userId || '').trim(),
                displayName: String(attendee?.displayName || '').trim() || 'Swinggity Member',
                avatarUrl: resolveEventImageUrl(apiUrl, attendee?.avatarUrl),
            }))
            .filter((attendee) => attendee.userId || attendee.displayName),
        // Image resolution always returns a safe URL or fallback.
        image: event?.imageUrl ? resolveEventImageUrl(apiUrl, event.imageUrl) : FALLBACK_EVENT_IMAGE,
        isGoing: Boolean(event?.isGoing), isEditable, isDeletable,
    };
};