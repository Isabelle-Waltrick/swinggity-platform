import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageBackground from "../../components/PageBackground";
import logoHome from '../../assets/logo-home.png';
import { ExclamationIcon } from '../components/AuthIcons';
import { csrfFetch, fetchCsrfToken } from '../../utils/csrf';
import '../components/AuthStyles.css';

// Constant-time string comparison to prevent timing attacks
const constantTimeCompare = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    const lenA = a.length;
    const lenB = b.length;
    // Use the longer length to avoid leaking length information
    const maxLen = Math.max(lenA, lenB);
    let result = lenA ^ lenB; // Will be non-zero if lengths differ
    for (let i = 0; i < maxLen; i++) {
        const charA = i < lenA ? a.charCodeAt(i) : 0;
        const charB = i < lenB ? b.charCodeAt(i) : 0;
        result |= charA ^ charB;
    }
    return result === 0;
};

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [fieldErrors, setFieldErrors] = useState({
        password: '',
        confirmPassword: ''
    });
    const [touched, setTouched] = useState({
        password: false,
        confirmPassword: false
    });

    // Password validation state
    const [passwordValidation, setPasswordValidation] = useState({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false
    });

    // Fetch CSRF token on component mount
    useEffect(() => {
        fetchCsrfToken().catch(err => {
            console.error('Failed to fetch CSRF token:', err);
        });
    }, []);

    // Validate password against all rules
    const validatePassword = (password) => {
        return {
            minLength: password.length >= 8,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
    };

    // Check if password has validation errors
    const hasPasswordErrors = () => {
        const { minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial } = passwordValidation;
        return touched.password && formData.password.length > 0 &&
            (!minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial);
    };

    // Check if confirm password has errors
    const hasConfirmPasswordErrors = () => {
        return touched.confirmPassword && formData.confirmPassword.length > 0 &&
            !constantTimeCompare(formData.confirmPassword, formData.password);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setError('');

        // Clear field error when user starts typing
        if (value.trim()) {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }

        if (name === 'password') {
            setPasswordValidation(validatePassword(value));
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));

        if (!value.trim()) {
            setFieldErrors(prev => ({ ...prev, [name]: 'This field is mandatory.' }));
        } else if (name === 'confirmPassword' && !constantTimeCompare(value, formData.password)) {
            setFieldErrors(prev => ({ ...prev, [name]: 'Passwords do not match.' }));
        } else {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }

        if (name === 'password') {
            setPasswordValidation(validatePassword(value));
        }
    };

    const validateForm = () => {
        const errors = {};
        let isValid = true;

        if (!formData.password.trim()) {
            errors.password = 'This field is mandatory.';
            isValid = false;
        } else {
            const pwValidation = validatePassword(formData.password);
            if (!pwValidation.minLength || !pwValidation.hasUppercase ||
                !pwValidation.hasLowercase || !pwValidation.hasNumber || !pwValidation.hasSpecial) {
                errors.password = 'Password does not meet requirements.';
                isValid = false;
            }
        }

        if (!formData.confirmPassword.trim()) {
            errors.confirmPassword = 'This field is mandatory.';
            isValid = false;
        } else if (!constantTimeCompare(formData.confirmPassword, formData.password)) {
            errors.confirmPassword = 'Passwords do not match.';
            isValid = false;
        }

        setFieldErrors(errors);
        setTouched({
            password: true,
            confirmPassword: true
        });

        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await csrfFetch(`${API_URL}/api/auth/reset-password/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: formData.password }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to reset password');
            }

            setSuccess('Password reset successful! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Get input class names based on state
    const getInputClassName = (fieldName) => {
        const hasError = fieldErrors[fieldName] && touched[fieldName];
        const isPasswordWithErrors = fieldName === 'password' && hasPasswordErrors();
        const isConfirmWithErrors = fieldName === 'confirmPassword' && hasConfirmPasswordErrors();
        const isEmpty = !formData[fieldName];

        let className = 'auth-input';
        if (hasError || isPasswordWithErrors || isConfirmWithErrors) {
            className += ' error';
        }
        if (hasError && isEmpty) {
            className += ' error-empty';
        }
        if (isPasswordWithErrors || isConfirmWithErrors) {
            className += ' error-invalid';
        }
        return className;
    };

    // Get requirement class based on validation
    const getRequirementClass = (isValid) => {
        return touched.password && formData.password.length > 0 && !isValid ? 'invalid' : '';
    };

    return (
        <PageBackground>
            <div className="auth-form-container with-gap">
                {/* Logo */}
                <img
                    src={logoHome}
                    alt="Swinggity"
                    className="auth-logo no-margin"
                />

                {/* Title */}
                <h1 className="auth-title no-margin">Reset Password</h1>

                <form onSubmit={handleSubmit} className="auth-form">
                    {/* General Error Message */}
                    {error && (
                        <div className="auth-message error">
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="auth-message success">
                            {success}
                        </div>
                    )}

                    {/* New Password */}
                    <div>
                        <label className="auth-label">New password</label>
                        <div className="auth-input-wrapper">
                            {fieldErrors.password && touched.password && !formData.password && (
                                <div className="auth-icon-left">
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={getInputClassName('password')}
                            />
                            {hasPasswordErrors() && (
                                <div className="auth-icon-right">
                                    <ExclamationIcon />
                                </div>
                            )}
                        </div>
                        {fieldErrors.password && touched.password && !formData.password && (
                            <div className="auth-error-text">{fieldErrors.password}</div>
                        )}
                        {hasPasswordErrors() && (
                            <div className="auth-error-text">Please fix the following:</div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="auth-label">Confirm new password</label>
                        <div className="auth-input-wrapper">
                            {fieldErrors.confirmPassword && touched.confirmPassword && !formData.confirmPassword && (
                                <div className="auth-icon-left">
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={getInputClassName('confirmPassword')}
                            />
                            {hasConfirmPasswordErrors() && (
                                <div className="auth-icon-right">
                                    <ExclamationIcon />
                                </div>
                            )}
                        </div>
                        {fieldErrors.confirmPassword && touched.confirmPassword && (
                            <div className="auth-error-text">{fieldErrors.confirmPassword}</div>
                        )}
                    </div>

                    {/* Password Requirements */}
                    <div className="auth-password-requirements small">
                        <span>Password must contain:</span>
                        <ul>
                            <li className={getRequirementClass(passwordValidation.minLength)}>
                                At least 8 characters.
                            </li>
                            <li className={getRequirementClass(passwordValidation.hasUppercase)}>
                                At least one uppercase letter.
                            </li>
                            <li className={getRequirementClass(passwordValidation.hasLowercase)}>
                                At least one lowercase letter.
                            </li>
                            <li className={getRequirementClass(passwordValidation.hasNumber)}>
                                At least one number.
                            </li>
                            <li className={getRequirementClass(passwordValidation.hasSpecial)}>
                                At least one special character (e.g. !@#$%^&*)
                            </li>
                        </ul>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="auth-submit-btn"
                    >
                        {isLoading ? 'Resetting...' : 'Set New Password'}
                    </button>
                </form>
            </div>
        </PageBackground>
    );
};

export default ResetPassword;