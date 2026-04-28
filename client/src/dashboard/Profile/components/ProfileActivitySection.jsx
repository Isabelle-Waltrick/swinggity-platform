import editIcon from '../../../assets/edit.svg';
import ProfileActivityFeed from '../../components/ProfileActivityFeed';

/**
 * ProfileActivitySection
 *
 * Renders the "Your Activity" section of the profile page. Delegates all feed
 * rendering to the shared `ProfileActivityFeed` component, passing through the
 * full set of event-action callbacks from Profile.jsx.
 *
 * When `activityFeed` is empty the section renders only the `emptyMessage`
 * placeholder text rather than mounting the feed component at all.
 *
 * An inline error banner is shown when a delete operation fails — the error
 * string comes from Profile.jsx state and is cleared on the next successful
 * action.
 *
 * Props:
 *   activityDeleteError {string|null}   — Error message from a failed delete;
 *                                         displayed as a banner above the feed.
 *   activityEventsById  {Object}        — Map of eventId → full event object,
 *                                         used by the feed to look up event data.
 *   activityFeed        {Array}         — Ordered list of activity-feed entries
 *                                         for the profile owner.
 *   apiUrl              {string}        — Base API URL passed to the feed for
 *                                         image/asset resolution.
 *   canMarkGoing        {boolean}       — Whether the viewer can RSVP to events
 *                                         in this feed.
 *   currentUserId       {string}        — ID of the currently authenticated user.
 *   currentUserRole     {string}        — Role of the authenticated user; used
 *                                         for permission checks inside the feed.
 *   emptyMessage        {string}        — Placeholder copy shown when the feed
 *                                         is empty.
 *   goingEventIds       {Set<string>}   — IDs of events the current user has
 *                                         already marked as going.
 *   isDeletingEventId   {string|null}   — ID of the event currently being
 *                                         deleted; used to show a loading state.
 *   onDeleteEvent       {Function}      — Initiates the delete confirmation flow.
 *   onEdit              {Function}      — Opens the profile edit modal.
 *   onEditEvent         {Function}      — Opens the event edit modal for a feed
 *                                         entry.
 *   onMarkGoing         {Function}      — Marks/unmarks the current user as
 *                                         going for a given event.
 *   onOrganizerClick    {Function}      — Navigates to the organiser's profile.
 *   onViewEvent         {Function}      — Opens the event detail view.
 *   showEditControls    {boolean}       — Whether to render the edit button;
 *                                         true only for the profile owner.
 */
export default function ProfileActivitySection({
    activityDeleteError,
    activityEventsById,
    activityFeed,
    apiUrl,
    canMarkGoing,
    currentUserId,
    currentUserRole,
    emptyMessage,
    goingEventIds,
    isDeletingEventId,
    onDeleteEvent,
    onEdit,
    onEditEvent,
    onMarkGoing,
    onOrganizerClick,
    onViewEvent,
    showEditControls,
}) {
    return (
        <div className="profile-section">

            {/* ── Section heading ───────────────────────────────────────────── */}
            <div className="profile-section-heading">
                <h2>Your Activity</h2>
                {/* Edit button only visible to the profile owner */}
                {showEditControls ? (
                    <button type="button" className="edit-icon-btn" onClick={onEdit} aria-label="Edit activity">
                        <img src={editIcon} alt="" />
                    </button>
                ) : null}
            </div>

            {/* ── Delete error banner ───────────────────────────────────────── */}
            {/* Shown when a previous delete attempt returned an error; cleared
                automatically once the next action completes successfully */}
            {activityDeleteError ? <p className="profile-save-error">{activityDeleteError}</p> : null}

            {/* ── Feed or empty state ───────────────────────────────────────── */}
            {/* Avoid mounting the feed component entirely when there are no
                entries — render the placeholder text directly instead */}
            {activityFeed.length > 0 ? (
                // Profile owners can always edit and delete their own activity events
                <ProfileActivityFeed
                    activityFeed={activityFeed}
                    activityEventsById={activityEventsById}
                    apiUrl={apiUrl}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    canMarkGoing={canMarkGoing}
                    onViewEvent={onViewEvent}
                    onMarkGoing={onMarkGoing}
                    onOrganizerClick={onOrganizerClick}
                    canEditEvent={true}
                    canDeleteEvent={true}
                    onEditEvent={onEditEvent}
                    onDeleteEvent={onDeleteEvent}
                    isDeletingEventId={isDeletingEventId}
                    goingEventIds={goingEventIds}
                    emptyMessage={emptyMessage}
                />
            ) : (
                <p className="profile-copy">{emptyMessage}</p>
            )}
        </div>
    );
}