import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ProfileAvatar from '../../../components/ProfileAvatar';
import instagramIcon from '../../../assets/instagram-icon.svg';
import facebookIcon from '../../../assets/facebook-icon.svg';
import youtubeIcon from '../../../assets/youtube-icon.svg';
import linkedinIcon from '../../../assets/likedin-icon.svg';
import '../pages/Members.css';
import '../../Profile/pages/Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show.',
    jamCircle: "No jam circle details to show.",
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
    const [member, setMember] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
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
                </div>
            </header>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Jam Circle</h2>
                </div>
                <p className="profile-copy">{member.jamCircle || PLACEHOLDERS.jamCircle}</p>
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
