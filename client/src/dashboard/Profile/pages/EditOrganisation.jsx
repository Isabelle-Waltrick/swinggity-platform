import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import ProfileAvatar from '../../../components/ProfileAvatar';
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
    website: '',
});

const splitNameParts = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || 'Swinggity';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'Member';
    return { firstName, lastName };
};

const getDiscoverableName = (entry) => {
    if (!entry || typeof entry !== 'object') return '';
    if (entry.entityType === 'organisation') {
        return String(entry.displayFirstName || '').trim() || 'Swinggity Organisation';
    }

    const first = String(entry.displayFirstName || '').trim();
    const last = String(entry.displayLastName || '').trim();
    return `${first} ${last}`.trim() || 'Swinggity Member';
};

const buildParticipantKey = (entry) => {
    const userId = String(entry?.userId || entry?.user || '').trim();
    const entityType = entry?.entityType === 'organisation' ? 'organisation' : 'member';
    const organisationId = String(entry?.organisationId || '').trim();
    return `${userId}|${entityType}|${organisationId}`;
};

const normalizeParticipantEntry = (entry) => {
    const entityType = entry?.entityType === 'organisation' ? 'organisation' : 'member';
    const userId = String(entry?.userId || entry?.user || '').trim();
    const organisationId = String(entry?.organisationId || '').trim();
    const displayName = String(entry?.displayName || '').trim();
    const avatarUrl = String(entry?.avatarUrl || '').trim();
    const inviteStatus = String(entry?.inviteStatus || '').trim().toLowerCase() === 'pending' ? 'pending' : 'accepted';
    const profileId = entityType === 'organisation'
        ? organisationId
        : userId;

    if (!userId || !displayName) return null;

    return {
        userId,
        entityType,
        organisationId,
        displayName,
        avatarUrl,
        inviteStatus,
        profileId,
        key: `${userId}|${entityType}|${organisationId}`,
    };
};

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

const isEligibleParticipantRole = (role) => {
    const normalizedRole = String(role || '').trim().toLowerCase();
    return normalizedRole === 'organiser' || normalizedRole === 'organizer';
};

const validateSocialMediaUrl = (url, platform) => {
    const trimmed = typeof url === 'string' ? url.trim() : '';
    if (!trimmed) return true; // Empty is valid (optional field)

    const patterns = {
        instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/[\w.]+\/?$/i,
        facebook: /^(https?:\/\/)?(www\.)?facebook\.com\/[\w./-]+\/?$/i,
        youtube: /^(https?:\/\/)?(www\.)?youtube\.com\/(c\/|@)?[\w-]+\/?$/i,
        linkedin: /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i,
        website: /^(https?:\/\/)?(www\.)?[\w.-]+\.[a-z]{2,}\/?/i,
    };

    const pattern = patterns[platform];
    if (!pattern) return false;

    return pattern.test(trimmed);
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
    const [participantContacts, setParticipantContacts] = useState([]);
    const [participantCandidates, setParticipantCandidates] = useState([]);
    const [participantQuery, setParticipantQuery] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [isParticipantOpen, setIsParticipantOpen] = useState(false);
    const fileInputRef = useRef(null);
    const participantRef = useRef(null);

    const role = String(user?.role || '').trim().toLowerCase();
    const canManageOrganisation = role === 'organiser' || role === 'organizer';

    const ownerContact = useMemo(() => {
        const first = String(user?.displayFirstName || user?.firstName || '').trim();
        const last = String(user?.displayLastName || user?.lastName || '').trim();
        const displayName = `${first} ${last}`.trim() || String(user?.email || '').trim() || 'Main contact';
        const userId = String(user?._id || '').trim();

        return {
            key: `${userId}|member|`,
            userId,
            entityType: 'member',
            organisationId: '',
            displayName,
            avatarUrl: String(user?.avatarUrl || '').trim(),
            profileId: userId,
            isOwner: true,
        };
    }, [user?._id, user?.avatarUrl, user?.displayFirstName, user?.displayLastName, user?.email, user?.firstName, user?.lastName]);

    const allParticipantContacts = useMemo(() => {
        const dedupe = new Map();

        if (ownerContact.userId) {
            dedupe.set(ownerContact.key, ownerContact);
        }

        for (const entry of participantContacts) {
            const normalized = normalizeParticipantEntry(entry);
            if (!normalized || normalized.key === ownerContact.key) continue;
            dedupe.set(normalized.key, {
                ...normalized,
                isOwner: false,
            });
        }

        return Array.from(dedupe.values());
    }, [ownerContact, participantContacts]);

    const filteredParticipantCandidates = useMemo(() => {
        const selectedKeys = new Set(allParticipantContacts.map((entry) => entry.key));
        if (selectedParticipant?.key) {
            selectedKeys.add(selectedParticipant.key);
        }
        const query = participantQuery.trim().toLowerCase();

        return participantCandidates.filter((entry) => {
            if (entry?.entityType === 'organisation') return false;
            if (!isEligibleParticipantRole(entry?.role)) return false;

            const optionUserId = String(
                entry?.entityType === 'organisation'
                    ? entry?.organisationOwnerUserId
                    : entry?.userId || ''
            ).trim();
            const optionEntityType = entry?.entityType === 'organisation' ? 'organisation' : 'member';
            const optionOrganisationId = String(entry?.organisationId || '').trim();
            const key = `${optionUserId}|${optionEntityType}|${optionOrganisationId}`;

            if (!optionUserId || selectedKeys.has(key)) return false;

            if (!query) return true;

            const name = getDiscoverableName(entry).toLowerCase();
            const email = String(entry?.email || '').trim().toLowerCase();
            return name.includes(query) || email.includes(query);
        });
    }, [allParticipantContacts, participantCandidates, participantQuery, selectedParticipant?.key]);

    const navigateToMemberProfile = (profileId) => {
        const normalized = String(profileId || '').trim();
        if (!normalized) return;
        navigate(`/dashboard/members/${encodeURIComponent(normalized)}`);
    };

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
                        website: organisation.website || '',
                    });

                    const nextParticipants = Array.isArray(organisation.participantContacts)
                        ? [...organisation.participantContacts, ...(Array.isArray(organisation.pendingParticipantContacts) ? organisation.pendingParticipantContacts : [])]
                            .map((entry) => normalizeParticipantEntry(entry))
                            .filter((entry) => entry && entry.key !== ownerContact.key)
                        : [];
                    setParticipantContacts(nextParticipants);
                }
            } catch (error) {
                setSaveError(error.message || 'Unable to load organisation page.');
            } finally {
                setIsLoading(false);
            }
        };

        loadOrganisation();
    }, [API_URL, canManageOrganisation, ownerContact.key]);

    useEffect(() => {
        let isMounted = true;

        const loadParticipantCandidates = async () => {
            try {
                const response = await fetch(`${API_URL}/api/auth/members`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (!response.ok || !data.success || !isMounted) return;

                const members = Array.isArray(data.members) ? data.members : [];
                setParticipantCandidates(
                    members.filter((entry) => {
                        if (entry?.entityType === 'organisation') return false;

                        const userId = String(entry?.userId || '').trim();
                        return Boolean(userId) && isEligibleParticipantRole(entry?.role);
                    })
                );
            } catch {
                if (isMounted) {
                    setParticipantCandidates([]);
                }
            }
        };

        loadParticipantCandidates();

        return () => {
            isMounted = false;
        };
    }, [API_URL]);

    useEffect(() => {
        const handleDocumentMouseDown = (event) => {
            if (participantRef.current && !participantRef.current.contains(event.target)) {
                setIsParticipantOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleDocumentMouseDown);
        };
    }, []);

    const handleInput = (field) => (event) => {
        setFormData((current) => ({
            ...current,
            [field]: event.target.value,
        }));
    };

    const handleParticipantSelect = (entry) => {
        const normalized = {
            userId: String(
                entry?.entityType === 'organisation'
                    ? entry?.organisationOwnerUserId
                    : entry?.userId || ''
            ).trim(),
            entityType: entry?.entityType === 'organisation' ? 'organisation' : 'member',
            organisationId: String(entry?.organisationId || '').trim(),
            displayName: getDiscoverableName(entry),
            avatarUrl: String(entry?.avatarUrl || '').trim(),
            profileId: entry?.entityType === 'organisation'
                ? String(entry?.organisationId || '').trim()
                : String(entry?.userId || '').trim(),
            inviteStatus: 'pending',
        };

        if (!normalized.userId || !normalized.displayName) return;

        const key = buildParticipantKey(normalized);
        if (key === ownerContact.key) {
            setParticipantQuery('');
            setIsParticipantOpen(false);
            return;
        }

        setSelectedParticipant({
            ...normalized,
            key,
        });
        setParticipantQuery(normalized.displayName);
        setIsParticipantOpen(false);
    };

    const clearSelectedParticipant = () => {
        setSelectedParticipant(null);
        setParticipantQuery('');
    };

    const removeParticipant = (contactKey) => {
        const normalizedKey = String(contactKey || '').trim();
        if (!normalizedKey || normalizedKey === ownerContact.key) return;

        setParticipantContacts((previous) => previous.filter((entry) => String(entry?.key || '') !== normalizedKey));
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

        // Validate social media URLs
        if (formData.instagram?.trim() && !validateSocialMediaUrl(formData.instagram, 'instagram')) {
            setSaveError('Please enter a valid Instagram URL (e.g., https://www.instagram.com/username).');
            return;
        }

        if (formData.facebook?.trim() && !validateSocialMediaUrl(formData.facebook, 'facebook')) {
            setSaveError('Please enter a valid Facebook URL (e.g., https://www.facebook.com/page).');
            return;
        }

        if (formData.youtube?.trim() && !validateSocialMediaUrl(formData.youtube, 'youtube')) {
            setSaveError('Please enter a valid YouTube URL (e.g., https://www.youtube.com/channel/name).');
            return;
        }

        if (formData.linkedin?.trim() && !validateSocialMediaUrl(formData.linkedin, 'linkedin')) {
            setSaveError('Please enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/profile).');
            return;
        }

        if (formData.website?.trim() && !validateSocialMediaUrl(formData.website, 'website')) {
            setSaveError('Please enter a valid website URL.');
            return;
        }

        setIsSaving(true);
        setSaveError('');

        try {
            const contactsToSave = [...participantContacts];
            if (selectedParticipant) {
                const selectedKey = String(selectedParticipant.key || buildParticipantKey(selectedParticipant)).trim();
                if (selectedKey && !contactsToSave.some((entry) => String(entry?.key || buildParticipantKey(entry)).trim() === selectedKey)) {
                    contactsToSave.push(selectedParticipant);
                }
            }

            const payload = {
                organisationName: formData.organisationName,
                bio: formData.bio,
                instagram: formData.instagram,
                facebook: formData.facebook,
                youtube: formData.youtube,
                linkedin: formData.linkedin,
                website: formData.website,
                participantContacts: contactsToSave.map((entry) => ({
                    userId: entry.userId,
                    entityType: entry.entityType,
                    organisationId: entry.organisationId,
                    displayName: entry.displayName,
                    avatarUrl: entry.avatarUrl,
                })),
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
                    website: data.organisation.website || '',
                }));

                const nextParticipants = Array.isArray(data.organisation.participantContacts)
                    ? [...data.organisation.participantContacts, ...(Array.isArray(data.organisation.pendingParticipantContacts) ? data.organisation.pendingParticipantContacts : [])]
                        .map((entry) => normalizeParticipantEntry(entry))
                        .filter((entry) => entry && entry.key !== ownerContact.key)
                    : [];
                setParticipantContacts(nextParticipants);
                setSelectedParticipant(null);
                setParticipantQuery('');
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
                    <h2>Online Links</h2>
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

                <section className="calendar-view-section">
                    <h2>Participants</h2>
                    <p className="edit-hint">
                        You are automatically included as the main contact. Add more users who can be contacted regarding your organisation.
                    </p>

                    <div className="calendar-view-contact-list">
                        {allParticipantContacts.map((contact) => {
                            const { firstName, lastName } = splitNameParts(contact.displayName);
                            const displayLabel = `${contact.displayName}${contact.entityType === 'organisation' ? ' (Organisation)' : ''}`;

                            return (
                                <div key={contact.key} className="calendar-view-contact-item">
                                    <button
                                        type="button"
                                        className="calendar-view-profile-trigger"
                                        onClick={() => navigateToMemberProfile(contact.profileId)}
                                        disabled={!contact.profileId}
                                        aria-label={`Open ${displayLabel} profile`}
                                    >
                                        <ProfileAvatar
                                            firstName={firstName}
                                            lastName={lastName}
                                            avatarUrl={contact.avatarUrl}
                                            size={42}
                                            className="calendar-view-contact-avatar"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        className="calendar-view-name-link"
                                        onClick={() => navigateToMemberProfile(contact.profileId)}
                                        disabled={!contact.profileId}
                                    >
                                        {displayLabel}
                                    </button>
                                    {contact.isOwner ? (
                                        <span className="organisation-participant-owner-label">Main contact</span>
                                    ) : contact.inviteStatus === 'pending' ? (
                                        <span className="organisation-participant-owner-label">Pending</span>
                                    ) : (
                                        <button
                                            type="button"
                                            className="cohost-remove-btn"
                                            onClick={() => removeParticipant(contact.key)}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <label className="form-field full-width organisation-participant-picker" ref={participantRef}>
                        <span>Add participants</span>
                        <input
                            type="text"
                            value={participantQuery}
                            onChange={(event) => {
                                setParticipantQuery(event.target.value);
                                setIsParticipantOpen(true);
                            }}
                            onFocus={() => setIsParticipantOpen(true)}
                            placeholder="Search by name or email"
                        />

                        {isParticipantOpen ? (
                            <div className="cohost-dropdown-menu" role="listbox" aria-label="Participant contacts">
                                {filteredParticipantCandidates.length === 0 ? (
                                    <p className="cohost-empty">No contacts found.</p>
                                ) : (
                                    filteredParticipantCandidates.map((entry) => {
                                        const optionLabel = getDiscoverableName(entry);
                                        return (
                                            <button
                                                key={`${entry?.entityType || 'member'}-${String(entry?.userId || entry?.organisationId || optionLabel)}`}
                                                type="button"
                                                className="cohost-dropdown-option"
                                                onClick={() => handleParticipantSelect(entry)}
                                            >
                                                {optionLabel}
                                                {entry?.entityType === 'organisation' ? ' (Organisation)' : ''}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : null}
                    </label>

                    {selectedParticipant ? (
                        <div className="cohost-selected-row">
                            <small className="cohost-help">The selected organiser will be notified. They become a participant only after accepting the invitation.</small>
                            <button type="button" className="btn-secondary cohost-clear-btn" onClick={clearSelectedParticipant}>Clear</button>
                        </div>
                    ) : null}

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
