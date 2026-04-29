// The code in this file were created with help of AI (Copilot)
import editIcon from '../../../assets/edit.svg';

/**
 * ProfileHeader
 *
 * Renders the top section of a profile page: avatar, display name, pronouns,
 * bio, and any linked social/online platforms.
 *
 * Edit buttons are conditionally shown when `showEditControls` is true — i.e.
 * only when the viewer is the profile owner. All edit interactions call the
 * single `onEdit` handler passed down from Profile.jsx, which opens the edit
 * modal regardless of which button was clicked.
 *
 * Props:
 *   avatarSrc       {string|null}  — URL of the uploaded avatar image; when
 *                                    absent, falls back to the `initials` text.
 *   bio             {string}       — Short profile biography text.
 *   displayPronouns {string}       — Pre-formatted pronoun string (e.g. "she/her");
 *                                    hidden when empty/null.
 *   initials        {string}       — Two-letter initials rendered as the avatar
 *                                    fallback.
 *   onlineLinks     {Array}        — Normalised platform objects produced by
 *                                    profileDisplay.js; each has { key, href,
 *                                    label, icon }.
 *   onEdit          {Function}     — Callback that opens the profile edit modal.
 *   showEditControls {boolean}     — Whether to render edit buttons; true only
 *                                    for the authenticated profile owner.
 *   userName        {string}       — Resolved display name for the profile.
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

            {/* ── Avatar ────────────────────────────────────────────────────── */}
            <div className="profile-avatar-wrap">
                <div className="profile-avatar" aria-hidden="true">
                    {/* Show the uploaded image when available; fall back to initials */}
                    {avatarSrc ? (
                        <img className="profile-avatar-image" src={avatarSrc} alt="Profile avatar" />
                    ) : (
                        initials
                    )}
                </div>

                {/* Edit button overlaid on the avatar — only for profile owner */}
                {showEditControls ? (
                    <button type="button" className="edit-icon-btn avatar-edit" onClick={onEdit} aria-label="Edit profile">
                        <img src={editIcon} alt="" />
                    </button>
                ) : null}
            </div>

            {/* ── Name, bio, and social links ───────────────────────────────── */}
            <div className="profile-header-copy">

                {/* Display name with optional pronouns inline */}
                <h1>
                    {userName}
                    {/* Only render the pronouns span when a value was provided */}
                    {displayPronouns ? <span className="profile-name-pronouns"> ({displayPronouns})</span> : null}
                </h1>

                {/* Bio row — edit button sits beside the bio text when owner */}
                <div className="profile-heading-row">
                    <p className="profile-copy">{bio}</p>
                    {showEditControls ? (
                        <button type="button" className="edit-icon-btn" onClick={onEdit} aria-label="Edit bio">
                            <img src={editIcon} alt="" />
                        </button>
                    ) : null}
                </div>

                {/* Social/online platform links — hidden when none are configured */}
                {onlineLinks.length > 0 ? (
                    <div className="profile-social-links" aria-label="Online Links">
                        {onlineLinks.map((platform) => (
                            // Each link opens in a new tab; rel prevents opener access
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