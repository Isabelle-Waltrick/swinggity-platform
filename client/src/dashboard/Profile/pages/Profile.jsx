import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import editIcon from '../../../assets/edit.svg';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import mailIcon from '../../../assets/mail-icon.svg';
import removeIcon from '../../../assets/remove-icon.svg';
import blockIcon from '../../../assets/block-icon.svg';
import flagIcon from '../../../assets/flag-icon.svg';
import ProfileAvatar from '../../../components/ProfileAvatar';
import './Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show. Let other members know a hit more about your lovely self.',
    interests: 'No tags to show. Adding interests helps you to connect with other members.',
    activity: 'You haven\'t interacted in the platform yet. Your activities in the platform will be shown here.',
};

const TAG_COLORS = [
    'profile-tag-color-1',
    'profile-tag-color-2',
    'profile-tag-color-3',
    'profile-tag-color-4',
    'profile-tag-color-5',
];

const SOCIAL_PLATFORMS = [
    { key: 'instagram', label: 'Instagram', icon: instagramIcon },
    { key: 'facebook', label: 'Facebook', icon: facebookIcon },
    { key: 'youtube', label: 'YouTube', icon: youtubeIcon },
    { key: 'linkedin', label: 'LinkedIn', icon: linkedinIcon },
];

const normalizeSocialUrl = (rawUrl) => {
    if (typeof rawUrl !== 'string') return '';

    const trimmed = rawUrl.trim();
    if (!trimmed) return '';

    const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;

    try {
        const parsed = new URL(prefixed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
};

export default function ProfilePage({ showEditControls = true }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [jamCircleMembers, setJamCircleMembers] = useState(Array.isArray(user?.jamCircleMembers) ? user.jamCircleMembers : []);
    const [blockedMembers, setBlockedMembers] = useState(Array.isArray(user?.blockedMembers) ? user.blockedMembers : []);
    const [isCircleLoading, setIsCircleLoading] = useState(true);
    const [isBlockedLoading, setIsBlockedLoading] = useState(true);
    const [openMenuMemberId, setOpenMenuMemberId] = useState('');
    const [actingMemberId, setActingMemberId] = useState('');
    const menuRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const resolvedDisplayFirstName = user?.displayFirstName?.trim() || user?.firstName || '';
    const resolvedDisplayLastName = user?.displayLastName?.trim() || user?.lastName || '';

    const userName = useMemo(() => {
        const firstName = resolvedDisplayFirstName;
        const lastName = resolvedDisplayLastName;
        return `${firstName} ${lastName}`.trim() || 'New Member';
    }, [resolvedDisplayFirstName, resolvedDisplayLastName]);

    const displayPronouns = (typeof user?.pronouns === 'string' ? user.pronouns.trim() : '');

    const initials = useMemo(() => {
        const first = resolvedDisplayFirstName[0] ?? '';
        const last = resolvedDisplayLastName[0] ?? '';
        return `${first}${last}`.toUpperCase() || 'NM';
    }, [resolvedDisplayFirstName, resolvedDisplayLastName]);

    const profileData = {
        bio: user?.bio ?? '',
    };

    const activityFeed = (Array.isArray(user?.activityFeed) ? user.activityFeed : [])
        .map((item) => ({
            ...item,
            message: typeof item?.message === 'string' ? item.message.trim() : '',
        }))
        .filter((item) => Boolean(item.message));

    useEffect(() => {
        const fetchJamCircle = async () => {
            setIsCircleLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/auth/profile/jam-circle`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load your Jam Circle.');
                }

                setJamCircleMembers(Array.isArray(data.members) ? data.members : []);
            } catch {
                setJamCircleMembers(Array.isArray(user?.jamCircleMembers) ? user.jamCircleMembers : []);
            } finally {
                setIsCircleLoading(false);
            }
        };

        fetchJamCircle();
    }, [API_URL, user?.jamCircleMembers]);

    useEffect(() => {
        const fetchBlockedMembers = async () => {
            setIsBlockedLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/auth/profile/blocked-members`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load blocked members.');
                }

                setBlockedMembers(Array.isArray(data.members) ? data.members : []);
            } catch {
                setBlockedMembers(Array.isArray(user?.blockedMembers) ? user.blockedMembers : []);
            } finally {
                setIsBlockedLoading(false);
            }
        };

        fetchBlockedMembers();
    }, [API_URL, user?.blockedMembers]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuMemberId('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const profileTags = (Array.isArray(user?.profileTags) ? user.profileTags : [])
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);

    const socialLinks = SOCIAL_PLATFORMS
        .map((platform) => ({
            ...platform,
            href: normalizeSocialUrl(user?.[platform.key]),
        }))
        .filter((platform) => Boolean(platform.href));

    const goToEditPage = () => {
        navigate('/dashboard/profile/edit');
    };

    const avatarSrc = user?.avatarUrl
        ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${API_URL}${user.avatarUrl}`)
        : '';

    const handlePlaceholderContact = () => {
        window.alert('Contact action coming soon.');
    };

    const handlePlaceholderReport = () => {
        window.alert('Flag / Report profile action coming soon.');
    };

    const handleRemoveFromJamCircle = async (member) => {
        const memberId = String(member?.userId || '');
        if (!memberId || actingMemberId) return;

        setActingMemberId(memberId);
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/jam-circle/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to remove member from Jam Circle.');
            }

            setJamCircleMembers((currentMembers) => currentMembers.filter((item) => String(item?.userId || '') !== memberId));
            setOpenMenuMemberId('');
        } catch (removeError) {
            window.alert(removeError.message || 'Unable to remove member from Jam Circle.');
        } finally {
            setActingMemberId('');
        }
    };

    const handleBlockMember = async (member) => {
        const memberId = String(member?.userId || '');
        if (!memberId || actingMemberId) return;

        setActingMemberId(memberId);
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to block member.');
            }

            setJamCircleMembers((currentMembers) => currentMembers.filter((item) => String(item?.userId || '') !== memberId));
            setBlockedMembers((currentMembers) => {
                const exists = currentMembers.some((item) => String(item?.userId || '') === memberId);
                return exists ? currentMembers : [...currentMembers, member];
            });
            setOpenMenuMemberId('');
        } catch (blockError) {
            window.alert(blockError.message || 'Unable to block member.');
        } finally {
            setActingMemberId('');
        }
    };

    const handleUnblockMember = async (member) => {
        const memberId = String(member?.userId || '');
        if (!memberId || actingMemberId) return;

        setActingMemberId(memberId);
        try {
            const response = await fetch(`${API_URL}/api/auth/profile/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to unblock member.');
            }

            setBlockedMembers((currentMembers) => currentMembers.filter((item) => String(item?.userId || '') !== memberId));
        } catch (unblockError) {
            window.alert(unblockError.message || 'Unable to unblock member.');
        } finally {
            setActingMemberId('');
        }
    };

    const renderSectionValue = (key) => {
        if (profileData[key]) {
            return <p className="profile-copy">{profileData[key]}</p>;
        }

        return <p className="profile-copy">{PLACEHOLDERS[key]}</p>;
    };

    const renderActivityValue = () => {
        if (activityFeed.length > 0) {
            return (
                <ul className="profile-activity-feed" aria-label="Recent activity">
                    {activityFeed.map((item, index) => {
                        const createdAt = item?.createdAt ? new Date(item.createdAt) : null;
                        const hasValidDate = createdAt && !Number.isNaN(createdAt.getTime());

                        return (
                            <li key={`${item?.entityId || item?.message || 'activity'}-${index}`} className="profile-activity-item">
                                <p className="profile-copy">{item.message}</p>
                                {hasValidDate ? (
                                    <small className="profile-activity-time">
                                        {createdAt.toLocaleString('en-GB', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </small>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            );
        }

        const legacyActivity = typeof user?.activity === 'string' ? user.activity.trim() : '';
        if (legacyActivity) {
            return <p className="profile-copy">{legacyActivity}</p>;
        }

        return <p className="profile-copy">{PLACEHOLDERS.activity}</p>;
    };

    return (
        <section className="profile-page" aria-label="My profile">
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
                        <button type="button" className="edit-icon-btn avatar-edit" onClick={goToEditPage} aria-label="Edit profile">
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
                        {renderSectionValue('bio')}
                        {showEditControls ? (
                            <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit bio">
                                <img src={editIcon} alt="" />
                            </button>
                        ) : null}
                    </div>
                    {socialLinks.length > 0 ? (
                        <div className="profile-social-links" aria-label="Social links">
                            {socialLinks.map((platform) => (
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

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Jam Circle</h2>
                </div>
                {isCircleLoading ? (
                    <p className="profile-copy">Loading your Jam Circle...</p>
                ) : jamCircleMembers.length === 0 ? (
                    <p className="profile-copy">
                        You don&apos;t have anyone in your Jam Circle yet. Explore the{' '}
                        <span className="profile-linkish">members</span> page and start connecting with fellow dancers!
                    </p>
                ) : (
                    <div className="profile-circle-list" aria-label="Your jam circle members">
                        {jamCircleMembers.map((member) => (
                            <article key={member.userId} className="profile-circle-row">
                                <div className="profile-circle-member">
                                    <button
                                        type="button"
                                        className="profile-circle-avatar-button"
                                        onClick={() => navigate(`/dashboard/members/${member.userId}`)}
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
                                            onClick={() => navigate(`/dashboard/members/${member.userId}`)}
                                            aria-label={`View ${member.fullName || 'member'} profile`}
                                        >
                                            {member.fullName || 'Swinggity Member'}
                                        </button>
                                        <div className="profile-circle-actions" ref={openMenuMemberId === String(member.userId || '') ? menuRef : null}>
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
                                                className={`profile-circle-btn profile-circle-btn-more ${openMenuMemberId === String(member.userId || '') ? 'is-open' : ''}`}
                                                onClick={() => setOpenMenuMemberId((currentId) => (
                                                    currentId === String(member.userId || '') ? '' : String(member.userId || '')
                                                ))}
                                            >
                                                More
                                                <span className="profile-circle-btn-caret" aria-hidden="true" />
                                            </button>
                                            {openMenuMemberId === String(member.userId || '') ? (
                                                <div className="profile-circle-menu" role="menu" aria-label={`Actions for ${member.fullName || 'member'}`}>
                                                    <button
                                                        type="button"
                                                        className="profile-circle-menu-item"
                                                        onClick={() => handleRemoveFromJamCircle(member)}
                                                        disabled={actingMemberId === String(member.userId || '')}
                                                    >
                                                        <span className="profile-circle-menu-item-content">
                                                            <img src={removeIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                            Remove from Jam Circle
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="profile-circle-menu-item"
                                                        onClick={() => handleBlockMember(member)}
                                                        disabled={actingMemberId === String(member.userId || '')}
                                                    >
                                                        <span className="profile-circle-menu-item-content">
                                                            <img src={blockIcon} alt="" aria-hidden="true" className="profile-circle-menu-icon" />
                                                            Block member
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
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Blocked Members</h2>
                </div>
                {isBlockedLoading ? (
                    <p className="profile-copy">Loading blocked members...</p>
                ) : blockedMembers.length === 0 ? (
                    <p className="profile-copy">You have no blocked members.</p>
                ) : (
                    <div className="profile-circle-list" aria-label="Blocked members">
                        {blockedMembers.map((member) => (
                            <article key={member.userId} className="profile-circle-row">
                                <div className="profile-circle-member">
                                    <ProfileAvatar
                                        firstName={member.displayFirstName}
                                        lastName={member.displayLastName}
                                        avatarUrl={member.avatarUrl}
                                        size={52}
                                    />
                                    <div className="profile-circle-member-main">
                                        <p>{member.fullName || 'Swinggity Member'}</p>
                                        <div className="profile-circle-actions">
                                            <button
                                                type="button"
                                                className="profile-circle-btn profile-circle-btn-more"
                                                onClick={() => handleUnblockMember(member)}
                                                disabled={actingMemberId === String(member.userId || '')}
                                            >
                                                {actingMemberId === String(member.userId || '') ? 'Unblocking...' : 'Unblock'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Interests</h2>
                    {showEditControls ? (
                        <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit interests">
                            <img src={editIcon} alt="" />
                        </button>
                    ) : null}
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
                    <h2>Your Activity</h2>
                    {showEditControls ? (
                        <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit activity">
                            <img src={editIcon} alt="" />
                        </button>
                    ) : null}
                </div>
                {renderActivityValue()}
            </div>
        </section>
    );
}