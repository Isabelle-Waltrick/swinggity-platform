import { useEffect, useMemo, useState } from 'react';
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
    const { user, updateProfile } = useAuth();

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

    const [profileData, setProfileData] = useState({
        bio: '',
        jamCircle: '',
        interests: '',
        activity: '',
    });
    const [draftData, setDraftData] = useState(profileData);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        const nextProfileData = {
            bio: user?.bio ?? '',
            jamCircle: user?.jamCircle ?? '',
            interests: user?.interests ?? '',
            activity: user?.activity ?? '',
        };
        setProfileData(nextProfileData);
        setDraftData(nextProfileData);
    }, [user]);

    const startEditing = () => {
        setSaveError('');
        setDraftData(profileData);
        setIsEditing(true);
    };

    const saveProfile = async () => {
        setIsSaving(true);
        setSaveError('');

        const payload = {
            bio: draftData.bio.trim(),
            jamCircle: draftData.jamCircle.trim(),
            interests: draftData.interests.trim(),
            activity: draftData.activity.trim(),
        };

        try {
            const updatedUser = await updateProfile(payload);
            setProfileData({
                bio: updatedUser?.bio ?? '',
                jamCircle: updatedUser?.jamCircle ?? '',
                interests: updatedUser?.interests ?? '',
                activity: updatedUser?.activity ?? '',
            });
            setIsEditing(false);
        } catch (error) {
            setSaveError(error.message || 'Unable to save profile changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const cancelEditing = () => {
        setSaveError('');
        setDraftData(profileData);
        setIsEditing(false);
    };

    const handleDraftChange = (field, value) => {
        setDraftData((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const renderSectionValue = (key) => {
        if (isEditing) {
            return (
                <textarea
                    className="profile-textarea"
                    value={draftData[key]}
                    onChange={(event) => handleDraftChange(key, event.target.value)}
                    rows={key === 'bio' ? 3 : 4}
                    placeholder={PLACEHOLDERS[key]}
                />
            );
        }

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
                    <div className="profile-avatar" aria-hidden="true">{initials}</div>
                    <button type="button" className="edit-icon-btn avatar-edit" onClick={startEditing} aria-label="Edit profile">
                        <img src={editIcon} alt="" />
                    </button>
                </div>

                <div className="profile-header-copy">
                    <h1>{userName}</h1>
                    <div className="profile-heading-row">
                        {renderSectionValue('bio')}
                        <button type="button" className="edit-icon-btn" onClick={startEditing} aria-label="Edit bio">
                            <img src={editIcon} alt="" />
                        </button>
                    </div>
                </div>
            </header>

            {isEditing && (
                <div className="profile-actions">
                    <button type="button" className="profile-btn profile-btn-save" onClick={saveProfile} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button type="button" className="profile-btn profile-btn-cancel" onClick={cancelEditing} disabled={isSaving}>Cancel</button>
                    {saveError && <p className="profile-save-error">{saveError}</p>}
                </div>
            )}

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Jam Circle</h2>
                    <button type="button" className="edit-icon-btn" onClick={startEditing} aria-label="Edit jam circle">
                        <img src={editIcon} alt="" />
                    </button>
                </div>
                {renderSectionValue('jamCircle')}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Interests</h2>
                    <button type="button" className="edit-icon-btn" onClick={startEditing} aria-label="Edit interests">
                        <img src={editIcon} alt="" />
                    </button>
                </div>
                {renderSectionValue('interests')}
            </div>

            <div className="profile-section">
                <div className="profile-section-heading">
                    <h2>Your Activity</h2>
                    <button type="button" className="edit-icon-btn" onClick={startEditing} aria-label="Edit activity">
                        <img src={editIcon} alt="" />
                    </button>
                </div>
                {renderSectionValue('activity')}
            </div>
        </section>
    );
}