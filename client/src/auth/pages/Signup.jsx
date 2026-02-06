import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBackground from "../../components/PageBackground";
import logoHome from '../../assets/logo-home.png';
import { ExclamationIcon } from '../components/AuthIcons';
import '../components/AuthStyles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Signup = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [fieldErrors, setFieldErrors] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: ''
    });
    const [touched, setTouched] = useState({
        firstName: false,
        lastName: false,
        email: false,
        password: false
    });

    // Password validation state
    const [passwordValidation, setPasswordValidation] = useState({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false
    });

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

    // Check if password has any validation errors
    const hasPasswordErrors = () => {
        const { minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial } = passwordValidation;
        return touched.password && formData.password.length > 0 &&
            (!minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial);
    };

    // Validate email format
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Check if email has validation errors
    const hasEmailErrors = () => {
        return touched.email && formData.email.length > 0 && !validateEmail(formData.email);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setError('');

        // Clear field error when user starts typing
        if (value.trim()) {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Validate password in real-time
        if (name === 'password') {
            setPasswordValidation(validatePassword(value));
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));

        // Validate on blur
        if (!value.trim()) {
            setFieldErrors(prev => ({ ...prev, [name]: 'This field is mandatory.' }));
        } else if (name === 'email' && !validateEmail(value)) {
            setFieldErrors(prev => ({ ...prev, [name]: 'Please enter a valid email address.' }));
        } else {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Update password validation on blur
        if (name === 'password') {
            setPasswordValidation(validatePassword(value));
        }
    };

    const validateForm = () => {
        const errors = {};
        let isValid = true;

        if (!formData.firstName.trim()) {
            errors.firstName = 'This field is mandatory.';
            isValid = false;
        }
        if (!formData.lastName.trim()) {
            errors.lastName = 'This field is mandatory.';
            isValid = false;
        }
        if (!formData.email.trim()) {
            errors.email = 'This field is mandatory.';
            isValid = false;
        } else if (!validateEmail(formData.email)) {
            errors.email = 'Please enter a valid email address.';
            isValid = false;
        }
        if (!formData.password.trim()) {
            errors.password = 'This field is mandatory.';
            isValid = false;
        } else {
            // Check password requirements
            const pwValidation = validatePassword(formData.password);
            if (!pwValidation.minLength || !pwValidation.hasUppercase ||
                !pwValidation.hasLowercase || !pwValidation.hasNumber || !pwValidation.hasSpecial) {
                errors.password = 'Password does not meet requirements.';
                isValid = false;
            }
        }

        setFieldErrors(errors);
        setTouched({
            firstName: true,
            lastName: true,
            email: true,
            password: true
        });

        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate all fields before submission
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`${API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Signup failed');
            }

            setSuccess('Account created successfully! Please check your email for verification.');
            setTimeout(() => {
                navigate('/verify-email');
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
        const isEmailWithErrors = fieldName === 'email' && hasEmailErrors();
        const isEmpty = !formData[fieldName];

        let className = 'auth-input';
        if (hasError || isPasswordWithErrors || isEmailWithErrors) {
            className += ' error';
        }
        if (hasError && isEmpty && fieldName !== 'password' && fieldName !== 'email') {
            className += ' error-empty';
        }
        if (isPasswordWithErrors || isEmailWithErrors) {
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
            <div className="auth-form-container">
                {/* Logo */}
                <img
                    src={logoHome}
                    alt="Swinggity"
                    className="auth-logo"
                />

                {/* Title */}
                <h1 className="auth-title">Register</h1>

                <form onSubmit={handleSubmit}>
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

                    {/* First Name & Last Name Row */}
                    <div className="auth-name-grid">
                        {/* First Name */}
                        <div>
                            <label className="auth-label">
                                First Name <span className="auth-required">*</span>
                            </label>
                            <div className="auth-input-wrapper">
                                {fieldErrors.firstName && touched.firstName && (
                                    <div className="auth-icon-left">
                                        <ExclamationIcon />
                                    </div>
                                )}
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={getInputClassName('firstName')}
                                />
                            </div>
                            {fieldErrors.firstName && touched.firstName && (
                                <div className="auth-error-text">{fieldErrors.firstName}</div>
                            )}
                        </div>

                        {/* Last Name */}
                        <div>
                            <label className="auth-label">
                                Last Name <span className="auth-required">*</span>
                            </label>
                            <div className="auth-input-wrapper">
                                {fieldErrors.lastName && touched.lastName && (
                                    <div className="auth-icon-left">
                                        <ExclamationIcon />
                                    </div>
                                )}
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={getInputClassName('lastName')}
                                />
                            </div>
                            {fieldErrors.lastName && touched.lastName && (
                                <div className="auth-error-text">{fieldErrors.lastName}</div>
                            )}
                        </div>
                    </div>

                    {/* Email */}
                    <div className="auth-field-group">
                        <label className="auth-label">
                            Email <span className="auth-required">*</span>
                        </label>
                        <div className="auth-input-wrapper">
                            {fieldErrors.email && touched.email && !formData.email && (
                                <div className="auth-icon-left">
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={getInputClassName('email')}
                            />
                            {hasEmailErrors() && (
                                <div className="auth-icon-right">
                                    <ExclamationIcon />
                                </div>
                            )}
                        </div>
                        {fieldErrors.email && touched.email && (
                            <div className="auth-error-text">{fieldErrors.email}</div>
                        )}
                    </div>

                    {/* Password */}
                    <div className="auth-field-group">
                        <label className="auth-label">
                            Password <span className="auth-required">*</span>
                        </label>
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

                    {/* Password Requirements */}
                    <div className="auth-password-requirements" style={{ marginBottom: '37px' }}>
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
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                {/* Sign In Link */}
                <p className="auth-footer-text">
                    Already a Member?{' '}
                    <Link to="/login" className="auth-link">
                        Sign In
                    </Link>
                </p>
            </div>
        </PageBackground>
    );
};

export default Signup;