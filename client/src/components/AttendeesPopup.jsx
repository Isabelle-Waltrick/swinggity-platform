import ProfileAvatar from './ProfileAvatar';

const splitNameParts = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || 'Swinggity';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'Member';
    return { firstName, lastName };
};

export default function AttendeesPopup({
    isOpen,
    onClose,
    onViewProfile,
    attendees = [],
    title = 'People going',
    titlePrefix = '',
    highlightedTitle = '',
}) {
    if (!isOpen) return null;

    const handleViewProfile = (userId) => {
        if (!userId) return;
        onClose?.();
        onViewProfile?.(userId);
    };

    const safeTitlePrefix = String(titlePrefix || '').trim();
    const safeHighlightedTitle = String(highlightedTitle || '').trim();
    const shouldRenderHighlightedTitle = Boolean(safeTitlePrefix && safeHighlightedTitle);

    return (
        <div className="contact-popup-overlay" role="presentation" onClick={onClose}>
            <div
                className="contact-popup attendees-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="attendees-popup-title"
                onClick={(event) => event.stopPropagation()}
            >
                <button className="contact-popup-close" type="button" onClick={onClose} aria-label="Close">
                    x
                </button>

                <h2 id="attendees-popup-title" className="contact-popup-title attendees-popup-title">
                    {shouldRenderHighlightedTitle ? (
                        <>
                            {safeTitlePrefix}{' '}
                            <span className="attendees-popup-title-highlight">{safeHighlightedTitle}</span>
                        </>
                    ) : title}
                </h2>

                {attendees.length === 0 ? (
                    <p className="contact-popup-description attendees-popup-empty">No one has marked going yet.</p>
                ) : (
                    <ul className="attendees-popup-list" aria-label="Attendee list">
                        {attendees.map((attendee, index) => {
                            const attendeeName = String(attendee?.displayName || '').trim() || 'Swinggity Member';
                            const attendeeUserId = String(attendee?.userId || '').trim();
                            const avatarUrl = String(attendee?.avatarUrl || '').trim();
                            const nameParts = splitNameParts(attendeeName);

                            return (
                                <li key={`${attendeeUserId || attendeeName}-${index}`} className="attendees-popup-item">
                                    <button
                                        type="button"
                                        className="calendar-view-profile-trigger"
                                        onClick={() => handleViewProfile(attendeeUserId)}
                                        disabled={!attendeeUserId}
                                        aria-label={`Open ${attendeeName} profile`}
                                    >
                                        <ProfileAvatar
                                            firstName={nameParts.firstName}
                                            lastName={nameParts.lastName}
                                            avatarUrl={avatarUrl}
                                            size={44}
                                            className="attendees-popup-avatar"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        className="calendar-view-name-link attendees-popup-name"
                                        onClick={() => handleViewProfile(attendeeUserId)}
                                        disabled={!attendeeUserId}
                                    >
                                        {attendeeName}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
