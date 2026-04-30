// The code in this file were created with help of AI (Copilot)

// GSR01: centralised server-side validation for authentication inputs.
// validatePassword, validateEmail, and validateName are called from auth.controllers.js
// before any data reaches the database, ensuring all auth input is validated on the trusted server layer.

export const validatePassword = (password) => {
    const errors = [];

    // SSR07: password is verified exactly as entered (no trimming/normalization before
    // validation or hashing), with explicit length bounds enforced server-side: min 8,
    // max 30 characters.

    if (typeof password !== 'string') {
        // GSR02: unexpected type is rejected immediately rather than coerced.
        errors.push('Password must be a string');
        return {
            isValid: false,
            errors,
        };
    }

    // SSR02 (NOT IMPLEMENTED): the password is not checked against a common password list.
    // A denylist check (e.g. a bundled top-10k list, or the HaveIBeenPwned Passwords API)
    // should be added here to reject passwords like 'Password1!' that pass complexity rules
    // but are trivially guessable.

    // SSR03 (NOT IMPLEMENTED): the password is not checked for context-specific words.
    // Passwords containing the app name ('swinggity'), the user's first/last name, or the local part of their email address should be rejected. 
    // validatePassword would need to accept the user context (firstName, lastName, email) as additional arguments to do this.

    // SSR01: minimum password length of 8 characters enforced server-side.
    // Additional complexity rules (uppercase, lowercase, number, special character)
    // are enforced in the same pass, exceeding the bare minimum requirement.
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 30) {
        errors.push('Password must be 30 characters or fewer');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

export const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!email || typeof email !== 'string') {
        return { isValid: false, error: 'Email is required' };
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail.length === 0) {
        return { isValid: false, error: 'Email is required' };
    }

    if (trimmedEmail.length > 254) {
        return { isValid: false, error: 'Email address is too long' };
    }

    if (!emailRegex.test(trimmedEmail)) {
        // GSR02: emails that don't match the expected format are rejected, not auto-corrected.
        return { isValid: false, error: 'Please enter a valid email address' };
    }

    return { isValid: true, email: trimmedEmail };
};

export const validateName = (name, fieldName) => {
    if (!name || typeof name !== 'string') {
        return { isValid: false, error: `${fieldName} is required` };
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
        return { isValid: false, error: `${fieldName} is required` };
    }

    if (trimmedName.length < 2) {
        return { isValid: false, error: `${fieldName} must be at least 2 characters long` };
    }

    if (trimmedName.length > 50) {
        return { isValid: false, error: `${fieldName} must be less than 50 characters` };
    }

    if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
        // GSR02: names containing unexpected characters are rejected, not stripped.
        return { isValid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
    }

    return { isValid: true, name: trimmedName };
};
