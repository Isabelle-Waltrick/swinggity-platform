import defaultEventBackground from '../../../assets/event-background-default.png';

export const FALLBACK_EVENT_IMAGE = defaultEventBackground;

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

export const resolveEventImageUrl = (apiUrl, rawUrl) => {
    const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!normalized) return FALLBACK_EVENT_IMAGE;

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

    if (/^\/uploads\/events\//.test(normalized)) {
        return `${apiUrl}${normalized}`;
    }

    return FALLBACK_EVENT_IMAGE;
};

export const buildCalendarEventCardModel = (event, apiUrl, currentUserId, currentUserRole = '') => {
    const attendeeList = Array.isArray(event?.attendees) ? event.attendees : [];
    const createdById = String(event?.createdById || '').trim();
    const organizerId = String(event?.organizerProfileId || event?.publisherOrganisationId || createdById).trim();
    const normalizedCurrentUserRole = String(currentUserRole || '').trim().toLowerCase();
    const isAdminUser = normalizedCurrentUserRole === 'admin';
    const isOwner = createdById === String(currentUserId || '').trim();
    const isEditable = isOwner;
    const isDeletable = isOwner || isAdminUser;

    return {
        id: String(event?.id || '').trim(),
        startDate: String(event?.startDate || '').trim(),
        startTime: String(event?.startTime || '').trim(),
        date: formatEventDateLabel(event?.startDate, event?.startTime),
        editedAtLabel: formatEventEditedAtLabel(event?.editedAt),
        organizer: event?.organizerName || 'Swinggity Host',
        organizerId,
        title: event?.title || 'Untitled event',
        attendees: Number.isFinite(event?.attendeesCount) ? event.attendeesCount : attendeeList.length,
        attendeeAvatars: attendeeList
            .map((attendee) => resolveEventImageUrl(apiUrl, attendee?.avatarUrl))
            .filter(Boolean)
            .slice(0, 3),
        attendeeProfiles: attendeeList
            .map((attendee) => ({
                userId: String(attendee?.userId || '').trim(),
                displayName: String(attendee?.displayName || '').trim() || 'Swinggity Member',
                avatarUrl: resolveEventImageUrl(apiUrl, attendee?.avatarUrl),
            }))
            .filter((attendee) => attendee.userId || attendee.displayName),
        image: event?.imageUrl ? resolveEventImageUrl(apiUrl, event.imageUrl) : FALLBACK_EVENT_IMAGE,
        isGoing: Boolean(event?.isGoing),
        isEditable,
        isDeletable,
    };
};