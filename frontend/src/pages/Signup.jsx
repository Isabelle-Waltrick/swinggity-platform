import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBackground from "../components/PageBackground";
import logoHome from '../assets/logo-home.png';

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
            const response = await fetch('http://localhost:5000/api/auth/signup', {
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

    // Exclamation mark icon component
    const ExclamationIcon = ({ position = 'left' }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#FF5454" strokeWidth="2" fill="none" />
            <line x1="12" y1="7" x2="12" y2="13" stroke="#FF5454" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#FF5454" />
        </svg>
    );

    const getInputStyle = (fieldName) => {
        const hasError = fieldErrors[fieldName] && touched[fieldName];
        const isPasswordWithErrors = fieldName === 'password' && hasPasswordErrors();
        const isEmailWithErrors = fieldName === 'email' && hasEmailErrors();
        const showError = hasError || isPasswordWithErrors || isEmailWithErrors;

        return {
            width: '100%',
            padding: '0.75rem 1rem',
            paddingLeft: (hasError && fieldName !== 'password' && fieldName !== 'email') ? '2.5rem' : '1rem',
            paddingRight: (isPasswordWithErrors || isEmailWithErrors) ? '2.5rem' : '1rem',
            fontSize: '1rem',
            border: `2px solid ${showError ? '#FF5454' : '#222'}`,
            borderRadius: '8px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
            backgroundColor: '#fff',
            minHeight: '50px'
        };
    };

    const labelStyle = {
        display: 'block',
        fontSize: '1rem',
        fontWeight: 400,
        marginBottom: '0.5rem',
        color: '#000',
        textAlign: 'left',
        fontFamily: '"Sora", Helvetica, sans-serif'
    };

    const errorTextStyle = {
        fontSize: '12px',
        fontWeight: 600,
        color: '#000',
        marginTop: '0.5rem',
        textAlign: 'left',
        fontFamily: '"Sora", Helvetica, sans-serif'
    };

    const inputWrapperStyle = {
        position: 'relative',
        width: '100%'
    };

    const iconStyle = {
        position: 'absolute',
        left: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const iconStyleRight = {
        position: 'absolute',
        right: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    // Style for password requirement items
    const getRequirementStyle = (isValid) => ({
        color: touched.password && formData.password.length > 0 && !isValid ? '#FF5454' : '#000',
        textDecoration: touched.password && formData.password.length > 0 && !isValid ? 'underline' : 'none',
        fontWeight: touched.password && formData.password.length > 0 && !isValid ? 600 : 400,
        fontFamily: '"Sora", Helvetica, sans-serif'
    });

    return (
        <PageBackground>
            <div style={{
                width: '100%',
                maxWidth: '524px',
                margin: '0 auto',
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '2px solid #000',
                boxShadow: '-2px 4px 0px 0px rgba(0, 0, 0, 1)'
            }}>
                {/* Logo */}
                <img
                    src={logoHome}
                    alt="Swinggity"
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        marginBottom: '37px'
                    }}
                />

                {/* Title */}
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: '#222',
                    textAlign: 'center',
                    marginBottom: '37px',
                    fontFamily: '"Sora", Helvetica, sans-serif'
                }}>
                    Register
                </h1>

                <form onSubmit={handleSubmit}>
                    {/* General Error Message */}
                    {error && (
                        <div style={{
                            backgroundColor: '#FFE6E6',
                            color: '#D63031',
                            padding: '1rem',
                            borderRadius: '8px',
                            marginBottom: '1.5rem',
                            fontSize: '0.95rem',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div style={{
                            backgroundColor: '#E6FFE6',
                            color: '#00B894',
                            padding: '1rem',
                            borderRadius: '8px',
                            marginBottom: '1.5rem',
                            fontSize: '0.95rem',
                            textAlign: 'center'
                        }}>
                            {success}
                        </div>
                    )}

                    {/* First Name & Last Name Row */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '24px',
                        marginBottom: '24px'
                    }}>
                        {/* First Name */}
                        <div>
                            <label style={labelStyle}>
                                First Name <span style={{ color: '#FF5454' }}>*</span>
                            </label>
                            <div style={inputWrapperStyle}>
                                {fieldErrors.firstName && touched.firstName && (
                                    <div style={iconStyle}>
                                        <ExclamationIcon />
                                    </div>
                                )}
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={getInputStyle('firstName')}
                                />
                            </div>
                            {fieldErrors.firstName && touched.firstName && (
                                <div style={errorTextStyle}>{fieldErrors.firstName}</div>
                            )}
                        </div>

                        {/* Last Name */}
                        <div>
                            <label style={labelStyle}>
                                Last Name <span style={{ color: '#FF5454' }}>*</span>
                            </label>
                            <div style={inputWrapperStyle}>
                                {fieldErrors.lastName && touched.lastName && (
                                    <div style={iconStyle}>
                                        <ExclamationIcon />
                                    </div>
                                )}
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={getInputStyle('lastName')}
                                />
                            </div>
                            {fieldErrors.lastName && touched.lastName && (
                                <div style={errorTextStyle}>{fieldErrors.lastName}</div>
                            )}
                        </div>
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>
                            Email <span style={{ color: '#FF5454' }}>*</span>
                        </label>
                        <div style={inputWrapperStyle}>
                            {fieldErrors.email && touched.email && !formData.email && (
                                <div style={iconStyle}>
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                style={getInputStyle('email')}
                            />
                            {hasEmailErrors() && (
                                <div style={iconStyleRight}>
                                    <ExclamationIcon />
                                </div>
                            )}
                        </div>
                        {fieldErrors.email && touched.email && (
                            <div style={errorTextStyle}>{fieldErrors.email}</div>
                        )}
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>
                            Password <span style={{ color: '#FF5454' }}>*</span>
                        </label>
                        <div style={inputWrapperStyle}>
                            {fieldErrors.password && touched.password && !formData.password && (
                                <div style={iconStyle}>
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                style={getInputStyle('password')}
                            />
                            {hasPasswordErrors() && (
                                <div style={iconStyleRight}>
                                    <ExclamationIcon />
                                </div>
                            )}
                        </div>
                        {fieldErrors.password && touched.password && !formData.password && (
                            <div style={errorTextStyle}>{fieldErrors.password}</div>
                        )}
                        {hasPasswordErrors() && (
                            <div style={errorTextStyle}>Please fix the following:</div>
                        )}
                    </div>

                    {/* Password Requirements */}
                    <div style={{
                        textAlign: 'left',
                        marginBottom: '37px',
                        color: '#000',
                        fontFamily: '"Sora", Helvetica, sans-serif',
                        fontSize: '20px',
                        lineHeight: '30px'
                    }}>
                        <span style={{ fontWeight: 400 }}>Password must contain:</span>
                        <ul style={{
                            margin: '0.5rem 0 0 0',
                            paddingLeft: '1.5rem',
                            listStyleType: 'disc'
                        }}>
                            <li style={getRequirementStyle(passwordValidation.minLength)}>
                                At least 8 characters.
                            </li>
                            <li style={getRequirementStyle(passwordValidation.hasUppercase)}>
                                At least one uppercase letter.
                            </li>
                            <li style={getRequirementStyle(passwordValidation.hasLowercase)}>
                                At least one lowercase letter.
                            </li>
                            <li style={getRequirementStyle(passwordValidation.hasNumber)}>
                                At least one number.
                            </li>
                            <li style={getRequirementStyle(passwordValidation.hasSpecial)}>
                                At least one special character (e.g. !@#$%^&*)
                            </li>
                        </ul>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            backgroundColor: isLoading ? '#666' : 'var(--colour-brand-secondary, #000)',
                            color: 'var(--colour-base-base, #fff)',
                            fontFamily: '"Sora", Helvetica, sans-serif',
                            fontSize: '20px',
                            fontWeight: 600,
                            padding: '17px 0',
                            border: '1px solid #000000',
                            borderRadius: '50px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            boxShadow: '-2px 2px 0px 0px rgba(0, 0, 0, 1)',
                            opacity: isLoading ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '-3px 5px 0px 0px rgba(0, 0, 0, 1)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '-2px 2px 0px 0px rgba(0, 0, 0, 1)';
                        }}
                    >
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                {/* Sign In Link */}
                <p style={{
                    textAlign: 'center',
                    marginTop: '37px',
                    fontSize: '20px',
                    color: '#000',
                    fontFamily: '"Sora", Helvetica, sans-serif',
                    fontWeight: 400,
                    lineHeight: '20px'
                }}>
                    Already a Member?{' '}
                    <Link
                        to="/login"
                        style={{
                            color: '#FF6699',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        Sign In
                    </Link>
                </p>
            </div>
        </PageBackground>
    );
};

export default Signup;