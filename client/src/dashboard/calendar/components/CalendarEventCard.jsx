/**
 * CalendarEventCard:
 * Reusable, presentational card for one calendar event preview.
 * It supports two action modes:
 * 1) member mode (Going + View), and
 * 2) management mode (View + Edit/Delete).
 */

import { CheckCircle } from './CheckCircle';
import { RecycleBin } from './RecycleBin';
import editSquaredIcon from '../../../assets/edit-squared.svg';

// The component receives a display-ready event model and interaction callbacks.
export default function CalendarEventCard({
    event,
    canMarkGoing = true,
    canEditEvent = false,
    canDeleteEvent = false,
    onEdit,
    onDelete,
    onView,
    onOrganizerClick,
    onGoing,
    onAttendeesClick,
    isDeleting = false,
    isGoingPending = false,
}) {
    // Destructure the model once to keep JSX concise and readable.
    const { date, organizer, organizerId, title, attendees, image, id, editedAtLabel, attendeeAvatars = [], attendeeProfiles = [], isGoing = false } = event;

    // Build stable avatar items and ignore invalid avatar URLs before rendering.
    const visibleAvatars = attendeeAvatars
        .map((avatarUrl, index) => ({
            key: `avatar-${id}-${index}`,
            avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : '',
        }))
        .filter((avatar) => Boolean(avatar.avatarUrl));

    // Management actions are shown when the card is editable and/or deletable.
    const showManageActions = Boolean(canEditEvent || canDeleteEvent);

    return (
        <div className="event-card">
            {/* Event image is clickable and routes to the event detail view. */}
            <button
                type="button"
                className="event-image-wrapper"
                onClick={() => onView?.(id)}
                aria-label={`View ${title} event details`}
            >
                <img src={image} alt={title || 'Event'} className="event-image" />
            </button>

            <div className="event-content">
                {/* Date label is preformatted in the card model helper. */}
                <p className="event-date">{date}</p>
                {/* "Edited at" metadata is optional and shown only when available. */}
                {editedAtLabel ? <p className="event-edited-at">Edited at {editedAtLabel}</p> : null}

                {/* Title also links to details, giving users a second clear click target. */}
                <button
                    type="button"
                    className="event-title-button"
                    onClick={() => onView?.(id)}
                    aria-label={`View ${title} event details`}
                >
                    {title}
                </button>

                <p className="event-organizer">
                    <span>by </span>
                    {/* Organizer is clickable only when a resolvable organizer/profile id exists. */}
                    {organizerId ? (
                        <button
                            type="button"
                            className="organizer-name organizer-name-button"
                            onClick={() => onOrganizerClick?.(organizerId)}
                        >
                            {organizer}
                        </button>
                    ) : (
                        <span className="organizer-name">{organizer}</span>
                    )}
                </p>

                {/* Attendees section opens the same attendees popup from text and avatar stack. */}
                <div className="event-attendees">
                    <button
                        type="button"
                        className="attendees-text attendees-trigger"
                        onClick={() => onAttendeesClick?.({ title, attendees: attendeeProfiles })}
                        aria-label={`View people going to ${title}`}
                    >
                        {attendees} attendees
                    </button>
                    {/* Render avatar stack only when at least one valid avatar image exists. */}
                    {visibleAvatars.length > 0 ? (
                        <button
                            type="button"
                            className="avatar-stack avatar-stack-button"
                            onClick={() => onAttendeesClick?.({ title, attendees: attendeeProfiles })}
                            aria-label={`View people going to ${title}`}
                        >
                            {visibleAvatars.map((avatar) => (
                                <div
                                    key={avatar.key}
                                    className="avatar avatar-has-image"
                                    style={{ backgroundImage: `url(${avatar.avatarUrl})` }}
                                ></div>
                            ))}
                        </button>
                    ) : null}
                </div>

                {/* Action footer switches between management actions and attendance actions. */}
                <div className="event-actions">
                    {showManageActions ? (
                        <>
                            {/* View action is always available in management mode. */}
                            <button type="button" className="link-view-event" onClick={() => onView?.(id)}>View event</button>
                            <div className="event-manage-actions">
                                {/* Edit button is rendered only when edit permission is granted. */}
                                {canEditEvent ? (
                                    <button className="btn-edit" type="button" onClick={() => onEdit?.(id)}>
                                        <img src={editSquaredIcon} alt="" className="btn-edit-icon" />
                                        <span>Edit</span>
                                    </button>
                                ) : null}
                                {/* Delete button is rendered only when delete permission is granted. */}
                                {canDeleteEvent ? (
                                    <button className="btn-delete" type="button" onClick={() => onDelete?.(id)} disabled={isDeleting}>
                                        <RecycleBin />
                                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                                    </button>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Members can mark attendance unless role restrictions disable this action. */}
                            {canMarkGoing ? (
                                <button
                                    className={`btn-going ${isGoing ? 'is-active' : ''}`}
                                    type="button"
                                    onClick={() => onGoing?.(id)}
                                    disabled={isGoingPending}
                                >
                                    <CheckCircle />
                                    <span>{isGoingPending ? 'Saving...' : 'Going'}</span>
                                </button>
                            ) : null}
                            {/* View remains available regardless of going/edit/delete permissions. */}
                            <button type="button" className="link-view-event" onClick={() => onView?.(id)}>View event</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}