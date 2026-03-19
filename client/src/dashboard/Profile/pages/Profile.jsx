import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import editIcon from '../../../assets/edit.svg';
import './Profile.css';

const PLACEHOLDERS = {
    bio: 'No bio to show. Let other members know a hit more about your lovely self.',
    jamCircle: 'You don\'t have anyone in your Jam Circle yet. Explore the members page and start connecting with fellow dancers!',
    interests: 'No tags to show. Adding interests helps you to connect with other members.',
    activity: 'You haven\'t interacted in the platform yet. Your activities in the platform will be shown here.',
};

export default function ProfilePage() {
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

    const initials = useMemo(() => {
        const first = resolvedDisplayFirstName[0] ?? '';
        const last = resolvedDisplayLastName[0] ?? '';
        return `${first}${last}`.toUpperCase() || 'NM';
    }, [resolvedDisplayFirstName, resolvedDisplayLastName]);

    const profileData = {
        bio: user?.bio ?? '',
        jamCircle: user?.jamCircle ?? '',
        interests: user?.interests ?? '',
        activity: user?.activity ?? '',
    };

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
                    <button type="button" className="edit-icon-btn avatar-edit" onClick={goToEditPage} aria-label="Edit profile">
                        <img src={editIcon} alt="" />
                    </button>
                </div>

                <div className="profile-header-copy">
                    <h1>{userName}</h1>
                    <div className="profile-heading-row">
                        {renderSectionValue('bio')}
                        <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit bio">
                            <img src={editIcon} alt="" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Jam Circle</h2>
                    <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit jam circle">
                        <img src={editIcon} alt="" />
                    </button>
                </div>
                {renderSectionValue('jamCircle')}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Interests</h2>
                    <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit interests">
                        <img src={editIcon} alt="" />
                    </button>
                </div>
                {renderSectionValue('interests')}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Activity</h2>
                    <button type="button" className="edit-icon-btn" onClick={goToEditPage} aria-label="Edit activity">
                        <img src={editIcon} alt="" />
                    </button>
                </div>
                {renderSectionValue('activity')}
            </div>
        </section>
    );
}