import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import editIcon from '../../../assets/edit.svg';
import editSquaredIcon from '../../../assets/edit-squared.svg';
import { RecycleBin } from '../../calendar/components/RecycleBin';
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
    'Switch',
    'Benny Goodman',
    'West Coast Swing',
];

const PRIVACY_OPTIONS = [
    { value: 'anyone', label: 'Anyone on Swinggity' },
    { value: 'circle', label: 'Members who are part of my circle' },
    { value: 'mutual', label: 'Members with contacts in common' },
    { value: 'nobody', label: 'Nobody' },
];

const PRONOUN_OPTIONS = [
    { value: '', label: 'Select pronouns' },
    { value: 'she/her', label: 'she/her' },
    { value: 'he/him', label: 'he/him' },
    { value: 'they/them', label: 'they/them' },
    { value: 'other', label: 'other' },
];

const PRESET_PRONOUN_VALUES = new Set(PRONOUN_OPTIONS.map((option) => option.value));

const extractInitialPronouns = (user) => {
    const userPronouns = (user?.pronouns || '').trim();

    if (!userPronouns) {
        return { pronouns: '', customPronouns: '' };
    }

    if (PRESET_PRONOUN_VALUES.has(userPronouns)) {
        return { pronouns: userPronouns, customPronouns: '' };
    }

    return { pronouns: 'other', customPronouns: userPronouns };
};

const normalizeCustomPronouns = (value) => value
    .split('/')
    .map((part) => part.trim())
    .join('/');

const isValidCustomPronounsFormat = (value) => /^\s*[^/]+\s*\/\s*[^/]+\s*$/.test(value);

const PRIVACY_LABELS = {
    privacyMembers: 'Who can find you on the "Members" section?',
    privacyContact: 'Who can "Contact" you?',
    privacyBio: 'Who can view your "Brief Bio"?',
    privacyPosts: 'Who can view your "Posts"?',
    privacyTags: 'Who can view your "Tags"?',
    privacySocialLinks: 'Who can view your "Social Links"?',
};

const ROLE_LABELS = {
    regular: 'Regular user',
    organiser: 'Organiser',
    admin: 'Admin',
};

const REGULAR_USER_HELP_TEXT = 'As a regular user you have access to most features in the platform, with the exception of post events in the Calendar. Do you organise events? Please send us an email to swinggity.team@gmail.com to request access to post on our Calendar.';

const resolveOrganisationImageUrl = (apiUrl, rawUrl) => {
    const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
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

    if (/^\/uploads\/avatars\/[A-Za-z0-9._/-]+$/.test(normalized)) {
        return `${apiUrl}${normalized}`;
    }

    return '';
};

const getInitialFormState = (user) => ({
    ...extractInitialPronouns(user),
    displayFirstName: user?.displayFirstName ?? user?.firstName ?? '',
    displayLastName: user?.displayLastName ?? user?.lastName ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    bio: user?.bio ?? '',
    role: user?.role ?? 'regular',
    contactEmail: user?.contactEmail ?? user?.email ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    instagram: user?.instagram ?? '',
    facebook: user?.facebook ?? '',
    youtube: user?.youtube ?? '',
    linkedin: user?.linkedin ?? '',
    website: user?.website ?? '',
    profileTags: Array.isArray(user?.profileTags) ? user.profileTags : [],
    privacyMembers: user?.privacyMembers ?? 'anyone',
    privacyContact: user?.privacyContact ?? 'anyone',
    privacyBio: user?.privacyBio ?? 'anyone',
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
    const [openPrivacyField, setOpenPrivacyField] = useState('');
    const [isPronounsDropdownOpen, setIsPronounsDropdownOpen] = useState(false);
    const [organisation, setOrganisation] = useState(null);
    const [organisationMembershipType, setOrganisationMembershipType] = useState('none');
    const [isLoadingOrganisation, setIsLoadingOrganisation] = useState(false);
    const [isDeleteOrganisationPopupOpen, setIsDeleteOrganisationPopupOpen] = useState(false);
    const [isDeletingOrganisation, setIsDeletingOrganisation] = useState(false);
    const [isLeavingOrganisation, setIsLeavingOrganisation] = useState(false);
    const privacyDropdownAreaRef = useRef(null);
    const pronounsDropdownAreaRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const initials = useMemo(() => {
        const first = (formData.displayFirstName || formData.displayLastName || 'N')[0] || 'N';
        const last = (formData.displayLastName || '')[0] || '';
        return `${first}${last}`.toUpperCase();
    }, [formData.displayFirstName, formData.displayLastName]);

    const roleLabel = ROLE_LABELS[formData.role] ?? 'Regular user';
    const normalizedUserRole = String(formData.role || '').trim().toLowerCase();
    const canManageOrganisation = normalizedUserRole === 'organiser' || normalizedUserRole === 'admin';

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

    useEffect(() => {
        const handleDocumentClick = (event) => {
            if (!privacyDropdownAreaRef.current?.contains(event.target)) {
                setOpenPrivacyField('');
            }

            if (!pronounsDropdownAreaRef.current?.contains(event.target)) {
                setIsPronounsDropdownOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setOpenPrivacyField('');
                setIsPronounsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    useEffect(() => {
        if (!canManageOrganisation) {
            setOrganisation(null);
            setOrganisationMembershipType('none');
            return;
        }

        let isCancelled = false;

        const loadOrganisation = async () => {
            setIsLoadingOrganisation(true);

            try {
                const response = await fetch(`${API_URL}/api/organisation/me/summary`, {
                    credentials: 'include',
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Unable to load organisation.');
                }

                if (isCancelled) return;

                setOrganisation(data.organisation || null);
                setOrganisationMembershipType(String(data.membershipType || 'none'));
            } catch {
                if (isCancelled) return;
                setOrganisation(null);
                setOrganisationMembershipType('none');
            } finally {
                if (!isCancelled) {
                    setIsLoadingOrganisation(false);
                }
            }
        };

        loadOrganisation();

        return () => {
            isCancelled = true;
        };
    }, [API_URL, canManageOrganisation]);

    useEffect(() => {
        if (!isDeleteOrganisationPopupOpen) return undefined;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEscape = (event) => {
            if (event.key === 'Escape' && !isDeletingOrganisation) {
                setIsDeleteOrganisationPopupOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isDeleteOrganisationPopupOpen, isDeletingOrganisation]);

    const getPrivacyLabelForValue = (value) => {
        const match = PRIVACY_OPTIONS.find((option) => option.value === value);
        return match?.label || PRIVACY_OPTIONS[0].label;
    };

    const handlePrivacyOptionSelect = (field, value) => {
        setFormData((current) => ({
            ...current,
            [field]: value,
        }));
        setOpenPrivacyField('');
    };

    const getPronounLabelForValue = (value) => {
        const match = PRONOUN_OPTIONS.find((option) => option.value === value);
        return match?.label || PRONOUN_OPTIONS[0].label;
    };

    const handlePronounsOptionSelect = (value) => {
        setFormData((current) => ({
            ...current,
            pronouns: value,
        }));
        setIsPronounsDropdownOpen(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setSaveError('');

        const payload = { ...formData };

        if (payload.pronouns === 'other') {
            if (!isValidCustomPronounsFormat(payload.customPronouns)) {
                setSaveError('Please enter custom pronouns in the format "x/y".');
                setIsSaving(false);
                return;
            }

            payload.pronouns = normalizeCustomPronouns(payload.customPronouns);
        }

        delete payload.customPronouns;

        try {
            await updateProfile(payload);
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

    const handleDeleteOrganisation = async () => {
        if (isDeletingOrganisation) return;

        setIsDeletingOrganisation(true);
        setSaveError('');

        try {
            const response = await fetch(`${API_URL}/api/organisation/me`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete organisation page.');
            }

            setOrganisation(null);
            setIsDeleteOrganisationPopupOpen(false);
        } catch (error) {
            setSaveError(error.message || 'Unable to delete organisation page.');
        } finally {
            setIsDeletingOrganisation(false);
        }
    };

    const handleLeaveOrganisation = async () => {
        if (isLeavingOrganisation) return;

        setIsLeavingOrganisation(true);
        setSaveError('');

        try {
            const response = await fetch(`${API_URL}/api/organisation/me/leave`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to leave organisation.');
            }

            setOrganisation(null);
            setOrganisationMembershipType('none');
        } catch (error) {
            setSaveError(error.message || 'Unable to leave organisation.');
        } finally {
            setIsLeavingOrganisation(false);
        }
    };

    const avatarSrc = formData.avatarUrl
        ? (formData.avatarUrl.startsWith('http') ? formData.avatarUrl : `${API_URL}${formData.avatarUrl}`)
        : '';
    const organisationImageSrc = useMemo(
        () => resolveOrganisationImageUrl(API_URL, organisation?.imageUrl),
        [API_URL, organisation?.imageUrl]
    );

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
                            <span className="field-title-with-help">
                                <span>Role</span>
                                {roleLabel === 'Regular user' && (
                                    <span className="help-icon-wrap">
                                        <button
                                            type="button"
                                            className="help-icon"
                                            aria-label={REGULAR_USER_HELP_TEXT}
                                        >
                                            ?
                                        </button>
                                        <span className="help-tooltip" role="tooltip">{REGULAR_USER_HELP_TEXT}</span>
                                    </span>
                                )}
                            </span>
                            <input value={roleLabel} readOnly aria-readonly="true" />
                        </label>
                        <label>
                            <span>Pronouns</span>
                            <div className={`privacy-dropdown-control ${isPronounsDropdownOpen ? 'open' : ''}`} ref={pronounsDropdownAreaRef}>
                                <button
                                    type="button"
                                    className="privacy-dropdown-trigger"
                                    onClick={() => {
                                        setIsPronounsDropdownOpen((current) => !current);
                                    }}
                                    aria-expanded={isPronounsDropdownOpen}
                                    aria-haspopup="listbox"
                                    aria-controls="pronouns-options"
                                >
                                    <span>{getPronounLabelForValue(formData.pronouns)}</span>
                                    <span className="privacy-dropdown-caret">▾</span>
                                </button>

                                {isPronounsDropdownOpen ? (
                                    <div id="pronouns-options" className="privacy-dropdown-panel" role="listbox" aria-label="Pronouns">
                                        {PRONOUN_OPTIONS.map((option) => {
                                            const isActive = formData.pronouns === option.value;
                                            return (
                                                <button
                                                    key={option.value || 'empty'}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isActive}
                                                    className={`privacy-dropdown-option ${isActive ? 'active' : ''}`}
                                                    onMouseDown={(mouseEvent) => {
                                                        mouseEvent.preventDefault();
                                                        handlePronounsOptionSelect(option.value);
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}

                                {formData.pronouns === 'other' ? (
                                    <div className="pronouns-custom-input-wrap">
                                        <input
                                            value={formData.customPronouns}
                                            onChange={handleInput('customPronouns')}
                                            placeholder="e.g. ze/zir"
                                            aria-label="Custom pronouns"
                                        />
                                        <p className="pronouns-custom-hint">Use the format x/y.</p>
                                    </div>
                                ) : null}
                            </div>
                        </label>
                    </div>
                </section>

                {canManageOrganisation ? (
                    <section className="edit-block">
                        <h2>Organisation</h2>
                        {isLoadingOrganisation ? <p className="edit-hint">Loading organisation...</p> : null}
                        {!isLoadingOrganisation && organisation ? (
                            <div className="organisation-summary-card">
                                <div className="organisation-summary-meta">
                                    <div className="organisation-summary-image-wrap" aria-hidden="true">
                                        {organisationImageSrc ? (
                                            <span
                                                className="organisation-summary-image"
                                                style={{ backgroundImage: `url('${organisationImageSrc}')` }}
                                            ></span>
                                        ) : (
                                            <span className="organisation-summary-initial">{String(organisation.organisationName || 'O')[0]?.toUpperCase() || 'O'}</span>
                                        )}
                                    </div>
                                    <p className="organisation-summary-name">{organisation.organisationName || 'Untitled organisation'}</p>
                                </div>

                                {organisationMembershipType === 'owner' ? (
                                    <div className="event-manage-actions">
                                        <button
                                            className="btn-edit"
                                            type="button"
                                            onClick={() => navigate('/dashboard/profile/organisation/edit')}
                                        >
                                            <img src={editSquaredIcon} alt="" className="btn-edit-icon" />
                                            <span>Edit</span>
                                        </button>
                                        <button
                                            className="btn-delete"
                                            type="button"
                                            onClick={() => setIsDeleteOrganisationPopupOpen(true)}
                                            disabled={isDeletingOrganisation}
                                        >
                                            <RecycleBin />
                                            <span>{isDeletingOrganisation ? 'Deleting...' : 'Delete'}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="event-manage-actions">
                                        <button
                                            className="btn-delete"
                                            type="button"
                                            onClick={handleLeaveOrganisation}
                                            disabled={isLeavingOrganisation}
                                        >
                                            <span>{isLeavingOrganisation ? 'Leaving...' : 'Leave'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {!isLoadingOrganisation && !organisation ? (
                            <button
                                type="button"
                                className="pill-button organisation-button"
                                onClick={() => navigate('/dashboard/profile/organisation/edit')}
                            >
                                Create Organisation page
                            </button>
                        ) : null}
                    </section>
                ) : null}

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
                        <label>
                            <span>Website</span>
                            <input value={formData.website} onChange={handleInput('website')} />
                        </label>
                    </div>
                </section>

                <section className="edit-block">
                    <h2>Privacy</h2>
                    <p className="edit-hint">Control who can contact you and the information others can see on your profile.</p>
                    <div className="edit-grid two-columns privacy-grid" ref={privacyDropdownAreaRef}>
                        {Object.entries(PRIVACY_LABELS).map(([field, label]) => (
                            <div key={field} className="privacy-field">
                                <span>{label}</span>
                                <div className={`privacy-dropdown-control ${openPrivacyField === field ? 'open' : ''}`}>
                                    <button
                                        type="button"
                                        className="privacy-dropdown-trigger"
                                        onClick={() => {
                                            setOpenPrivacyField((current) => (current === field ? '' : field));
                                        }}
                                        aria-expanded={openPrivacyField === field}
                                        aria-haspopup="listbox"
                                        aria-controls={`privacy-options-${field}`}
                                    >
                                        <span>{getPrivacyLabelForValue(formData[field])}</span>
                                        <span className="privacy-dropdown-caret">▾</span>
                                    </button>

                                    {openPrivacyField === field ? (
                                        <div id={`privacy-options-${field}`} className="privacy-dropdown-panel" role="listbox" aria-label={label}>
                                            {PRIVACY_OPTIONS.map((option) => {
                                                const isActive = formData[field] === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={isActive}
                                                        className={`privacy-dropdown-option ${isActive ? 'active' : ''}`}
                                                        onMouseDown={(mouseEvent) => {
                                                            mouseEvent.preventDefault();
                                                            handlePrivacyOptionSelect(field, option.value);
                                                        }}
                                                    >
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
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

            {isDeleteOrganisationPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={() => {
                    if (!isDeletingOrganisation) {
                        setIsDeleteOrganisationPopupOpen(false);
                    }
                }}>
                    <div
                        className="contact-popup delete-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-organisation-popup-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="delete-organisation-popup-title" className="delete-popup-title">
                            Are you sure you want to delete this organisation? This Action can not be undone
                        </h2>

                        <div className="delete-popup-actions">
                            <button
                                type="button"
                                className="delete-popup-confirm"
                                onClick={handleDeleteOrganisation}
                                disabled={isDeletingOrganisation}
                            >
                                {isDeletingOrganisation ? 'Deleting...' : 'Delete Organisation'}
                            </button>
                            <button
                                type="button"
                                className="delete-popup-cancel"
                                onClick={() => setIsDeleteOrganisationPopupOpen(false)}
                                disabled={isDeletingOrganisation}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
