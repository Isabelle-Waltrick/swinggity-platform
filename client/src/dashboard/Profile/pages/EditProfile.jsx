import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import editIcon from '../../../assets/edit.svg';
import TagInput from '../../../components/TagInput/TagInput';
import './EditProfile.css';

const SUGGESTED_TAGS = [
    'Artie Shaw',
    'Lindy Hop',
    'Swing Patrol',
    'Collegiate Shag',
    'Solo Jazz',
    'Festivals',
    'Leader',
    'Balboa',
    'Ella Fitzgerald',
    'Follower',
    'Blues',
    'Charleston',
    'Big Band',
    'Social Dancing',
    'Workshops',
    'Live Music',
    'Vintage Style',
    'Count Basie',
    'Benny Goodman',
    'West Coast Swing',
];

const PRIVACY_OPTIONS = [
    { value: 'anyone', label: 'Anyone on Swinggity' },
    { value: 'circle', label: 'Members who are part of my circle' },
    { value: 'mutual', label: 'Members with contacts in common' },
    { value: 'nobody', label: 'Nobody' },
];

const PRIVACY_LABELS = {
    privacyMembers: 'Who can find you on the "Members" section?',
    privacyContact: 'Who can "Contact" you?',
    privacyBio: 'Who can view your "Brief Bio"?',
    privacyLocation: 'Who can view your "Location"?',
    privacyPosts: 'Who can view your "Posts"?',
    privacyTags: 'Who can view your "Tags"?',
    privacySocialLinks: 'Who can view your "Social Links"?',
};

const getInitialFormState = (user) => ({
    displayFirstName: user?.displayFirstName ?? user?.firstName ?? '',
    displayLastName: user?.displayLastName ?? user?.lastName ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    bio: user?.bio ?? '',
    location: user?.location ?? '',
    pronouns: user?.pronouns ?? '',
    contactEmail: user?.contactEmail ?? user?.email ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    instagram: user?.instagram ?? '',
    facebook: user?.facebook ?? '',
    youtube: user?.youtube ?? '',
    linkedin: user?.linkedin ?? '',
    profileTags: Array.isArray(user?.profileTags) ? user.profileTags : [],
    privacyMembers: user?.privacyMembers ?? 'anyone',
    privacyContact: user?.privacyContact ?? 'anyone',
    privacyBio: user?.privacyBio ?? 'anyone',
    privacyLocation: user?.privacyLocation ?? 'anyone',
    privacyPosts: user?.privacyPosts ?? 'anyone',
    privacyTags: user?.privacyTags ?? 'anyone',
    privacySocialLinks: user?.privacySocialLinks ?? 'anyone',
});

export default function EditProfilePage() {
    const { user, updateProfile, uploadAvatar, removeAvatar } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState(getInitialFormState(user));
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [saveError, setSaveError] = useState('');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const initials = useMemo(() => {
        const first = (formData.displayFirstName || formData.displayLastName || 'N')[0] || 'N';
        const last = (formData.displayLastName || '')[0] || '';
        return `${first}${last}`.toUpperCase();
    }, [formData.displayFirstName, formData.displayLastName]);

    const handleInput = (field) => (event) => {
        setFormData((current) => ({
            ...current,
            [field]: event.target.value,
        }));
    };

    const handleTagsChange = (newTags) => {
        setFormData((current) => ({
            ...current,
            profileTags: newTags,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setSaveError('');

        try {
            await updateProfile(formData);
            navigate('/dashboard/profile');
        } catch (error) {
            setSaveError(error.message || 'Unable to save profile changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        navigate('/dashboard/profile');
    };

    const avatarSrc = formData.avatarUrl
        ? (formData.avatarUrl.startsWith('http') ? formData.avatarUrl : `${API_URL}${formData.avatarUrl}`)
        : '';

    const triggerAvatarPicker = () => {
        if (isUploadingAvatar) return;
        fileInputRef.current?.click();
    };

    const handleAvatarFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSaveError('');
        setIsUploadingAvatar(true);

        try {
            const updatedUser = await uploadAvatar(file);
            setFormData((current) => ({
                ...current,
                avatarUrl: updatedUser?.avatarUrl ?? current.avatarUrl,
            }));
        } catch (error) {
            setSaveError(error.message || 'Unable to upload avatar.');
        } finally {
            setIsUploadingAvatar(false);
            event.target.value = '';
        }
    };

    const handleRemoveAvatar = async () => {
        setSaveError('');
        setIsUploadingAvatar(true);

        try {
            const updatedUser = await removeAvatar();
            setFormData((current) => ({
                ...current,
                avatarUrl: updatedUser?.avatarUrl ?? '',
            }));
        } catch (error) {
            setSaveError(error.message || 'Unable to remove avatar.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    return (
        <section className="edit-profile-page" aria-label="Edit profile">
            <form className="edit-profile-form" onSubmit={handleSubmit}>
                <h1>Edit profile</h1>

                <div className="edit-avatar-row">
                    <div className="edit-avatar">
                        {avatarSrc ? <img className="edit-avatar-image" src={avatarSrc} alt="Profile avatar" /> : initials}
                    </div>
                    <button type="button" className="edit-avatar-btn" aria-label="Edit profile picture" onClick={triggerAvatarPicker} disabled={isUploadingAvatar}>
                        <img src={editIcon} alt="" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="avatar-file-input"
                        onChange={handleAvatarFileChange}
                    />
                    {isUploadingAvatar && <p className="avatar-upload-status">Uploading avatar...</p>}
                </div>

                <div className="avatar-controls">
                    {formData.avatarUrl && (
                        <button type="button" className="avatar-remove-button" onClick={handleRemoveAvatar} disabled={isUploadingAvatar}>
                            Remove photo
                        </button>
                    )}
                </div>

                <section className="edit-block">
                    <h2>Basic Info</h2>
                    <div className="edit-grid two-columns">
                        <label>
                            <span>First Name</span>
                            <input value={formData.displayFirstName} onChange={handleInput('displayFirstName')} />
                        </label>
                        <label>
                            <span>Last Name</span>
                            <input value={formData.displayLastName} onChange={handleInput('displayLastName')} />
                        </label>
                    </div>
                    <label className="full-width">
                        <span>Brief Bio</span>
                        <textarea rows={4} value={formData.bio} onChange={handleInput('bio')} />
                    </label>
                    <div className="edit-grid two-columns">
                        <label>
                            <span>Location</span>
                            <input placeholder="Search by cities / countries" value={formData.location} onChange={handleInput('location')} />
                        </label>
                        <label>
                            <span>Pronouns</span>
                            <select value={formData.pronouns} onChange={handleInput('pronouns')}>
                                <option value="">Select pronouns</option>
                                <option value="she/her">she/her</option>
                                <option value="he/him">he/him</option>
                                <option value="they/them">they/them</option>
                                <option value="other">other</option>
                            </select>
                        </label>
                    </div>
                </section>

                <section className="edit-block">
                    <h2>Contact</h2>
                    <p className="edit-hint">Your contact information is always private to you. You may want to add this information to be able to share it when contacting other members of Swinggity.</p>
                    <div className="edit-grid two-columns">
                        <label>
                            <span>Email</span>
                            <input type="email" value={formData.contactEmail} onChange={handleInput('contactEmail')} />
                        </label>
                        <label>
                            <span>Phone Number</span>
                            <input value={formData.phoneNumber} onChange={handleInput('phoneNumber')} />
                        </label>
                    </div>
                </section>

                <section className="edit-block">
                    <h2>Profile tags</h2>
                    <p className="edit-hint">Search for interests, music, dance style, preferred roles ...</p>
                    <TagInput
                        selectedTags={formData.profileTags}
                        onTagsChange={handleTagsChange}
                        suggestedTags={SUGGESTED_TAGS}
                        maxTags={20}
                        placeholder="Type to search..."
                    />
                </section>

                <section className="edit-block">
                    <h2>Social links</h2>
                    <div className="edit-grid two-columns">
                        <label>
                            <span>Instagram</span>
                            <input value={formData.instagram} onChange={handleInput('instagram')} />
                        </label>
                        <label>
                            <span>Facebook</span>
                            <input value={formData.facebook} onChange={handleInput('facebook')} />
                        </label>
                        <label>
                            <span>Youtube</span>
                            <input value={formData.youtube} onChange={handleInput('youtube')} />
                        </label>
                        <label>
                            <span>LinkedIn</span>
                            <input value={formData.linkedin} onChange={handleInput('linkedin')} />
                        </label>
                    </div>
                </section>

                <section className="edit-block">
                    <h2>Privacy</h2>
                    <p className="edit-hint">Control who can contact you and the information others can see on your profile.</p>
                    <div className="edit-grid two-columns">
                        {Object.entries(PRIVACY_LABELS).map(([field, label]) => (
                            <label key={field}>
                                <span>{label}</span>
                                <select value={formData[field]} onChange={handleInput(field)}>
                                    {PRIVACY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        ))}
                    </div>
                </section>

                <section className="edit-block">
                    <h2>Change password</h2>
                    <button type="button" className="pill-button" onClick={() => navigate('/forgot-password')}>Send me a reset Link</button>
                </section>

                <section className="edit-block danger-zone">
                    <h2>Danger Zone</h2>
                    <p className="edit-hint">Delete your account and account data. This can't be undone!</p>
                    <button type="button" className="danger-button">Delete Account</button>
                </section>

                {saveError && <p className="save-error">{saveError}</p>}

                <div className="edit-actions">
                    <button type="button" className="cancel-button" onClick={handleCancel}>Cancel</button>
                    <button type="submit" className="save-button" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save changes'}</button>
                </div>
            </form>
        </section>
    );
}
