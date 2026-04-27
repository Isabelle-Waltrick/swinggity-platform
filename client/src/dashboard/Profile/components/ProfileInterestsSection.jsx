import editIcon from '../../../assets/edit.svg';

/**
 * ProfileInterestsSection:
 * Renders the user's profile tags or the interests placeholder when no tags exist.
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
            <div className="profile-section-heading">
                <h2>Your Interests</h2>
                {showEditControls ? (
                    <button type="button" className="edit-icon-btn" onClick={onEdit} aria-label="Edit interests">
                        <img src={editIcon} alt="" />
                    </button>
                ) : null}
            </div>
            {tags.length === 0 ? (
                <p className="profile-copy">{placeholder}</p>
            ) : (
                <div className="profile-tag-cloud" aria-label="Selected interests">
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