// The code in this file were created with help of AI (Copilot)

export const validatePassword = (password) => {
    const errors = [];

    if (typeof password !== 'string') {
        errors.push('Password must be a string');
        return {
            isValid: false,
            errors,
        };
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
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
        return { isValid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
    }

    return { isValid: true, name: trimmedName };
};
