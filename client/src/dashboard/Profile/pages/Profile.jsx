import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import editIcon from '../../../assets/edit.svg';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import './Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show. Let other members know a hit more about your lovely self.',
    jamCircle: 'You don\'t have anyone in your Jam Circle yet. Explore the members page and start connecting with fellow dancers!',
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
        jamCircle: user?.jamCircle ?? '',
        activity: user?.activity ?? '',
    };

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

    const renderSectionValue = (key) => {
        if (profileData[key]) {
            return <p className="profile-copy">{profileData[key]}</p>;
        }

        if (key === 'jamCircle') {
            return (
                <p className="profile-copy">
                    You don&apos;t have anyone in your Jam Circle yet. Explore the{' '}
                    <span className="profile-linkish">members</span> page and start connecting with fellow dancers!
                </p>
            );
        }

        return <p className="profile-copy">{PLACEHOLDERS[key]}</p>;
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
                    {showEditControls ? (
                        <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit jam circle">
                            <img src={editIcon} alt="" />
                        </button>
                    ) : null}
                </div>
                {renderSectionValue('jamCircle')}
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
                {renderSectionValue('activity')}
            </div>
        </section>
    );
}