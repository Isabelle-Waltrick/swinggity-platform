/**
 * MemberPublicProfileActions:
 * Renders action buttons for a public member profile, including contact, menu toggle,
 * and context-aware admin/member actions (invite, remove, block, report, delete).
 */

// Action icon sprites are reused across menu items and buttons.
import mailIcon from '../../../assets/mail-icon.svg';
import addNewCircleIcon from '../../../assets/add-new-circle.svg';
import removeIcon from '../../../assets/remove-icon.svg';
import blockIcon from '../../../assets/block-icon.svg';
import flagIcon from '../../../assets/flag-icon.svg';

// Tooltip message explains privacy-related contact blocking to users.
const CONTACT_BLOCKED_MESSAGE = "Sorry, you can't contact this member due to their privacy settings.";

// Component receives event callbacks and state from the parent profile page via hook.
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
            {/* Contact button with privacy-aware conditional: blocked or enabled variant. */}
            {isContactBlocked ? (
                // Blocked contact shows a disabled button + tooltip hint on hover/focus.
                <span
                    className={`profile-contact-tooltip-wrap ${showContactBlockedHint ? 'is-visible' : ''}`}
                    aria-disabled="true"
                    onMouseLeave={onHideContactBlockedHint}
                >
                    {/* Disabled contact button: shows when user's privacy settings block messages. */}
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
                // Contact button: opens messaging popup to send direct message to member.
                <button
                    type="button"
                    className="profile-circle-btn profile-circle-btn-contact"
                    onClick={onOpenMemberContact}
                >
                    <img src={mailIcon} alt="" aria-hidden="true" className="profile-circle-btn-icon" />
                    Contact
                </button>
            )}
            {/* More actions menu toggle button; manages profile-context dropdown menu. */}
            {/* Menu toggle: opens/closes the profile action menu dropdown. */}
            <button
                type="button"
                className={`profile-circle-btn profile-circle-btn-more ${isMenuOpen ? 'is-open' : ''}`}
                onClick={onToggleMenu}
            >
                More
                <span className="profile-circle-btn-caret" aria-hidden="true" />
            </button>

            {/* Dropdown menu surfaces role-specific actions and shifts based on viewer role/relationship. */}
            {isMenuOpen ? (
                <div className="profile-circle-menu" role="menu" aria-label={`Actions for ${memberName}`}>
                    {/* Member-to-member actions: invite or jam-circle management. */}
                    {!member?.isCurrentUser && !isAdminUser && !isViewedMemberAdmin ? (
                        // Invite button: adds member to current user's Jam Circle.
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

                    {/* Admin-only actions: member deletion or general member management. */}
                    {isAdminUser ? (
                        // Delete button: permanently removes member account from platform (admin only).
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
                        // Non-admins see: remove from jam circle, block, and report options.
                        <>
                            {/* Remove button: removes member from current user's Jam Circle. */}
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
                            {/* Block button: prevents member from contacting or viewing current user's profile. */}
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
                            {/* Report button: opens dialog to flag profile for violating community guidelines. */}
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
