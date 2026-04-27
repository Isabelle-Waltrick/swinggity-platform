import ProfileAvatar from '../../../components/ProfileAvatar';

/**
 * ProfileJamCircleSection:
 * Renders the current user's jam-circle preview, empty state, and expand/collapse control.
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
            <div className="profile-section-heading">
                <h2>Your Jam Circle</h2>
            </div>
            {isLoading ? (
                <p className="profile-copy">Loading your Jam Circle...</p>
            ) : members.length === 0 ? (
                <p className="profile-copy">
                    You don&apos;t have anyone in your Jam Circle yet. Explore the{' '}
                    <span className="profile-linkish">members</span> page and start connecting with fellow dancers!
                </p>
            ) : (
                <div className="profile-circle-list" aria-label="Your jam circle members">
                    {members.map((member) => (
                        <article key={member.userId} className="profile-circle-row profile-circle-row-name-only">
                            <div className="profile-circle-member">
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
                                    <button
                                        type="button"
                                        className="profile-circle-name-button"
                                        onClick={() => onMemberClick(member.userId)}
                                        aria-label={`View ${member.fullName || 'member'} profile`}
                                    >
                                        {member.fullName || 'Swinggity Member'}
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
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