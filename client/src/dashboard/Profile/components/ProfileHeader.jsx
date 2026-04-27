import editIcon from '../../../assets/edit.svg';

/**
 * ProfileHeader:
 * Renders the profile avatar, name, bio, and social links for the current user.
 */
export default function ProfileHeader({
    avatarSrc,
    bio,
    displayPronouns,
    initials,
    onlineLinks,
    onEdit,
    showEditControls,
    userName,
}) {
    return (
        <header className="profile-header">
            <div className="profile-avatar-wrap">
                <div className="profile-avatar" aria-hidden="true">
                    {avatarSrc ? (
                        <img className="profile-avatar-image" src={avatarSrc} alt="Profile avatar" />
                    ) : (
                        initials
                    )}
                </div>
                {showEditControls ? (
                    <button type="button" className="edit-icon-btn avatar-edit" onClick={onEdit} aria-label="Edit profile">
                        <img src={editIcon} alt="" />
                    </button>
                ) : null}
            </div>

            <div className="profile-header-copy">
                <h1>
                    {userName}
                    {displayPronouns ? <span className="profile-name-pronouns"> ({displayPronouns})</span> : null}
                </h1>
                <div className="profile-heading-row">
                    <p className="profile-copy">{bio}</p>
                    {showEditControls ? (
                        <button type="button" className="edit-icon-btn" onClick={onEdit} aria-label="Edit bio">
                            <img src={editIcon} alt="" />
                        </button>
                    ) : null}
                </div>
                {onlineLinks.length > 0 ? (
                    <div className="profile-social-links" aria-label="Online Links">
                        {onlineLinks.map((platform) => (
                            <a
                                key={platform.key}
                                href={platform.href}
                                className="profile-social-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={platform.label}
                            >
                                <img src={platform.icon} alt="" />
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>
        </header>
    );
}