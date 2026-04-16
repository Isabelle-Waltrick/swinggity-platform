import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import MemberContactPopup from '../../../components/MemberContactPopup';
import ProfileAvatar from '../../../components/ProfileAvatar';
import editIcon from '../../../assets/edit.svg';
import editSquaredIcon from '../../../assets/edit-squared.svg';
import mailIcon from '../../../assets/mail-icon.svg';
import removeIcon from '../../../assets/remove-icon.svg';
import blockIcon from '../../../assets/block-icon.svg';
import flagIcon from '../../../assets/flag-icon.svg';
import privacyEveryoneIcon from '../../../assets/privacy-everyone.svg';
import privacyCloseCircleIcon from '../../../assets/privacy-close-circle.svg';
import privacyOpenCircleIcon from '../../../assets/privacy-open-circle.svg';
import privacyNobodyIcon from '../../../assets/privacy-nobody.svg';
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
    { value: 'anyone', label: 'Anyone on Swinggity', icon: privacyEveryoneIcon },
    { value: 'mutual', label: 'My Jam Circle and mutual connections', icon: privacyOpenCircleIcon },
    { value: 'circle', label: 'My Jam Circle only', icon: privacyCloseCircleIcon },
    { value: 'nobody', label: 'Nobody', icon: privacyNobodyIcon },
];

const PRIVACY_ORDER = ['anyone', 'mutual', 'circle', 'nobody'];

const getPrivacyRank = (value) => {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    const index = PRIVACY_ORDER.indexOf(normalizedValue);
    return index === -1 ? 0 : index;
};

const getPrivacyLabelForValue = (value) => {
    const match = PRIVACY_OPTIONS.find((option) => option.value === value);
    return match?.label || PRIVACY_OPTIONS[0].label;
};

const getLockedPrivacyOptionMessage = (profileValue, optionValue) => {
    const profileLabel = getPrivacyLabelForValue(profileValue);
    const optionLabel = getPrivacyLabelForValue(optionValue);

    if (optionValue === 'anyone') {
        return `You can't choose "${optionLabel}" because your Profile is set to "${profileLabel}". Change "Who can view your Profile?" to "Anyone on Swinggity" to use this option.`;
    }

    return `You can't choose "${optionLabel}" because your Profile is set to "${profileLabel}". Change "Who can view your Profile?" to a more open option to use this choice.`;
};

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
    privacyProfile: 'Who can view your "Profile"?',
    privacyMembers: 'Who can find you on the "Members" section?',
    privacyContact: 'Who can "Contact" you?',
    privacyActivity: 'Who can view your "Activity"?',
};

const renderPrivacyLabel = (label) => {
    const segments = [];
    const regex = /"([^"]+)"/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(label)) !== null) {
        if (match.index > lastIndex) {
            segments.push(label.slice(lastIndex, match.index));
        }

        segments.push(<strong key={`${match[1]}-${match.index}`}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < label.length) {
        segments.push(label.slice(lastIndex));
    }

    return segments;
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
    privacyProfile: user?.privacyProfile ?? 'anyone',
    privacyContact: user?.privacyContact ?? 'anyone',
    privacyActivity: user?.privacyActivity ?? 'anyone',
});

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

export default function EditProfilePage() {
    const { user, updateProfile, uploadAvatar, removeAvatar, deleteAccount } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const DELETE_ACCOUNT_CONFIRMATION_TEXT = "Yes, please delete this user's account account";
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
    const [isDeleteAccountPopupOpen, setIsDeleteAccountPopupOpen] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState('');
    const [deleteAccountError, setDeleteAccountError] = useState('');
    const [isLeavingOrganisation, setIsLeavingOrganisation] = useState(false);
    const [jamCircleMembers, setJamCircleMembers] = useState([]);
    const [openJamCircleMenuMemberId, setOpenJamCircleMenuMemberId] = useState('');
    const [jamCircleActionMemberId, setJamCircleActionMemberId] = useState('');
    const [blockedMembers, setBlockedMembers] = useState([]);
    const [isBlockedLoading, setIsBlockedLoading] = useState(true);
    const [blockedActionMemberId, setBlockedActionMemberId] = useState('');
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');
    const privacyDropdownAreaRef = useRef(null);
    const pronounsDropdownAreaRef = useRef(null);
    const jamCircleMenuRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const initials = useMemo(() => {
        const first = (formData.displayFirstName || formData.displayLastName || 'N')[0] || 'N';
        const last = (formData.displayLastName || '')[0] || '';
        return `${first}${last}`.toUpperCase();
    }, [formData.displayFirstName, formData.displayLastName]);

    const roleLabel = ROLE_LABELS[formData.role] ?? 'Regular user';
    const normalizedUserRole = String(formData.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';
    const canManageOrganisation = normalizedUserRole === 'organiser' || normalizedUserRole === 'organizer';
    const isDeleteAccountConfirmationValid = deleteAccountConfirmation.trim() === DELETE_ACCOUNT_CONFIRMATION_TEXT;
    useEffect(() => {
        const nextMembers = (Array.isArray(user?.jamCircleMembers) ? user.jamCircleMembers : [])
            .map((member) => ({
                userId: String(member?.userId || '').trim(),
                displayFirstName: String(member?.displayFirstName || '').trim(),
                displayLastName: String(member?.displayLastName || '').trim(),
                fullName: String(member?.fullName || '').trim(),
                avatarUrl: String(member?.avatarUrl || '').trim(),
            }))
            .filter((member) => member.userId);

        setJamCircleMembers(nextMembers);
    }, [user?.jamCircleMembers]);

    useEffect(() => {
        if (isAdminUser) {
            setBlockedMembers([]);
            setIsBlockedLoading(false);
            return;
        }

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
    }, [API_URL, isAdminUser, user?.blockedMembers]);

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

            if (jamCircleMenuRef.current && !jamCircleMenuRef.current.contains(event.target)) {
                setOpenJamCircleMenuMemberId('');
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

    const getPrivacyOptionForValue = (value) => {
        const match = PRIVACY_OPTIONS.find((option) => option.value === value);
        return match || PRIVACY_OPTIONS[0];
    };

    const getPrivacyFloorForField = (field) => {
        if (field === 'privacyActivity') {
            return formData.privacyProfile;
        }

        return 'anyone';
    };

    const isPrivacyOptionLocked = (field, optionValue) => {
        const minAllowedValue = getPrivacyFloorForField(field);
        return getPrivacyRank(optionValue) < getPrivacyRank(minAllowedValue);
    };

    const applyPrivacyProfileCascade = (profileValue, currentState) => {
        const nextState = {
            ...currentState,
            privacyProfile: profileValue,
        };

        const profileRank = getPrivacyRank(profileValue);

        if (getPrivacyRank(nextState.privacyActivity) < profileRank) {
            nextState.privacyActivity = profileValue;
        }

        return nextState;
    };

    const handlePrivacyOptionSelect = (field, value) => {
        setFormData((current) => {
            if (field === 'privacyProfile') {
                return applyPrivacyProfileCascade(value, current);
            }

            if (field === 'privacyActivity' && getPrivacyRank(value) < getPrivacyRank(current.privacyProfile)) {
                return current;
            }

            return {
                ...current,
                [field]: value,
            };
        });
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

        // Validate social media URLs
        if (formData.instagram?.trim() && !validateSocialMediaUrl(formData.instagram, 'instagram')) {
            setSaveError('Please enter a valid Instagram URL (e.g., https://www.instagram.com/username).');
            setIsSaving(false);
            return;
        }

        if (formData.facebook?.trim() && !validateSocialMediaUrl(formData.facebook, 'facebook')) {
            setSaveError('Please enter a valid Facebook URL (e.g., https://www.facebook.com/page).');
            setIsSaving(false);
            return;
        }

        if (formData.youtube?.trim() && !validateSocialMediaUrl(formData.youtube, 'youtube')) {
            setSaveError('Please enter a valid YouTube URL (e.g., https://www.youtube.com/channel/name).');
            setIsSaving(false);
            return;
        }

        if (formData.linkedin?.trim() && !validateSocialMediaUrl(formData.linkedin, 'linkedin')) {
            setSaveError('Please enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/profile).');
            setIsSaving(false);
            return;
        }

        if (formData.website?.trim() && !validateSocialMediaUrl(formData.website, 'website')) {
            setSaveError('Please enter a valid website URL.');
            setIsSaving(false);
            return;
        }

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

        if (isAdminUser) {
            delete payload.pronouns;
            delete payload.profileTags;
            delete payload.privacyProfile;
            delete payload.privacyMembers;
            delete payload.privacyContact;
            delete payload.privacyActivity;
        }

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

    const openDeleteAccountPopup = () => {
        if (isDeletingAccount) return;
        setDeleteAccountConfirmation('');
        setDeleteAccountError('');
        setIsDeleteAccountPopupOpen(true);
    };

    const closeDeleteAccountPopup = () => {
        if (isDeletingAccount) return;
        setIsDeleteAccountPopupOpen(false);
        setDeleteAccountConfirmation('');
        setDeleteAccountError('');
    };

    const handleDeleteAccount = async () => {
        if (!isDeleteAccountConfirmationValid || isDeletingAccount) return;

        setIsDeletingAccount(true);
        setDeleteAccountError('');

        try {
            await deleteAccount();
            setIsDeleteAccountPopupOpen(false);
            navigate('/login', { replace: true });
        } catch (error) {
            setDeleteAccountError(error.message || 'Unable to delete account.');
        } finally {
            setIsDeletingAccount(false);
        }
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

    const openMemberContactPopup = (name, userId) => {
        setContactTargetName(String(name || '').trim() || 'this user');
        setContactTargetUserId(String(userId || '').trim());
        setIsMemberContactPopupOpen(true);
    };

    const closeMemberContactPopup = () => {
        setIsMemberContactPopupOpen(false);
        setContactTargetName('');
        setContactTargetUserId('');
    };

    const handleJamCircleReportPlaceholder = () => {
        window.alert('Flag / Report profile action coming soon.');
    };

    const handleRemoveFromJamCircle = async (member) => {
        const memberId = String(member?.userId || '');
        if (!memberId || jamCircleActionMemberId) return;

        setJamCircleActionMemberId(memberId);
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
            setOpenJamCircleMenuMemberId('');
        } catch (removeError) {
            window.alert(removeError.message || 'Unable to remove member from Jam Circle.');
        } finally {
            setJamCircleActionMemberId('');
        }
    };

    const handleBlockMember = async (member) => {
        const memberId = String(member?.userId || '');
        if (!memberId || jamCircleActionMemberId) return;

        setJamCircleActionMemberId(memberId);
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
            setOpenJamCircleMenuMemberId('');
        } catch (blockError) {
            window.alert(blockError.message || 'Unable to block member.');
        } finally {
            setJamCircleActionMemberId('');
        }
    };

    const handleUnblockMember = async (member) => {
        const memberId = String(member?.userId || '');
        if (!memberId || blockedActionMemberId) return;

        setBlockedActionMemberId(memberId);
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
            setBlockedActionMemberId('');
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
                        {!isAdminUser ? (
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
                        ) : null}
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

                {!isAdminUser ? (
                    <section className="edit-block">
                        <h2>Your Jam Circle</h2>
                        {jamCircleMembers.length === 0 ? (
                            <p className="edit-hint">You don&apos;t have anyone in your Jam Circle yet.</p>
                        ) : (
                            <div className="edit-jam-circle-list" aria-label="Your jam circle members" ref={jamCircleMenuRef}>
                                {jamCircleMembers.map((member) => {
                                    const memberName = member.fullName || `${member.displayFirstName} ${member.displayLastName}`.trim() || 'Swinggity Member';

                                    return (
                                        <article key={member.userId} className="edit-jam-circle-row">
                                            <div className="edit-jam-circle-member">
                                                <button
                                                    type="button"
                                                    className="edit-jam-circle-avatar-button"
                                                    onClick={() => navigate(`/dashboard/members/${encodeURIComponent(member.userId)}`)}
                                                    aria-label={`View ${memberName} profile`}
                                                >
                                                    <ProfileAvatar
                                                        firstName={member.displayFirstName}
                                                        lastName={member.displayLastName}
                                                        avatarUrl={member.avatarUrl}
                                                        size={52}
                                                    />
                                                </button>
                                                <div className="edit-jam-circle-member-main">
                                                    <button
                                                        type="button"
                                                        className="edit-jam-circle-name-button"
                                                        onClick={() => navigate(`/dashboard/members/${encodeURIComponent(member.userId)}`)}
                                                        aria-label={`View ${memberName} profile`}
                                                    >
                                                        {memberName}
                                                    </button>
                                                    <div className="edit-jam-circle-actions">
                                                        <button
                                                            type="button"
                                                            className="edit-jam-circle-btn edit-jam-circle-btn-contact"
                                                            onClick={() => openMemberContactPopup(memberName, member.userId)}
                                                        >
                                                            <img src={mailIcon} alt="" aria-hidden="true" className="edit-jam-circle-btn-icon" />
                                                            Contact
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`edit-jam-circle-btn edit-jam-circle-btn-more ${openJamCircleMenuMemberId === String(member.userId || '') ? 'is-open' : ''}`}
                                                            onClick={() => setOpenJamCircleMenuMemberId((currentId) => (
                                                                currentId === String(member.userId || '') ? '' : String(member.userId || '')
                                                            ))}
                                                        >
                                                            More
                                                            <span className="edit-jam-circle-btn-caret" aria-hidden="true" />
                                                        </button>
                                                        {openJamCircleMenuMemberId === String(member.userId || '') ? (
                                                            <div className="edit-jam-circle-menu" role="menu" aria-label={`Actions for ${memberName}`}>
                                                                <button
                                                                    type="button"
                                                                    className="edit-jam-circle-menu-item"
                                                                    onClick={() => handleRemoveFromJamCircle(member)}
                                                                    disabled={jamCircleActionMemberId === String(member.userId || '')}
                                                                >
                                                                    <span className="edit-jam-circle-menu-item-content">
                                                                        <img src={removeIcon} alt="" aria-hidden="true" className="edit-jam-circle-menu-icon" />
                                                                        Remove from Jam Circle
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="edit-jam-circle-menu-item"
                                                                    onClick={() => handleBlockMember(member)}
                                                                    disabled={jamCircleActionMemberId === String(member.userId || '')}
                                                                >
                                                                    <span className="edit-jam-circle-menu-item-content">
                                                                        <img src={blockIcon} alt="" aria-hidden="true" className="edit-jam-circle-menu-icon" />
                                                                        Block member
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="edit-jam-circle-menu-item"
                                                                    onClick={handleJamCircleReportPlaceholder}
                                                                >
                                                                    <span className="edit-jam-circle-menu-item-content">
                                                                        <img src={flagIcon} alt="" aria-hidden="true" className="edit-jam-circle-menu-icon" />
                                                                        Flag / Report profile
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                ) : null}

                {!isAdminUser ? (
                    <section className="edit-block">
                        <h2>Blocked Members</h2>
                        {isBlockedLoading ? (
                            <p className="edit-hint">Loading blocked members...</p>
                        ) : blockedMembers.length === 0 ? (
                            <p className="edit-hint">You have no blocked members.</p>
                        ) : (
                            <div className="edit-blocked-members-list" aria-label="Blocked members">
                                {blockedMembers.map((member) => {
                                    const memberName = member.fullName || `${member.displayFirstName} ${member.displayLastName}`.trim() || 'Swinggity Member';

                                    return (
                                        <article key={member.userId} className="edit-blocked-member-row">
                                            <div className="edit-blocked-member">
                                                <ProfileAvatar
                                                    firstName={member.displayFirstName}
                                                    lastName={member.displayLastName}
                                                    avatarUrl={member.avatarUrl}
                                                    size={52}
                                                />
                                                <div className="edit-blocked-member-main">
                                                    <p>{memberName}</p>
                                                    <div className="edit-blocked-member-actions">
                                                        <button
                                                            type="button"
                                                            className="edit-blocked-unblock-button"
                                                            onClick={() => handleUnblockMember(member)}
                                                            disabled={blockedActionMemberId === String(member.userId || '')}
                                                        >
                                                            {blockedActionMemberId === String(member.userId || '') ? 'Unblocking...' : 'Unblock'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
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

                {!isAdminUser ? (
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
                ) : null}

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

                {!isAdminUser ? (
                    <section className="edit-block">
                        <h2>Privacy</h2>
                        <p className="edit-hint">Control who can contact you and the information others can see on your profile.</p>
                        <div className="edit-grid two-columns privacy-grid" ref={privacyDropdownAreaRef}>
                            {Object.entries(PRIVACY_LABELS).map(([field, label]) => {
                                return (
                                    <div key={field} className="privacy-field">
                                        <span>{renderPrivacyLabel(label)}</span>
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
                                                <span className="privacy-option-value">
                                                    <img
                                                        src={getPrivacyOptionForValue(formData[field]).icon}
                                                        alt=""
                                                        aria-hidden="true"
                                                        className="privacy-option-icon"
                                                    />
                                                    <span>{getPrivacyOptionForValue(formData[field]).label}</span>
                                                </span>
                                                <span className="privacy-dropdown-caret">▾</span>
                                            </button>

                                            {openPrivacyField === field ? (
                                                <div id={`privacy-options-${field}`} className="privacy-dropdown-panel" role="listbox" aria-label={label}>
                                                    {PRIVACY_OPTIONS.map((option) => {
                                                        const isActive = formData[field] === option.value;
                                                        const isLockedOption = isPrivacyOptionLocked(field, option.value);

                                                        if (isLockedOption) {
                                                            return (
                                                                <span key={option.value} className="privacy-option-tooltip-wrap" aria-disabled="true">
                                                                    <button
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={isActive}
                                                                        className={`privacy-dropdown-option privacy-dropdown-option-with-icon privacy-dropdown-option-disabled ${isActive ? 'active' : ''}`}
                                                                        disabled
                                                                        onMouseDown={(mouseEvent) => {
                                                                            mouseEvent.preventDefault();
                                                                        }}
                                                                    >
                                                                        <img src={option.icon} alt="" aria-hidden="true" className="privacy-option-icon" />
                                                                        <span>{option.label}</span>
                                                                    </button>
                                                                    <span className="privacy-option-tooltip" role="tooltip">
                                                                        {getLockedPrivacyOptionMessage(formData.privacyProfile, option.value)}
                                                                    </span>
                                                                </span>
                                                            );
                                                        }

                                                        return (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                role="option"
                                                                aria-selected={isActive}
                                                                className={`privacy-dropdown-option privacy-dropdown-option-with-icon ${isActive ? 'active' : ''}`}
                                                                onMouseDown={(mouseEvent) => {
                                                                    mouseEvent.preventDefault();
                                                                    handlePrivacyOptionSelect(field, option.value);
                                                                }}
                                                            >
                                                                <img src={option.icon} alt="" aria-hidden="true" className="privacy-option-icon" />
                                                                <span>{option.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                <section className="edit-block">
                    <h2>Change password</h2>
                    <button type="button" className="pill-button" onClick={() => navigate('/forgot-password')}>Send me a reset Link</button>
                </section>

                <section className="edit-block danger-zone">
                    <h2>Danger Zone</h2>
                    <p className="edit-hint">Delete your account and account data. This can't be undone!</p>
                    <button type="button" className="danger-button" onClick={openDeleteAccountPopup}>Delete Account</button>
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

            {isDeleteAccountPopupOpen ? (
                <div className="contact-popup-overlay" role="presentation" onClick={closeDeleteAccountPopup}>
                    <div
                        className="contact-popup delete-popup delete-account-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-account-popup-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="delete-account-popup-title" className="delete-popup-title">
                            Are you sure you want to <span className="delete-popup-title-danger">delete your account</span>?
                        </h2>

                        <p className="delete-account-popup-description">
                            This will permanently delete your Swinggity account. This action cannot be undone. If you are sure you want to delete your account. Type on the input: <strong>Yes, please delete this user's account account</strong>
                        </p>

                        <label className="delete-account-popup-label" htmlFor="delete-account-confirmation">
                            Type the confirmation phrase
                        </label>
                        <input
                            id="delete-account-confirmation"
                            className="delete-account-popup-input"
                            type="text"
                            value={deleteAccountConfirmation}
                            onChange={(event) => {
                                setDeleteAccountConfirmation(event.target.value);
                                setDeleteAccountError('');
                            }}
                            autoComplete="off"
                            autoFocus
                        />

                        {deleteAccountError ? <p className="delete-account-popup-error">{deleteAccountError}</p> : null}

                        <div className="delete-popup-actions">
                            <button
                                type="button"
                                className="delete-popup-confirm"
                                onClick={handleDeleteAccount}
                                disabled={!isDeleteAccountConfirmationValid || isDeletingAccount}
                            >
                                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                            </button>
                            <button
                                type="button"
                                className="delete-popup-cancel"
                                onClick={closeDeleteAccountPopup}
                                disabled={isDeletingAccount}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <MemberContactPopup
                isOpen={isMemberContactPopupOpen}
                targetName={contactTargetName}
                targetUserId={contactTargetUserId}
                currentUser={user}
                apiUrl={API_URL}
                onClose={closeMemberContactPopup}
            />
        </section>
    );
}
