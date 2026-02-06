import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageBackground from "../../components/PageBackground";
import logoHome from '../../assets/logo-home.png';
import { ExclamationIcon, ApprovedMailIcon } from '../components/AuthIcons';
import '../components/AuthStyles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
            const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
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

        } catch {
            // For security, we show success even if email doesn't exist
            // This prevents email enumeration attacks
            setIsSubmitted(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Get input class names based on state
    const getInputClassName = () => {
        const hasError = fieldError && touched;
        const isEmpty = !email;

        let className = 'auth-input';
        if (hasError || hasEmailErrors()) {
            className += ' error';
        }
        if (hasError && isEmpty) {
            className += ' error-empty';
        }
        if (hasEmailErrors()) {
            className += ' error-invalid';
        }
        return className;
    };

    // Success state - Reset Link Sent
    if (isSubmitted) {
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
                    <h1 className="auth-title no-margin">Reset Link Sent</h1>

                    {/* Icon */}
                    <div className="auth-icon-center">
                        <ApprovedMailIcon />
                    </div>

                    {/* Description */}
                    <p className="auth-description">
                        If an account exists for {email}, you will receive a password reset link shortly.
                    </p>

                    {/* Back to Login */}
                    <div className="auth-back-link">
                        <Link to="/login" className="auth-link">
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
            <div className="auth-form-container with-gap">
                {/* Logo */}
                <img
                    src={logoHome}
                    alt="Swinggity"
                    className="auth-logo no-margin"
                />

                {/* Title */}
                <h1 className="auth-title no-margin">Forgot password</h1>

                {/* Description */}
                <p className="auth-description">
                    Enter your email address and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit} className="auth-form">
                    {/* General Error Message */}
                    {error && (
                        <div className="auth-message error">
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label className="auth-label">Email</label>
                        <div className="auth-input-wrapper">
                            {fieldError && touched && !email && (
                                <div className="auth-icon-left">
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="email"
                                name="email"
                                value={email}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={getInputClassName()}
                            />
                            {hasEmailErrors() && (
                                <div className="auth-icon-right">
                                    <ExclamationIcon />
                                </div>
                            )}
                        </div>
                        {fieldError && touched && (
                            <div className="auth-error-text">{fieldError}</div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="auth-submit-btn"
                    >
                        {isLoading ? 'Sending...' : 'Send Request Link'}
                    </button>
                </form>

                {/* Back to Login */}
                <div className="auth-back-link">
                    <Link to="/login" className="auth-link">
                        ← Back to login
                    </Link>
                </div>
            </div>
        </PageBackground>
    );
};

export default ForgotPassword;