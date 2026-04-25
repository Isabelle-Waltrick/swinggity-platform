import { validateName } from './auth.validators.js';

const PRIVACY_OPTIONS = ['anyone', 'circle', 'mutual', 'nobody'];
const ALLOWED_ROLES = ['regular', 'organiser', 'admin'];

// These config tables keep the validation logic declarative: one place to see
// which payload fields map to which validated output keys and limits.
const TEXT_FIELD_CONFIGS = [
    { payloadKey: 'bio', resultKey: 'validatedBio', label: 'Bio', maxLength: 500 },
    { payloadKey: 'pronouns', resultKey: 'validatedPronouns', label: 'Pronouns', maxLength: 50 },
    { payloadKey: 'phoneNumber', resultKey: 'validatedPhoneNumber', label: 'Phone number', maxLength: 30 },
    { payloadKey: 'instagram', resultKey: 'validatedInstagram', label: 'Instagram', maxLength: 120 },
    { payloadKey: 'facebook', resultKey: 'validatedFacebook', label: 'Facebook', maxLength: 120 },
    { payloadKey: 'youtube', resultKey: 'validatedYouTube', label: 'YouTube', maxLength: 120 },
    { payloadKey: 'linkedin', resultKey: 'validatedLinkedin', label: 'LinkedIn', maxLength: 120 },
    { payloadKey: 'website', resultKey: 'validatedWebsite', label: 'Website', maxLength: 300 },
    { payloadKey: 'jamCircle', resultKey: 'validatedJamCircle', label: 'Jam circle', maxLength: 1000 },
    { payloadKey: 'interests', resultKey: 'validatedInterests', label: 'Interests', maxLength: 1000 },
    { payloadKey: 'activity', resultKey: 'validatedActivity', label: 'Activity', maxLength: 1000 },
];

const PRIVACY_FIELD_CONFIGS = [
    { payloadKey: 'privacyMembers', resultKey: 'validatedPrivacyMembers', label: 'privacyMembers' },
    { payloadKey: 'privacyProfile', resultKey: 'validatedPrivacyProfile', label: 'privacyProfile' },
    { payloadKey: 'privacyContact', resultKey: 'validatedPrivacyContact', label: 'privacyContact' },
    { payloadKey: 'privacyActivity', resultKey: 'validatedPrivacyActivity', label: 'privacyActivity' },
];

const sanitizeTextField = (value, fieldName, maxLength) => {
    if (value === undefined) {
        // "Not provided" is different from "provided but empty" for PATCH updates.
        return { isProvided: false };
    }

    if (typeof value !== 'string') {
        return { isProvided: true, error: `${fieldName} must be a string` };
    }

    const sanitizedValue = value.trim();
    if (sanitizedValue.length > maxLength) {
        return {
            isProvided: true,
            error: `${fieldName} must be less than or equal to ${maxLength} characters`,
        };
    }

    return { isProvided: true, value: sanitizedValue };
};

const sanitizeDisplayName = (value, fieldName) => {
    if (value === undefined) {
        return { isProvided: false };
    }

    if (typeof value !== 'string') {
        return { isProvided: true, error: `${fieldName} must be a string` };
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return { isProvided: true, value: '' };
    }

    const validated = validateName(trimmed, fieldName);
    if (!validated.isValid) {
        return { isProvided: true, error: validated.error };
    }

    return { isProvided: true, value: validated.name };
};

const sanitizeRole = (value) => {
    if (value === undefined) {
        return { isProvided: false };
    }

    if (typeof value !== 'string') {
        return { isProvided: true, error: 'Role must be a string' };
    }

    const normalizedRole = value.trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(normalizedRole)) {
        return { isProvided: true, error: 'Role has an invalid value' };
    }

    return { isProvided: true, value: normalizedRole };
};

export const validateMemberRoleUpdatePayload = (payload = {}) => {
    // Role updates have their own payload validator so admin endpoints can stay focused.
    const validatedRole = sanitizeRole(payload.role);
    if (validatedRole.error) {
        return { isValid: false, error: validatedRole.error };
    }

    return {
        isValid: true,
        validatedRole,
    };
};

const sanitizeTags = (value) => {
    if (value === undefined) {
        return { isProvided: false };
    }

    if (!Array.isArray(value)) {
        return { isProvided: true, error: 'Profile tags must be an array' };
    }

    if (value.length > 20) {
        return { isProvided: true, error: 'Profile tags cannot exceed 20 items' };
    }

    const normalized = [];
    for (const rawTag of value) {
        if (typeof rawTag !== 'string') {
            return { isProvided: true, error: 'Each profile tag must be a string' };
        }
        const tag = rawTag.trim();
        if (!tag) {
            continue;
        }
        if (tag.length > 40) {
            return { isProvided: true, error: 'Each profile tag must be 40 characters or fewer' };
        }
        normalized.push(tag);
    }

    const uniqueTags = [...new Set(normalized)];
    return { isProvided: true, value: uniqueTags };
};

const sanitizePrivacy = (value, fieldName) => {
    if (value === undefined) {
        return { isProvided: false };
    }

    if (typeof value !== 'string') {
        return { isProvided: true, error: `${fieldName} must be a string` };
    }

    if (!PRIVACY_OPTIONS.includes(value)) {
        return { isProvided: true, error: `${fieldName} has an invalid value` };
    }

    return { isProvided: true, value };
};

export const validateProfileUpdatePayload = (payload = {}) => {
    // We build a dictionary of validated field results and then scan once for errors.
    const validatedFields = {
        validatedDisplayFirstName: sanitizeDisplayName(payload.displayFirstName, 'Display first name'),
        validatedDisplayLastName: sanitizeDisplayName(payload.displayLastName, 'Display last name'),
        validatedProfileTags: sanitizeTags(payload.profileTags),
    };
    // Looping over config tables keeps the validation logic consistent and scalable as we add more fields.
    for (const config of TEXT_FIELD_CONFIGS) {
        validatedFields[config.resultKey] = sanitizeTextField(payload[config.payloadKey], config.label, config.maxLength);
    }
    // Privacy fields have a different set of allowed values and error messages, so they get their own loop and sanitizer.
    for (const config of PRIVACY_FIELD_CONFIGS) {
        validatedFields[config.resultKey] = sanitizePrivacy(payload[config.payloadKey], config.label);
    }
    // Check for any validation errors across all fields and return the first one found to keep the response simple.
    const firstError = Object.values(validatedFields).find((validation) => validation.error);
    if (firstError) {
        return { isValid: false, error: firstError.error };
    }

    // Returning all validated field objects gives controllers one consistent contract:
    // check .isProvided first, then apply .value when appropriate.
    return {
        isValid: true,
        ...validatedFields,
    };
};