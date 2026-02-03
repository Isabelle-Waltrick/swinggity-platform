import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageBackground from "../components/PageBackground";
import logoHome from '../assets/logo-home.png';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const [touched, setTouched] = useState(false);

    // Validate email format
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Check if email has validation errors
    const hasEmailErrors = () => {
        return touched && email.length > 0 && !validateEmail(email);
    };

    const handleChange = (e) => {
        setEmail(e.target.value);
        setError('');
        if (e.target.value.trim()) {
            setFieldError('');
        }
    };

    const handleBlur = () => {
        setTouched(true);
        if (!email.trim()) {
            setFieldError('This field is mandatory.');
        } else if (!validateEmail(email)) {
            setFieldError('Please enter a valid email address.');
        } else {
            setFieldError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched(true);

        // Validate email
        if (!email.trim()) {
            setFieldError('This field is mandatory.');
            return;
        }
        if (!validateEmail(email)) {
            setFieldError('Please enter a valid email address.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to send reset link');
            }

            setIsSubmitted(true);

        } catch (err) {
            // For security, we show success even if email doesn't exist
            // This prevents email enumeration attacks
            setIsSubmitted(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Exclamation mark icon component
    const ExclamationIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#FF5454" strokeWidth="2" fill="none" />
            <line x1="12" y1="7" x2="12" y2="13" stroke="#FF5454" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#FF5454" />
        </svg>
    );

    // Approved Mail icon component
    const ApprovedMailIcon = () => (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="16" width="64" height="48" rx="4" stroke="#3CD39D" strokeWidth="4" fill="none" />
            <path d="M8 24L40 44L72 24" stroke="#3CD39D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M52 52L60 60L76 44" stroke="#3CD39D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

    const getInputStyle = () => {
        const hasError = fieldError && touched;
        const showError = hasError || hasEmailErrors();

        return {
            width: '100%',
            padding: '0.75rem 1rem',
            paddingLeft: (hasError && !email) ? '2.5rem' : '1rem',
            paddingRight: hasEmailErrors() ? '2.5rem' : '1rem',
            fontSize: '1rem',
            border: `2px solid ${showError ? '#FF5454' : '#000'}`,
            borderRadius: '8px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
            backgroundColor: '#fff',
            minHeight: '50px',
            fontFamily: '"Sora", Helvetica, sans-serif'
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

    // Success state - Reset Link Sent
    if (isSubmitted) {
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
                    boxShadow: '-2px 4px 0px 0px rgba(0, 0, 0, 1)',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '37px'
                }}>
                    {/* Logo */}
                    <img
                        src={logoHome}
                        alt="Swinggity"
                        style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block'
                        }}
                    />

                    {/* Title */}
                    <h1 style={{
                        fontSize: '40px',
                        fontWeight: 600,
                        color: '#000',
                        textAlign: 'center',
                        margin: 0,
                        fontFamily: '"Sora", Helvetica, sans-serif'
                    }}>
                        Reset Link Sent
                    </h1>

                    {/* Icon */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <ApprovedMailIcon />
                    </div>

                    {/* Description */}
                    <p style={{
                        fontSize: '20px',
                        fontWeight: 400,
                        color: '#000',
                        textAlign: 'center',
                        margin: 0,
                        lineHeight: '30px',
                        fontFamily: '"Sora", Helvetica, sans-serif'
                    }}>
                        If an account exists for {email}, you will receive a password reset link shortly.
                    </p>

                    {/* Back to Login */}
                    <div style={{ textAlign: 'right' }}>
                        <Link
                            to="/login"
                            style={{
                                color: '#FF6699',
                                fontFamily: '"Sora", Helvetica, sans-serif',
                                fontSize: '20px',
                                fontWeight: 600,
                                textDecoration: 'none'
                            }}
                        >
                            ← Back to login
                        </Link>
                    </div>
                </div>
            </PageBackground>
        );
    }

    // Default state - Forgot Password form
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
                boxShadow: '-2px 4px 0px 0px rgba(0, 0, 0, 1)',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '37px'
            }}>
                {/* Logo */}
                <img
                    src={logoHome}
                    alt="Swinggity"
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block'
                    }}
                />

                {/* Title */}
                <h1 style={{
                    fontSize: '40px',
                    fontWeight: 600,
                    color: '#000',
                    textAlign: 'center',
                    margin: 0,
                    fontFamily: '"Sora", Helvetica, sans-serif'
                }}>
                    Forgot password
                </h1>

                {/* Description */}
                <p style={{
                    fontSize: '20px',
                    fontWeight: 400,
                    color: '#000',
                    textAlign: 'center',
                    margin: 0,
                    lineHeight: '30px',
                    fontFamily: '"Sora", Helvetica, sans-serif'
                }}>
                    Enter your email address and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '37px' }}>
                    {/* General Error Message */}
                    {error && (
                        <div style={{
                            backgroundColor: '#FFE6E6',
                            color: '#D63031',
                            padding: '1rem',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label style={labelStyle}>Email</label>
                        <div style={inputWrapperStyle}>
                            {fieldError && touched && !email && (
                                <div style={iconStyle}>
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="email"
                                name="email"
                                value={email}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                style={getInputStyle()}
                            />
                            {hasEmailErrors() && (
                                <div style={iconStyleRight}>
                                    <ExclamationIcon />
                                </div>
                            )}
                        </div>
                        {fieldError && touched && (
                            <div style={errorTextStyle}>{fieldError}</div>
                        )}
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
                        {isLoading ? 'Sending...' : 'Send Request Link'}
                    </button>
                </form>

                {/* Back to Login */}
                <div style={{ textAlign: 'right' }}>
                    <Link
                        to="/login"
                        style={{
                            color: '#FF6699',
                            fontFamily: '"Sora", Helvetica, sans-serif',
                            fontSize: '20px',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        ← Back to login
                    </Link>
                </div>
            </div>
        </PageBackground>
    );
};

export default ForgotPassword;