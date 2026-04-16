import mailIcon from '../../../assets/mail-icon.svg';
import addNewCircleIcon from '../../../assets/add-new-circle.svg';
import removeIcon from '../../../assets/remove-icon.svg';
import blockIcon from '../../../assets/block-icon.svg';
import flagIcon from '../../../assets/flag-icon.svg';

const CONTACT_BLOCKED_MESSAGE = "Sorry, you can't contact this member due to their privacy settings.";

export default function MemberPublicProfileActions({
    menuRef,
    member,
    memberName,
    isContactBlocked,
    showContactBlockedHint,
    onHideContactBlockedHint,
    onShowContactBlockedHint,
    onBlockedContactAttempt,
    onOpenMemberContact,
    isMenuOpen,
    onToggleMenu,
    isAdminUser,
    isViewedMemberAdmin,
    menuActionState,
    onInvite,
    onDeleteMember,
    onRemoveFromJamCircle,
    onBlockMember,
    onOpenReportPopup,
}) {
    return (
        <div className="profile-public-actions" ref={menuRef}>
            {isContactBlocked ? (
                <span
                    className={`profile-contact-tooltip-wrap ${showContactBlockedHint ? 'is-visible' : ''}`}
                    aria-disabled="true"
                    onMouseLeave={onHideContactBlockedHint}
                >
                    <button
                        type="button"
                        className="profile-circle-btn profile-circle-btn-contact profile-circle-btn-contact-disabled"
                        aria-disabled="true"
                        onClick={onBlockedContactAttempt}
                        onFocus={onShowContactBlockedHint}
                        onBlur={onHideContactBlockedHint}
                    >
                        <img src={mailIcon} alt="" aria-hidden="true" className="profile-circle-btn-icon" />
                        Contact
                    </button>
                    <span className="profile-contact-tooltip" role="tooltip">
                        {CONTACT_BLOCKED_MESSAGE}
                    </span>
                </span>
            ) : (
                <button
                    type="button"
                    className="profile-circle-btn profile-circle-btn-contact"
                    onClick={onOpenMemberContact}
                >
                    <img src={mailIcon} alt="" aria-hidden="true" className="profile-circle-btn-icon" />
                    Contact
                </button>
            )}
            <button
                type="button"
                className={`profile-circle-btn profile-circle-btn-more ${isMenuOpen ? 'is-open' : ''}`}
                onClick={onToggleMenu}
            >
                More
                <span className="profile-circle-btn-caret" aria-hidden="true" />
            </button>
            {isMenuOpen ? (
                <div className="profile-circle-menu" role="menu" aria-label={`Actions for ${memberName}`}>
                    {!member?.isCurrentUser && !isAdminUser && !isViewedMemberAdmin ? (
                        <button
                            type="button"
                            className="profile-circle-menu-item"
                            onClick={onInvite}
                            disabled={menuActionState.length > 0}
                        >
                            <span className="profile-circle-menu-item-content">
                                <img src={addNewCircleIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                {menuActionState === 'invite' ? 'Sending...' : 'Add to the Jam Circle'}
                            </span>
                        </button>
                    ) : null}
                    {isAdminUser ? (
                        <button
                            type="button"
                            className="profile-circle-menu-item"
                            onClick={onDeleteMember}
                            disabled={Boolean(member?.isCurrentUser)}
                        >
                            <span className="profile-circle-menu-item-content">
                                <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                {member?.isCurrentUser ? 'Cannot delete yourself here' : 'Delete Member'}
                            </span>
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="profile-circle-menu-item"
                                onClick={onRemoveFromJamCircle}
                                disabled={menuActionState.length > 0}
                            >
                                <span className="profile-circle-menu-item-content">
                                    <img src={removeIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                    {menuActionState === 'remove' ? 'Removing...' : 'Remove from Jam Circle'}
                                </span>
                            </button>
                            <button
                                type="button"
                                className="profile-circle-menu-item"
                                onClick={onBlockMember}
                                disabled={menuActionState.length > 0}
                            >
                                <span className="profile-circle-menu-item-content">
                                    <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                    {menuActionState === 'block' ? 'Blocking...' : 'Block member'}
                                </span>
                            </button>
                            <button
                                type="button"
                                className="profile-circle-menu-item"
                                onClick={onOpenReportPopup}
                            >
                                <span className="profile-circle-menu-item-content">
                                    <img src={flagIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                    Flag / Report profile
                                </span>
                            </button>
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
}
