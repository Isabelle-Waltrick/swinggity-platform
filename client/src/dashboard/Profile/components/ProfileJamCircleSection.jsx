import ProfileAvatar from '../../../components/ProfileAvatar';

/**
 * ProfileJamCircleSection
 *
 * Renders the "Your Jam Circle" section of the profile page. Shows a
 * scrollable list of jam-circle members, each as a clickable avatar + name
 * pair that navigates to the member's own profile.
 *
 * Three display states are handled:
 *   1. Loading  — a loading message is shown while the API call is in-flight.
 *   2. Empty    — a prompt to explore the members page is shown when the
 *                 circle has no entries yet.
 *   3. Populated — member rows are rendered; if the full list exceeds the
 *                  initial preview limit, a toggle button is shown at the
 *                  bottom to expand/collapse the rest (`hasHiddenMembers`).
 *
 * Member data comes from the jam-circle API response fetched by Profile.jsx
 * and is passed down as a pre-filtered array (truncated or full depending on
 * `isExpanded`).
 *
 * Props:
 *   hasHiddenMembers  {boolean}   — True when the member list was truncated;
 *                                   shows the expand/collapse toggle.
 *   isExpanded        {boolean}   — Whether the full list is currently shown;
 *                                   controls the toggle button label.
 *   isLoading         {boolean}   — True while the jam-circle fetch is pending.
 *   members           {Array}     — Filtered list of member objects to render;
 *                                   each has { userId, fullName, displayFirstName,
 *                                   displayLastName, avatarUrl }.
 *   onMemberClick     {Function}  — Navigates to the given member's profile
 *                                   page; receives `userId` as argument.
 *   onToggleExpanded  {Function}  — Toggles between the truncated and full
 *                                   member list views.
 */
export default function ProfileJamCircleSection({
    hasHiddenMembers,
    isExpanded,
    isLoading,
    members,
    onMemberClick,
    onToggleExpanded,
}) {
    return (
        <div className="profile-section">

            {/* ── Section heading ───────────────────────────────────────────── */}
            {/* No edit button here — jam-circle membership is managed from the
                members page, not through a profile edit modal */}
            <div className="profile-section-heading">
                <h2>Your Jam Circle</h2>
            </div>

            {/* ── Loading / empty / populated states ───────────────────────── */}
            {isLoading ? (
                // Show a loading message while the jam-circle API call is in-flight
                <p className="profile-copy">Loading your Jam Circle...</p>
            ) : members.length === 0 ? (
                // Empty state: prompt the user to explore the members page
                <p className="profile-copy">
                    You don&apos;t have anyone in your Jam Circle yet. Explore the{' '}
                    <span className="profile-linkish">members</span> page and start connecting with fellow dancers!
                </p>
            ) : (
                <div className="profile-circle-list" aria-label="Your jam circle members">
                    {/* Profile.jsx pre-filters this array to either a truncated
                        preview or the full list depending on isExpanded */}
                    {members.map((member) => (
                        <article key={member.userId} className="profile-circle-row profile-circle-row-name-only">
                            <div className="profile-circle-member">

                                {/* Avatar button — navigates to this member's profile page */}
                                <button
                                    type="button"
                                    className="profile-circle-avatar-button"
                                    onClick={() => onMemberClick(member.userId)}
                                    aria-label={`View ${member.fullName || 'member'} profile`}
                                >
                                    <ProfileAvatar
                                        firstName={member.displayFirstName}
                                        lastName={member.displayLastName}
                                        avatarUrl={member.avatarUrl}
                                        size={52}
                                    />
                                </button>

                                <div className="profile-circle-member-main">
                                    {/* Name button — same destination as the avatar button above */}
                                    <button
                                        type="button"
                                        className="profile-circle-name-button"
                                        onClick={() => onMemberClick(member.userId)}
                                        aria-label={`View ${member.fullName || 'member'} profile`}
                                    >
                                        {/* Fall back to a generic label if the member has no
                                            resolved display name */}
                                        {member.fullName || 'Swinggity Member'}
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}

                    {/* ── Expand / collapse toggle ──────────────────────────── */}
                    {/* Only rendered when the full list was truncated; the label
                        reflects whether the list is currently collapsed or expanded */}
                    {hasHiddenMembers ? (
                        <button
                            type="button"
                            className="profile-circle-toggle-link"
                            onClick={onToggleExpanded}
                        >
                            {isExpanded ? 'Show fewer contacts' : 'View the whole Jam Circle'}
                        </button>
                    ) : null}
                </div>
            )}
        </div>
    );
}