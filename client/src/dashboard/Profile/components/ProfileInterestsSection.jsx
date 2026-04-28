import editIcon from '../../../assets/edit.svg';

/**
 * ProfileInterestsSection
 *
 * Renders the "Your Interests" section of the profile page as a colour-coded
 * tag cloud. When the profile has no tags yet, a placeholder message is shown
 * in its place.
 *
 * Tag colours are assigned by cycling through `tagColors` using the tag's
 * index modulo the palette length, so the pattern repeats rather than
 * overflowing the array.
 *
 * The edit button is only rendered for the profile owner (`showEditControls`
 * true), and calls back to the single `onEdit` handler in Profile.jsx which
 * opens the edit modal.
 *
 * Props:
 *   placeholder      {string}    — Copy shown when `tags` is empty.
 *   showEditControls {boolean}   — Whether to render the edit button; true only
 *                                  for the profile owner.
 *   tags             {string[]}  — List of interest tags saved on the profile.
 *   tagColors        {string[]}  — CSS class names cycled as tag pill colours.
 *   onEdit           {Function}  — Opens the profile edit modal.
 */
export default function ProfileInterestsSection({
    placeholder,
    showEditControls,
    tags,
    tagColors,
    onEdit,
}) {
    return (
        <div className="profile-section">

            {/* ── Section heading ───────────────────────────────────────────── */}
            <div className="profile-section-heading">
                <h2>Your Interests</h2>
                {/* Edit button only visible to the profile owner */}
                {showEditControls ? (
                    <button type="button" className="edit-icon-btn" onClick={onEdit} aria-label="Edit interests">
                        <img src={editIcon} alt="" />
                    </button>
                ) : null}
            </div>

            {/* ── Tag cloud or empty placeholder ────────────────────────────── */}
            {/* When no tags are saved, render only the placeholder text rather
                than mounting an empty tag cloud container */}
            {tags.length === 0 ? (
                <p className="profile-copy">{placeholder}</p>
            ) : (
                <div className="profile-tag-cloud" aria-label="Selected interests">
                    {/* Colour is assigned by cycling through the tagColors palette
                        using index % length, so the pattern repeats for any number
                        of tags without overflowing the array */}
                    {tags.map((tag, index) => (
                        <span key={`${tag}-${index}`} className={`profile-tag-pill ${tagColors[index % tagColors.length]}`}>
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}