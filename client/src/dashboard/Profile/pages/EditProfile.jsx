import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
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

/**
 * EditProfilePage
 *
 * The full profile editor form. This is the main page where authenticated users
 * can modify their name, bio, avatar, contact details, social links, interests,
 * privacy settings, and manage their jam-circle relationships.
 *
 * Role-specific UI:
 *   - Regular users see fields for pronouns, tags, privacy controls, and jam-circle
 *     management; no access to organisation editor.
 *   - Organisers see an additional organisation management section.
 *   - Admins see a read-only role field; pronouns and privacy fields are hidden.
 *
 * Key responsibilities:
 *   1. Form state: All form data is owned here; state updates immediately as the
 *      user types, then uploaded to the API on save.
 *   2. Field validation: Social URLs, phone numbers, and custom pronouns are
 *      validated before submission; errors are stored per-field.
 *   3. Privacy constraints: The activity privacy setting is locked if it's more
 *      permissive than the profile privacy setting (cascading rules).
 *   4. Jam-circle and blocked-members lists: Fetched from the API and rendered
 *      inline with remove, block, and unblock actions.
 *   5. Organisation and deletion flows: Modal dialogs for destructive actions.
 *
 * Navigation flow:
 *   - Save → success popup → dismiss → back to Profile page
 *   - Cancel → back to Profile page
 *   - Change password → navigate to /forgot-password
 *   - Edit organisation → navigate to /dashboard/profile/organisation/edit
 *   - View jam-circle member → navigate to /dashboard/members/:userId
 */

// ── Constants ──────────────────────────────────────────────────────────────

// Tag suggestions shown in the interest picker
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

// ── Privacy settings ───────────────────────────────────────────────────────

// Privacy tiers ranked from most open to most restrictive; used to enforce
// cascading constraints (e.g., activity privacy can't be more open than profile
// privacy)
const PRIVACY_OPTIONS = [
    { value: 'anyone', label: 'Anyone on Swinggity', icon: privacyEveryoneIcon },
    { value: 'mutual', label: 'My Jam Circle and mutual connections', icon: privacyOpenCircleIcon },
    { value: 'circle', label: 'My Jam Circle only', icon: privacyCloseCircleIcon },
    { value: 'nobody', label: 'Nobody', icon: privacyNobodyIcon },
];

// Ordered list used to compare privacy levels: lower indices = more open,
// higher indices = more restrictive
const PRIVACY_ORDER = ['anyone', 'mutual', 'circle', 'nobody'];

// Returns a numeric rank for a privacy value; used to compare strictness levels
const getPrivacyRank = (value) => {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    const index = PRIVACY_ORDER.indexOf(normalizedValue);
    return index === -1 ? 0 : index;
};

// Resolve a privacy value into its UI label for dropdown copy and tooltips
const getPrivacyLabelForValue = (value) => {
    const match = PRIVACY_OPTIONS.find((option) => option.value === value);
    return match?.label || PRIVACY_OPTIONS[0].label;
};

// Build the explanatory message shown when a privacy option is locked
const getLockedPrivacyOptionMessage = (profileValue, optionValue) => {
    const profileLabel = getPrivacyLabelForValue(profileValue);
    const optionLabel = getPrivacyLabelForValue(optionValue);

    // Special-case the most open option with an explicit profile-setting instruction
    if (optionValue === 'anyone') {
        return `You can't choose "${optionLabel}" because your Profile is set to "${profileLabel}". Change "Who can view your Profile?" to "Anyone on Swinggity" to use this option.`;
    }

    // Generic fallback for all other locked options
    return `You can't choose "${optionLabel}" because your Profile is set to "${profileLabel}". Change "Who can view your Profile?" to a more open option to use this choice.`;
};

// ── Pronouns ──────────────────────────────────────────────────────────────

// List of preset pronoun options shown in the dropdown; also includes an
// "other" option for custom entries
const PRONOUN_OPTIONS = [
    { value: '', label: 'Select pronouns' },
    { value: 'she/her', label: 'she/her' },
    { value: 'he/him', label: 'he/him' },
    { value: 'they/them', label: 'they/them' },
    { value: 'other', label: 'other' },
];

// Pre-built set of valid pronoun values for quick O(1) lookup during validation
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

// ── Role labels and helper text ────────────────────────────────────────────

// Readable labels for each user role; displayed as read-only in the form
const ROLE_LABELS = {
    regular: 'Regular user',
    organiser: 'Organiser',
    admin: 'Admin',
};

// Help text shown to regular users explaining role limitations and how to upgrade
const REGULAR_USER_HELP_TEXT = 'As a regular user you have access to most features in the platform, with the exception of post events in the Calendar. Do you organise events? Please send us an email to swinggity.team@gmail.com to request access to post on our Calendar.';

// ── URL resolution ────────────────────────────────────────────────────────

// Resolves an organisation image URL for display; validates protocol and path
// format; returns the full URL or an empty string if invalid
const resolveOrganisationImageUrl = (apiUrl, rawUrl) => {
    const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!normalized) return '';

    // External URLs must use http/https protocol
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

    // Local relative paths are prefixed with the API URL
    if (/^\/uploads\/avatars\/[A-Za-z0-9._/-]+$/.test(normalized)) {
        return `${apiUrl}${normalized}`;
    }

    return '';
};

// Initialises the form state from a user object; applies reasonable defaults
// when fields are missing or unset
const getInitialFormState = (user) => ({
    ...extractInitialPronouns(user),
    displayFirstName: user?.displayFirstName ?? user?.firstName ?? '',
    displayLastName: user?.displayLastName ?? user?.lastName ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    bio: user?.bio ?? '',
    role: user?.role ?? 'regular',
    contactEmail: user?.email ?? '',
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

// ── Form validation ───────────────────────────────────────────────────────

// Validates a social media URL against a platform-specific regex; empty URLs
// are always valid (the field is optional)
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

// ══════════════════════════════════════════════════════════════════════════

export default function EditProfilePage() {
    // ── Auth and navigation ────────────────────────────────────────────────
    const { user, updateProfile, uploadAvatar, removeAvatar, deleteAccount } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const DELETE_ACCOUNT_CONFIRMATION_TEXT = "Yes, please delete this user's account account";

    // ── Form data and field errors ─────────────────────────────────────────
    const [formData, setFormData] = useState(getInitialFormState(user));
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [saveError, setSaveError] = useState('');

    // ── Privacy and pronouns dropdowns ──────────────────────────────────────
    const [openPrivacyField, setOpenPrivacyField] = useState('');
    const [isPronounsDropdownOpen, setIsPronounsDropdownOpen] = useState(false);

    // ── Organisation management ────────────────────────────────────────────
    const [organisation, setOrganisation] = useState(null);
    const [organisationMembershipType, setOrganisationMembershipType] = useState('none');
    const [isLoadingOrganisation, setIsLoadingOrganisation] = useState(false);
    const [isDeleteOrganisationPopupOpen, setIsDeleteOrganisationPopupOpen] = useState(false);
    const [isDeletingOrganisation, setIsDeletingOrganisation] = useState(false);

    // ── Account deletion flow ──────────────────────────────────────────────
    const [isDeleteAccountPopupOpen, setIsDeleteAccountPopupOpen] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [isSaveSuccessPopupOpen, setIsSaveSuccessPopupOpen] = useState(false);
    const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState('');
    const [deleteAccountError, setDeleteAccountError] = useState('');

    // ── Jam Circle management ──────────────────────────────────────────────
    const [isLeavingOrganisation, setIsLeavingOrganisation] = useState(false);
    const [jamCircleMembers, setJamCircleMembers] = useState([]);
    const [isJamCircleExpanded, setIsJamCircleExpanded] = useState(false);
    const [openJamCircleMenuMemberId, setOpenJamCircleMenuMemberId] = useState('');
    const [jamCircleActionMemberId, setJamCircleActionMemberId] = useState('');

    // ── Blocked Members ────────────────────────────────────────────────────
    const [blockedMembers, setBlockedMembers] = useState([]);
    const [isBlockedLoading, setIsBlockedLoading] = useState(true);
    const [blockedActionMemberId, setBlockedActionMemberId] = useState('');

    // ── Member contact modal ───────────────────────────────────────────────
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');

    // ── Refs for dropdown click-outside detection ──────────────────────────
    const privacyDropdownAreaRef = useRef(null);
    const pronounsDropdownAreaRef = useRef(null);
    const jamCircleMenuRef = useRef(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    // ── Computed values ────────────────────────────────────────────────────

    // Avatar initials derived from display name; used as fallback when no image
    const initials = useMemo(() => {
        const first = (formData.displayFirstName || formData.displayLastName || 'N')[0] || 'N';
        const last = (formData.displayLastName || '')[0] || '';
        return `${first}${last}`.toUpperCase();
    }, [formData.displayFirstName, formData.displayLastName]);

    // Derive role-based UI visibility flags
    const roleLabel = ROLE_LABELS[formData.role] ?? 'Regular user';
    const normalizedUserRole = String(formData.role || '').trim().toLowerCase();
    const isAdminUser = normalizedUserRole === 'admin';
    const canManageOrganisation = normalizedUserRole === 'organiser' || normalizedUserRole === 'organizer';

    // Account deletion confirmation: must match the exact string displayed
    const isDeleteAccountConfirmationValid = deleteAccountConfirmation.trim() === DELETE_ACCOUNT_CONFIRMATION_TEXT;

    // Jam-circle preview logic: show max 3 members, expand to show all
    const hasHiddenJamCircleMembers = jamCircleMembers.length > 3;
    const visibleJamCircleMembers = isJamCircleExpanded ? jamCircleMembers : jamCircleMembers.slice(0, 3);

    // ── Effects ────────────────────────────────────────────────────────────

    // Sync jam-circle members from the user object and normalize to a stable format
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

    // Collapse the jam-circle list when it falls below the preview threshold
    useEffect(() => {
        if (jamCircleMembers.length <= 3) {
            setIsJamCircleExpanded(false);
        }
    }, [jamCircleMembers.length]);

    // Fetch the list of blocked members; admins always see an empty list
    useEffect(() => {
        if (isAdminUser) {
            setBlockedMembers([]);
            setIsBlockedLoading(false);
            return;
        }

        const fetchBlockedMembers = async () => {
            setIsBlockedLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/member-safety/blocked-members`, {
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

        setFieldErrors((current) => {
            if (!current[field]) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
    };

    const handlePhoneChange = (value) => {
        setFormData((current) => ({
            ...current,
            phoneNumber: value || '',
        }));

        setFieldErrors((current) => {
            if (!current.phoneNumber) return current;
            const next = { ...current };
            delete next.phoneNumber;
            return next;
        });
    };

    const handleTagsChange = (newTags) => {
        setFormData((current) => ({
            ...current,
            profileTags: newTags,
        }));
    };

    // Close all dropdowns when clicking outside; also handle Escape key
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

    // Load the user's organisation if they are an organiser; skip for regular users
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

    // Manage body overflow and Escape key for the delete-organisation modal
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

    // Returns the option object for a stored privacy value; falls back to the
    // first option to avoid rendering errors if data is missing.
    const getPrivacyOptionForValue = (value) => {
        const match = PRIVACY_OPTIONS.find((option) => option.value === value);
        return match || PRIVACY_OPTIONS[0];
    };
    // Defines the minimum allowed privacy level per field.
    const getPrivacyFloorForField = (field) => {
        if (field === 'privacyActivity') {
            return formData.privacyProfile; }
        return 'anyone';
    };
    // Locks options that are more open than the field's minimum allowed level.
    const isPrivacyOptionLocked = (field, optionValue) => {
        const minAllowedValue = getPrivacyFloorForField(field);
        return getPrivacyRank(optionValue) < getPrivacyRank(minAllowedValue);
    };
    // Cascades profile privacy to activity privacy when needed so activity
    const applyPrivacyProfileCascade = (profileValue, currentState) => {
        const nextState = {
            ...currentState, privacyProfile: profileValue,
        };
        const profileRank = getPrivacyRank(profileValue);

        if (getPrivacyRank(nextState.privacyActivity) < profileRank) {
            nextState.privacyActivity = profileValue; }
        return nextState;
    };
    // Applies privacy selections while enforcing cascade and floor rules.
    const handlePrivacyOptionSelect = (field, value) => {
        setFormData((current) => {
            if (field === 'privacyProfile') {
                return applyPrivacyProfileCascade(value, current); }
            if (field === 'privacyActivity' && getPrivacyRank(value) < getPrivacyRank(current.privacyProfile)) {
                return current; }
            return {
                ...current, [field]: value,
            };
        });
        setOpenPrivacyField('');
    };

    // Gets the display label for the selected pronoun value.
    const getPronounLabelForValue = (value) => {
        const match = PRONOUN_OPTIONS.find((option) => option.value === value);
        return match?.label || PRONOUN_OPTIONS[0].label;
    };

    // Updates pronouns and clears any stale custom-pronoun validation error
    // when the user switches away from the "other" option.
    const handlePronounsOptionSelect = (value) => {
        setFormData((current) => ({
            ...current,
            pronouns: value,
        }));

        if (value !== 'other') {
            setFieldErrors((current) => {
                if (!current.customPronouns) return current;
                const next = { ...current };
                delete next.customPronouns;
                return next;
            });
        }

        setIsPronounsDropdownOpen(false);
    };

    // Appends a field-invalid class when a field has a validation error.
    const getFieldClassName = (fieldName, baseClass = '') => {
        const invalidClass = fieldErrors[fieldName] ? 'field-invalid' : '';
        return [baseClass, invalidClass].filter(Boolean).join(' ');
    };

    // ── Handlers ───────────────────────────────────────────────────────────

    // Main form submission: validate all fields, then POST to the API
    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setFieldErrors({});
        setSaveError('');

        const nextErrors = {};

        if (formData.instagram?.trim() && !validateSocialMediaUrl(formData.instagram, 'instagram')) {
            nextErrors.instagram = 'Please enter a valid Instagram URL (e.g., https://www.instagram.com/username).';
        }

        if (formData.facebook?.trim() && !validateSocialMediaUrl(formData.facebook, 'facebook')) {
            nextErrors.facebook = 'Please enter a valid Facebook URL (e.g., https://www.facebook.com/page).';
        }

        if (formData.youtube?.trim() && !validateSocialMediaUrl(formData.youtube, 'youtube')) {
            nextErrors.youtube = 'Please enter a valid YouTube URL (e.g., https://www.youtube.com/channel/name).';
        }

        if (formData.linkedin?.trim() && !validateSocialMediaUrl(formData.linkedin, 'linkedin')) {
            nextErrors.linkedin = 'Please enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/profile).';
        }

        if (formData.website?.trim() && !validateSocialMediaUrl(formData.website, 'website')) {
            nextErrors.website = 'Please enter a valid website URL.';
        }

        if (formData.phoneNumber?.trim() && !isValidPhoneNumber(formData.phoneNumber.trim())) {
            nextErrors.phoneNumber = 'Please enter a valid phone number with a country code.';
        }

        if (!isAdminUser && formData.pronouns === 'other' && !isValidCustomPronounsFormat(formData.customPronouns || '')) {
            nextErrors.customPronouns = 'Please enter custom pronouns in the format "x/y".';
        }

        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setSaveError('Please fix the highlighted fields before saving.');
            setIsSaving(false);
            return;
        }

        const payload = { ...formData };

        if (payload.pronouns === 'other') {
            payload.pronouns = normalizeCustomPronouns(payload.customPronouns);
        }

        delete payload.customPronouns;
        delete payload.contactEmail;

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
            setIsSaveSuccessPopupOpen(true);
        } catch (error) {
            setSaveError(error.message || 'Unable to save profile changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const closeSaveSuccessPopup = () => {
        // Close confirmation and return to the public profile view.
        setIsSaveSuccessPopupOpen(false);
        navigate('/dashboard/profile');
    };

    const handleCancel = () => {
        // Discard local edits and return without persisting changes.
        navigate('/dashboard/profile');
    };

    const openDeleteAccountPopup = () => {
        // Ignore repeated opens while a delete request is already running.
        if (isDeletingAccount) return;
        setDeleteAccountConfirmation('');
        setDeleteAccountError('');
        setIsDeleteAccountPopupOpen(true);
    };

    const closeDeleteAccountPopup = () => {
        // Prevent closing during in-flight delete to avoid inconsistent state.
        if (isDeletingAccount) return;
        setIsDeleteAccountPopupOpen(false);
        setDeleteAccountConfirmation('');
        setDeleteAccountError('');
    };

    const handleDeleteAccount = async () => {
        // Require exact confirmation phrase and block duplicate submissions.
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
        // Guard against double-clicks while deletion is already pending.
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
        // Guard against duplicate leave requests.
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

    // Build preview URLs for avatar and organisation image cards.
    const avatarSrc = formData.avatarUrl
        ? (formData.avatarUrl.startsWith('http') ? formData.avatarUrl : `${API_URL}${formData.avatarUrl}`)
        : '';
    const organisationImageSrc = useMemo(
        () => resolveOrganisationImageUrl(API_URL, organisation?.imageUrl),
        [API_URL, organisation?.imageUrl]
    );

    const triggerAvatarPicker = () => {
        // Block re-opening the file picker during upload.
        if (isUploadingAvatar) return;
        setFieldErrors((current) => {
            if (!current.avatar) return current;
            const next = { ...current };
            delete next.avatar;
            return next;
        });
        // Programmatically trigger the hidden file input.
        fileInputRef.current?.click();
    };

    const handleAvatarFileChange = async (event) => {
        // Only proceed when the user has selected a real file.
        const file = event.target.files?.[0];
        if (!file) return;

        setSaveError('');
        setFieldErrors((current) => {
            if (!current.avatar) return current;
            const next = { ...current };
            delete next.avatar;
            return next;
        });
        setIsUploadingAvatar(true);

        try {
            const updatedUser = await uploadAvatar(file);
            setFormData((current) => ({
                ...current,
                avatarUrl: updatedUser?.avatarUrl ?? current.avatarUrl,
            }));
        } catch (error) {
            // Surface upload failure directly under the avatar field.
            setFieldErrors((current) => ({
                ...current,
                avatar: error.message || 'Unable to upload avatar.',
            }));
        } finally {
            setIsUploadingAvatar(false);
            // Clear the file input so selecting the same file again retriggers onChange.
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

    // Open contact popup for a selected jam-circle member.
    const openMemberContactPopup = (name, userId) => {
        setContactTargetName(String(name || '').trim() || 'this user');
        setContactTargetUserId(String(userId || '').trim());
        setIsMemberContactPopupOpen(true);
    };

    // Reset popup state on close.
    const closeMemberContactPopup = () => {
        setIsMemberContactPopupOpen(false);
        setContactTargetName('');
        setContactTargetUserId('');
    };

    // Placeholder action until report flow is implemented.
    const handleJamCircleReportPlaceholder = () => {
        window.alert('Flag / Report profile action coming soon.');
    };

    const handleRemoveFromJamCircle = async (member) => {
        const memberId = String(member?.userId || '');
        // Skip if member is invalid or another member action is already running.
        if (!memberId || jamCircleActionMemberId) return;

        setJamCircleActionMemberId(memberId);
        try {
            const response = await fetch(`${API_URL}/api/jam-circle/profile/jam-circle/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to remove member from Jam Circle.');
            }

            // Optimistically remove from UI after successful API response.
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
        // Reuse the same action guard to prevent parallel member operations.
        if (!memberId || jamCircleActionMemberId) return;
        setJamCircleActionMemberId(memberId);
        try {
            const response = await fetch(`${API_URL}/api/member-safety/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to block member.');
            }

            // Remove blocked member from jam-circle list in the current view.
            setJamCircleMembers((currentMembers) => currentMembers.filter((item) => String(item?.userId || '') !== memberId));
            setOpenJamCircleMenuMemberId('');
        } catch (blockError) {
            window.alert(blockError.message || 'Unable to block member.');
        } finally {
            setJamCircleActionMemberId('');
        }
    };
    // Unblocking a member is only available in the blocked members list, so we can safely reuse the same action guard state variable.
    const handleUnblockMember = async (member) => {
        const memberId = String(member?.userId || '');
        // Prevent duplicate unblock calls for the same or other members.
        if (!memberId || blockedActionMemberId) return;

        setBlockedActionMemberId(memberId);
        try {
            const response = await fetch(`${API_URL}/api/member-safety/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to unblock member.');
            }

            // Remove unblocked member from the blocked-members list.
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
                    <div className={`edit-avatar ${fieldErrors.avatar ? 'field-invalid' : ''}`}>
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
                {fieldErrors.avatar ? <p className="edit-avatar-error" role="alert">{fieldErrors.avatar}</p> : null}

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
                                                className={getFieldClassName('customPronouns')}
                                                value={formData.customPronouns}
                                                onChange={handleInput('customPronouns')}
                                                placeholder="e.g. ze/zir"
                                                aria-label="Custom pronouns"
                                            />
                                            {fieldErrors.customPronouns ? <small className="field-error">{fieldErrors.customPronouns}</small> : null}
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
                                {visibleJamCircleMembers.map((member) => {
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
                                {hasHiddenJamCircleMembers ? (
                                    <button
                                        type="button"
                                        className="edit-jam-circle-toggle-link"
                                        onClick={() => setIsJamCircleExpanded((current) => !current)}
                                    >
                                        {isJamCircleExpanded ? 'Show fewer contacts' : 'View the whole Jam Circle'}
                                    </button>
                                ) : null}
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
                            <span>Registered email</span>
                            <input className="edit-readonly-field" type="email" value={user?.email ?? ''} readOnly aria-readonly="true" />
                        </label>
                        <label>
                            <span>Phone Number</span>
                            <PhoneInput
                                className={getFieldClassName('phoneNumber', 'edit-phone-input')}
                                value={formData.phoneNumber || undefined}
                                onChange={handlePhoneChange}
                                defaultCountry="GB"
                                international
                                withCountryCallingCode
                                placeholder="Select a country and enter a phone number"
                            />
                            {fieldErrors.phoneNumber ? <small className="field-error">{fieldErrors.phoneNumber}</small> : null}
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
                            <input className={getFieldClassName('instagram')} value={formData.instagram} onChange={handleInput('instagram')} />
                            {fieldErrors.instagram ? <small className="field-error">{fieldErrors.instagram}</small> : null}
                        </label>
                        <label>
                            <span>Facebook</span>
                            <input className={getFieldClassName('facebook')} value={formData.facebook} onChange={handleInput('facebook')} />
                            {fieldErrors.facebook ? <small className="field-error">{fieldErrors.facebook}</small> : null}
                        </label>
                        <label>
                            <span>Youtube</span>
                            <input className={getFieldClassName('youtube')} value={formData.youtube} onChange={handleInput('youtube')} />
                            {fieldErrors.youtube ? <small className="field-error">{fieldErrors.youtube}</small> : null}
                        </label>
                        <label>
                            <span>LinkedIn</span>
                            <input className={getFieldClassName('linkedin')} value={formData.linkedin} onChange={handleInput('linkedin')} />
                            {fieldErrors.linkedin ? <small className="field-error">{fieldErrors.linkedin}</small> : null}
                        </label>
                        <label>
                            <span>Website</span>
                            <input className={getFieldClassName('website')} value={formData.website} onChange={handleInput('website')} />
                            {fieldErrors.website ? <small className="field-error">{fieldErrors.website}</small> : null}
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

            {isSaveSuccessPopupOpen ? (
                <div className="notification-response-popup-overlay" role="presentation" onClick={closeSaveSuccessPopup}>
                    <div
                        className="notification-response-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="profile-save-success-title"
                        aria-describedby="profile-save-success-description"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="profile-save-success-title" className="notification-response-popup-title">
                            All Set
                        </h2>
                        <p id="profile-save-success-description" className="notification-response-popup-description">
                            Your profile changes have been saved.
                        </p>
                        <div className="notification-response-popup-actions">
                            <button type="button" className="notification-response-popup-button" onClick={closeSaveSuccessPopup}>
                                OK
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

