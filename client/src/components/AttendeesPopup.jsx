// The code in this file were created with help of AI (Copilot)

import ProfileAvatar from './ProfileAvatar';

// Splits a display name into first/last parts for avatar initials fallback.
// Provides safe defaults so avatar rendering never breaks on malformed names.
const splitNameParts = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || 'Swinggity';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'Member';
    return { firstName, lastName };
};

/**
 * AttendeesPopup:
 * Modal dialog that shows people who marked "going" for an event and allows
 * navigating directly to each attendee profile from avatar/name actions.
 */
export default function AttendeesPopup({
    isOpen,
    onClose,
    onViewProfile,
    attendees = [],
    title = 'People going',
    titlePrefix = '',
    highlightedTitle = '',
}) {
    // Do not mount popup markup when closed.
    if (!isOpen) return null;

    // Closes popup first, then navigates to attendee profile when userId is available.
    const handleViewProfile = (userId) => {
        if (!userId) return;
        onClose?.();
        onViewProfile?.(userId);
    };

    // Normalize optional title fragments used by highlighted title mode.
    const safeTitlePrefix = String(titlePrefix || '').trim();
    const safeHighlightedTitle = String(highlightedTitle || '').trim();

    // Highlighted title requires both prefix and highlighted text to avoid partial rendering.
    const shouldRenderHighlightedTitle = Boolean(safeTitlePrefix && safeHighlightedTitle);

    return (
        // Overlay closes the popup when user clicks outside the dialog panel.
        <div className="contact-popup-overlay" role="presentation" onClick={onClose}>
            <div
                className="contact-popup attendees-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="attendees-popup-title"
                // Prevent overlay close behavior when interacting inside the dialog.
                onClick={(event) => event.stopPropagation()}
            >
                {/* Explicit close control for keyboard/mouse users. */}
                <button className="contact-popup-close" type="button" onClick={onClose} aria-label="Close">
                    x
                </button>

                {/* Supports either standard title text or a mixed highlighted title variant. */}
                <h2 id="attendees-popup-title" className="contact-popup-title attendees-popup-title">
                    {shouldRenderHighlightedTitle ? (
                        <>
                            {safeTitlePrefix}{' '}
                            <span className="attendees-popup-title-highlight">{safeHighlightedTitle}</span>
                        </>
                    ) : title}
                </h2>

                {/* Empty state communicates that no Jam Circle attendees marked "going" yet. */}
                {attendees.length === 0 ? (
                    <p className="contact-popup-description attendees-popup-empty">No one in your Jam Circle has marked going yet.</p>
                ) : (
                    // Render attendee list when at least one record is available.
                    <ul className="attendees-popup-list" aria-label="Attendee list">
                        {attendees.map((attendee, index) => {
                            // Defensive normalization for imperfect payloads.
                            const attendeeName = String(attendee?.displayName || '').trim() || 'Swinggity Member';
                            const attendeeUserId = String(attendee?.userId || '').trim();
                            const avatarUrl = String(attendee?.avatarUrl || '').trim();
                            const nameParts = splitNameParts(attendeeName);

                            return (
                                <li key={`${attendeeUserId || attendeeName}-${index}`} className="attendees-popup-item">
                                    {/* Avatar button opens attendee profile when a valid user id is present. */}
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
                                    {/* Name button mirrors avatar action for improved discoverability/accessibility. */}
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
