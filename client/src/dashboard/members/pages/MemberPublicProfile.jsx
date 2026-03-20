import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import ProfileAvatar from '../../../components/ProfileAvatar';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import mailIcon from '../../../assets/mail-icon.svg';
import addNewCircleIcon from '../../../assets/add-new-circle.svg';
import removeIcon from '../../../assets/remove-icon.svg';
import blockIcon from '../../../assets/block-icon.svg';
import flagIcon from '../../../assets/flag-icon.svg';
import '../pages/Members.css';
import '../../Profile/pages/Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show.',
    interests: 'No tags to show.',
    activity: 'No public activity to show yet.',
};

const TAG_COLORS = [
    'profile-tag-color-1',
    'profile-tag-color-2',
    'profile-tag-color-3',
    'profile-tag-color-4',
    'profile-tag-color-5',
];

const SOCIAL_PLATFORMS = {
    instagram: { label: 'Instagram', icon: instagramIcon },
    facebook: { label: 'Facebook', icon: facebookIcon },
    youtube: { label: 'YouTube', icon: youtubeIcon },
    linkedin: { label: 'LinkedIn', icon: linkedinIcon },
};

const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube', 'linkedin'];

const getName = (member) => {
    const firstName = typeof member?.displayFirstName === 'string' ? member.displayFirstName.trim() : '';
    const lastName = typeof member?.displayLastName === 'string' ? member.displayLastName.trim() : '';
    return `${firstName} ${lastName}`.trim() || 'Swinggity Member';
};

export default function MemberPublicProfilePage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [menuActionState, setMenuActionState] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openCircleMenuMemberId, setOpenCircleMenuMemberId] = useState('');
    const [circleActionState, setCircleActionState] = useState('');
    const menuRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    useEffect(() => {
        const fetchMemberProfile = async () => {
            setIsLoading(true);
            setError('');

            try {
                const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(String(id || ''))}/profile`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok || !data.success || !data.member) {
                    throw new Error(data.message || 'Unable to load member profile.');
                }

                setMember(data.member);
            } catch (fetchError) {
                setError(fetchError.message || 'Unable to load member profile right now.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMemberProfile();
    }, [API_URL, id]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedInsideHeaderActions = menuRef.current && menuRef.current.contains(event.target);
            const clickedInsideCircleActions = event.target instanceof Element
                ? event.target.closest('.profile-circle-actions')
                : null;

            if (!clickedInsideHeaderActions && !clickedInsideCircleActions) {
                setIsMenuOpen(false);
                setOpenCircleMenuMemberId('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const socialKeys = useMemo(() => {
        if (!member?.showSocialLinks || !member?.socialLinks || typeof member.socialLinks !== 'object') return [];

        return SOCIAL_KEYS.filter((socialKey) => typeof member.socialLinks[socialKey] === 'string' && member.socialLinks[socialKey].trim().length > 0);
    }, [member]);

    const profileTags = useMemo(() => {
        return Array.isArray(member?.tags)
            ? member.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
            : [];
    }, [member]);

    const openSocialLink = (socialKey) => {
        const memberIdPart = encodeURIComponent(String(id || ''));
        const platformPart = encodeURIComponent(String(socialKey || ''));
        window.open(`${API_URL}/api/auth/members/${memberIdPart}/social/${platformPart}`, '_blank', 'noopener,noreferrer');
    };

    const handlePlaceholderContact = () => {
        window.alert('Contact action coming soon.');
    };

    const handlePlaceholderReport = () => {
        window.alert('Flag / Report profile action coming soon.');
    };

    const handleInvite = async () => {
        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('invite');
        try {
            const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(memberId)}/invite`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to send invitation.');
            }

            setIsMenuOpen(false);
            window.alert('Your invitation was sent.');
        } catch (inviteError) {
            window.alert(inviteError.message || 'Unable to send invitation.');
        } finally {
            setMenuActionState('');
        }
    };

    const handleRemoveFromJamCircle = async () => {
        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('remove');
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/jam-circle/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to remove member from Jam Circle.');
            }

            setIsMenuOpen(false);
            window.alert('Member removed from your Jam Circle.');
        } catch (removeError) {
            window.alert(removeError.message || 'Unable to remove member from Jam Circle.');
        } finally {
            setMenuActionState('');
        }
    };

    const handleBlockMember = async () => {
        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('block');
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to block member.');
            }

            setIsMenuOpen(false);
            navigate('/dashboard/members');
        } catch (blockError) {
            window.alert(blockError.message || 'Unable to block member.');
        } finally {
            setMenuActionState('');
        }
    };

    const handleCircleInvite = async (circleMember) => {
        const memberId = String(circleMember?.userId || '');
        if (!memberId || circleActionState) return;

        setCircleActionState(`invite:${memberId}`);
        try {
            const response = await fetch(`${API_URL}/api/auth/members/${encodeURIComponent(memberId)}/invite`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to send invitation.');
            }

            setOpenCircleMenuMemberId('');
            window.alert('Your invitation was sent.');
        } catch (inviteError) {
            window.alert(inviteError.message || 'Unable to send invitation.');
        } finally {
            setCircleActionState('');
        }
    };

    const handleCircleRemove = async (circleMember) => {
        const memberId = String(circleMember?.userId || '');
        if (!memberId || circleActionState) return;

        setCircleActionState(`remove:${memberId}`);
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/jam-circle/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to remove member from Jam Circle.');
            }

            setOpenCircleMenuMemberId('');
            window.alert('Member removed from your Jam Circle.');
        } catch (removeError) {
            window.alert(removeError.message || 'Unable to remove member from Jam Circle.');
        } finally {
            setCircleActionState('');
        }
    };

    const handleCircleBlock = async (circleMember) => {
        const memberId = String(circleMember?.userId || '');
        if (!memberId || circleActionState) return;

        setCircleActionState(`block:${memberId}`);
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to block member.');
            }

            setOpenCircleMenuMemberId('');
            navigate('/dashboard/members');
        } catch (blockError) {
            window.alert(blockError.message || 'Unable to block member.');
        } finally {
            setCircleActionState('');
        }
    };

    if (isLoading) {
        return <p className="members-info">Loading profile...</p>;
    }

    if (error) {
        return (
            <section className="members-page" aria-label="Public member profile">
                <p className="members-error">{error}</p>
            </section>
        );
    }

    if (!member) {
        return <p className="members-info">Member not found.</p>;
    }

    return (
        <section className="profile-page" aria-label="Public member profile">
            <header className="profile-header">
                <div className="profile-avatar-wrap">
                    <ProfileAvatar
                        firstName={member.displayFirstName}
                        lastName={member.displayLastName}
                        avatarUrl={member.avatarUrl}
                        size={156}
                    />
                </div>

                <div className="profile-header-copy">
                    <h1>
                        {getName(member)}
                        {member.pronouns ? <span className="profile-name-pronouns"> ({member.pronouns})</span> : null}
                    </h1>
                    <div className="profile-heading-row">
                        <p className="profile-copy">{member.bio || PLACEHOLDERS.bio}</p>
                    </div>
                    {socialKeys.length > 0 ? (
                        <div className="profile-social-links" aria-label="Social links">
                            {socialKeys.map((socialKey) => {
                                const social = SOCIAL_PLATFORMS[socialKey];
                                if (!social) return null;

                                return (
                                    <button
                                        key={socialKey}
                                        type="button"
                                        className="member-social-link"
                                        aria-label={social.label}
                                        onClick={() => openSocialLink(socialKey)}
                                    >
                                        <img src={social.icon} alt="" />
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                    <div className="profile-public-actions" ref={menuRef}>
                        <button
                            type="button"
                            className="profile-circle-btn profile-circle-btn-contact"
                            onClick={handlePlaceholderContact}
                        >
                            <img src={mailIcon} alt="" aria-hidden="true" className="profile-circle-btn-icon" />
                            Contact
                        </button>
                        <button
                            type="button"
                            className={`profile-circle-btn profile-circle-btn-more ${isMenuOpen ? 'is-open' : ''}`}
                            onClick={() => setIsMenuOpen((currentState) => !currentState)}
                        >
                            More
                            <span className="profile-circle-btn-caret" aria-hidden="true" />
                        </button>
                        {isMenuOpen ? (
                            <div className="profile-circle-menu" role="menu" aria-label={`Actions for ${getName(member)}`}>
                                {!member.isCurrentUser ? (
                                    <button
                                        type="button"
                                        className="profile-circle-menu-item"
                                        onClick={handleInvite}
                                        disabled={menuActionState.length > 0}
                                    >
                                        <span className="profile-circle-menu-item-content">
                                            <img src={addNewCircleIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                            {menuActionState === 'invite' ? 'Sending...' : 'Add to the Jam Circle'}
                                        </span>
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="profile-circle-menu-item"
                                    onClick={handleRemoveFromJamCircle}
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
                                    onClick={handleBlockMember}
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
                                    onClick={handlePlaceholderReport}
                                >
                                    <span className="profile-circle-menu-item-content">
                                        <img src={flagIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                        Flag / Report profile
                                    </span>
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </header>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Jam Circle</h2>
                </div>
                {!Array.isArray(member.jamCircleMembers) || member.jamCircleMembers.length === 0 ? (
                    <p className="profile-copy">No members in this Jam Circle yet.</p>
                ) : (
                    <div className="profile-circle-list" aria-label="Jam circle members">
                        {member.jamCircleMembers.map((circleMember) => (
                            <article key={circleMember.userId} className="profile-circle-row">
                                <div className="profile-circle-member">
                                    <button
                                        type="button"
                                        className="profile-circle-avatar-button"
                                        onClick={() => navigate(`/dashboard/members/${circleMember.userId}`)}
                                        aria-label={`View ${circleMember.fullName || 'member'} profile`}
                                    >
                                        <ProfileAvatar
                                            firstName={circleMember.displayFirstName}
                                            lastName={circleMember.displayLastName}
                                            avatarUrl={circleMember.avatarUrl}
                                            size={52}
                                        />
                                    </button>
                                    <div className="profile-circle-member-main">
                                        <button
                                            type="button"
                                            className="profile-circle-name-button"
                                            onClick={() => navigate(`/dashboard/members/${circleMember.userId}`)}
                                            aria-label={`View ${circleMember.fullName || 'member'} profile`}
                                        >
                                            {circleMember.fullName || 'Swinggity Member'}
                                        </button>
                                        {String(circleMember.userId || '') === String(user?._id || '') ? (
                                            <p className="profile-circle-status">You are in their Jam Circle!</p>
                                        ) : (
                                            <div className="profile-circle-actions">
                                                <button
                                                    type="button"
                                                    className="profile-circle-btn profile-circle-btn-contact"
                                                    onClick={handlePlaceholderContact}
                                                >
                                                    <img src={mailIcon} alt="" aria-hidden="true" className="profile-circle-btn-icon" />
                                                    Contact
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`profile-circle-btn profile-circle-btn-more ${openCircleMenuMemberId === String(circleMember.userId || '') ? 'is-open' : ''}`}
                                                    onClick={() => setOpenCircleMenuMemberId((currentId) => (
                                                        currentId === String(circleMember.userId || '') ? '' : String(circleMember.userId || '')
                                                    ))}
                                                >
                                                    More
                                                    <span className="profile-circle-btn-caret" aria-hidden="true" />
                                                </button>
                                                {openCircleMenuMemberId === String(circleMember.userId || '') ? (
                                                    <div className="profile-circle-menu" role="menu" aria-label={`Actions for ${circleMember.fullName || 'member'}`}>
                                                        <button
                                                            type="button"
                                                            className="profile-circle-menu-item"
                                                            onClick={() => handleCircleInvite(circleMember)}
                                                            disabled={circleActionState.length > 0}
                                                        >
                                                            <span className="profile-circle-menu-item-content">
                                                                <img src={addNewCircleIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                                {circleActionState === `invite:${String(circleMember.userId || '')}` ? 'Sending...' : 'Add to the Jam Circle'}
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="profile-circle-menu-item"
                                                            onClick={() => handleCircleRemove(circleMember)}
                                                            disabled={circleActionState.length > 0}
                                                        >
                                                            <span className="profile-circle-menu-item-content">
                                                                <img src={removeIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                                {circleActionState === `remove:${String(circleMember.userId || '')}` ? 'Removing...' : 'Remove from Jam Circle'}
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="profile-circle-menu-item"
                                                            onClick={() => handleCircleBlock(circleMember)}
                                                            disabled={circleActionState.length > 0}
                                                        >
                                                            <span className="profile-circle-menu-item-content">
                                                                <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                                {circleActionState === `block:${String(circleMember.userId || '')}` ? 'Blocking...' : 'Block member'}
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="profile-circle-menu-item"
                                                            onClick={handlePlaceholderReport}
                                                        >
                                                            <span className="profile-circle-menu-item-content">
                                                                <img src={flagIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                                Flag / Report profile
                                                            </span>
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Interests</h2>
                </div>
                {profileTags.length === 0 ? (
                    <p className="profile-copy">{PLACEHOLDERS.interests}</p>
                ) : (
                    <div className="profile-tag-cloud" aria-label="Selected interests">
                        {profileTags.map((tag, index) => (
                            <span key={`${tag}-${index}`} className={`profile-tag-pill ${TAG_COLORS[index % TAG_COLORS.length]}`}>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Activity</h2>
                </div>
                <p className="profile-copy">{member.activity || PLACEHOLDERS.activity}</p>
            </div>
        </section>
    );
}
