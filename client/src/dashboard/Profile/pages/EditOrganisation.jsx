import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import editIcon from '../../../assets/edit.svg';
import './EditProfile.css';

const getInitialOrganisationFormState = () => ({
    organisationName: '',
    imageUrl: '',
    bio: '',
    instagram: '',
    facebook: '',
    youtube: '',
    linkedin: '',
    participants: '',
});

const getTrustedImageUrl = (rawImageUrl, apiUrl) => {
    const normalized = typeof rawImageUrl === 'string' ? rawImageUrl.trim() : '';
    if (!normalized) return '';

    if (/^https?:\/\//i.test(normalized)) {
        try {
            const parsed = new URL(normalized);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.toString();
            }
            return '';
        } catch {
            return '';
        }
    }

    if (/^\/uploads\/avatars\//.test(normalized)) {
        return `${apiUrl}${normalized}`;
    }

    return '';
};

export default function EditOrganisationPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const [formData, setFormData] = useState(getInitialOrganisationFormState());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [hasOrganisation, setHasOrganisation] = useState(false);
    const fileInputRef = useRef(null);

    const role = String(user?.role || '').trim().toLowerCase();
    const canManageOrganisation = role === 'organiser' || role === 'admin';

    useEffect(() => {
        const loadOrganisation = async () => {
            if (!canManageOrganisation) {
                setSaveError('Only organisers can manage organisation pages.');
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/organisation/me`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load organisation page.');
                }

                const organisation = data.organisation;
                if (organisation) {
                    setHasOrganisation(true);
                    setFormData({
                        organisationName: organisation.organisationName || '',
                        imageUrl: organisation.imageUrl || '',
                        bio: organisation.bio || '',
                        instagram: organisation.instagram || '',
                        facebook: organisation.facebook || '',
                        youtube: organisation.youtube || '',
                        linkedin: organisation.linkedin || '',
                        participants: organisation.participants || '',
                    });
                }
            } catch (error) {
                setSaveError(error.message || 'Unable to load organisation page.');
            } finally {
                setIsLoading(false);
            }
        };

        loadOrganisation();
    }, [API_URL, canManageOrganisation]);

    const handleInput = (field) => (event) => {
        setFormData((current) => ({
            ...current,
            [field]: event.target.value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!canManageOrganisation) {
            setSaveError('Only organisers can manage organisation pages.');
            return;
        }

        if (!formData.organisationName.trim()) {
            setSaveError('Organisation name is required.');
            return;
        }

        setIsSaving(true);
        setSaveError('');

        try {
            const payload = {
                organisationName: formData.organisationName,
                bio: formData.bio,
                instagram: formData.instagram,
                facebook: formData.facebook,
                youtube: formData.youtube,
                linkedin: formData.linkedin,
                participants: formData.participants,
            };

            const response = await fetch(`${API_URL}/api/organisation/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to save organisation page.');
            }

            setHasOrganisation(true);
            if (data.organisation) {
                setFormData((current) => ({
                    ...current,
                    organisationName: data.organisation.organisationName || '',
                    bio: data.organisation.bio || '',
                    instagram: data.organisation.instagram || '',
                    facebook: data.organisation.facebook || '',
                    youtube: data.organisation.youtube || '',
                    linkedin: data.organisation.linkedin || '',
                    participants: data.organisation.participants || '',
                }));
            }
            navigate('/dashboard/profile/edit');
        } catch (error) {
            setSaveError(error.message || 'Unable to save organisation page.');
        } finally {
            setIsSaving(false);
        }
    };

    const triggerImagePicker = () => {
        if (isUploadingImage) return;
        fileInputRef.current?.click();
    };

    const handleImageFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSaveError('');
        setIsUploadingImage(true);

        try {
            const payload = new FormData();
            payload.append('avatar', file);

            const response = await fetch(`${API_URL}/api/organisation/me/image`, {
                method: 'POST',
                credentials: 'include',
                body: payload,
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to upload organisation image.');
            }

            setHasOrganisation(true);
            setFormData((current) => ({
                ...current,
                imageUrl: data.organisation?.imageUrl || current.imageUrl,
            }));
        } catch (error) {
            setSaveError(error.message || 'Unable to upload organisation image.');
        } finally {
            setIsUploadingImage(false);
            event.target.value = '';
        }
    };

    const handleRemoveImage = async () => {
        setSaveError('');
        setIsUploadingImage(true);

        try {
            const response = await fetch(`${API_URL}/api/organisation/me/image`, {
                method: 'DELETE',
                credentials: 'include',
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to remove organisation image.');
            }

            setFormData((current) => ({
                ...current,
                imageUrl: '',
            }));
        } catch (error) {
            setSaveError(error.message || 'Unable to remove organisation image.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const imageInitials = useMemo(() => {
        const first = (formData.organisationName || 'O')[0] || 'O';
        return first.toUpperCase();
    }, [formData.organisationName]);

    const imageSrc = getTrustedImageUrl(formData.imageUrl, API_URL);

    if (isLoading) {
        return (
            <section className="edit-profile-page" aria-label="Edit organisation">
                <p className="edit-hint">Loading organisation page...</p>
            </section>
        );
    }

    return (
        <section className="edit-profile-page" aria-label="Edit organisation">
            <form className="edit-profile-form" onSubmit={handleSubmit}>
                <h1>{hasOrganisation ? 'Edit organisation' : 'Create organisation page'}</h1>

                <div className="edit-avatar-row">
                    <div className="edit-avatar">
                        {imageSrc ? <img className="edit-avatar-image" src={imageSrc} alt="Organisation image" /> : imageInitials}
                    </div>
                    <button
                        type="button"
                        className="edit-avatar-btn"
                        aria-label="Edit organisation image"
                        onClick={triggerImagePicker}
                        disabled={isUploadingImage}
                    >
                        <img src={editIcon} alt="" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="avatar-file-input"
                        onChange={handleImageFileChange}
                    />
                    {isUploadingImage && <p className="avatar-upload-status">Uploading image...</p>}
                </div>

                <div className="avatar-controls">
                    {formData.imageUrl ? (
                        <button type="button" className="avatar-remove-button" onClick={handleRemoveImage} disabled={isUploadingImage}>
                            Remove image
                        </button>
                    ) : null}
                </div>

                <section className="edit-block">
                    <h2>Organisation</h2>
                    <div className="edit-grid two-columns">
                        <label>
                            <span>Organisation name</span>
                            <input value={formData.organisationName} onChange={handleInput('organisationName')} />
                        </label>
                    </div>
                    <label className="full-width">
                        <span>Brief Bio</span>
                        <textarea rows={4} value={formData.bio} onChange={handleInput('bio')} />
                    </label>
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
                    <h2>Participants</h2>
                    <p className="edit-hint">
                        You are automatically included as the main contact. Add more users who can be contacted regarding your organisation.
                    </p>
                    <label className="full-width">
                        <span>Add participants</span>
                        <input
                            type="text"
                            value={formData.participants}
                            onChange={handleInput('participants')}
                            placeholder="Search by name or email"
                        />
                    </label>
                    <p className="edit-hint">Participants can accept or decline once your organisation page is shared.</p>
                </section>

                {saveError && <p className="save-error">{saveError}</p>}

                <div className="edit-actions">
                    <button type="button" className="cancel-button" onClick={() => navigate('/dashboard/profile/edit')}>Cancel</button>
                    <button type="submit" className="save-button" disabled={isSaving || isUploadingImage}>
                        {isSaving ? 'Saving...' : (hasOrganisation ? 'Save changes' : 'Create organisation page')}
                    </button>
                </div>
            </form>
        </section>
    );
}
