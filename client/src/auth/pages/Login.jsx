import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBackground from "../../components/PageBackground";
import logoHome from '../../assets/logo-home.png';
import { ExclamationIcon, GoogleIcon, FacebookIcon } from '../components/AuthIcons';
import '../components/AuthStyles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [fieldErrors, setFieldErrors] = useState({
        email: '',
        password: ''
    });
    const [touched, setTouched] = useState({
        email: false,
        password: false
    });

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
    };

    const validateForm = () => {
        const errors = {};
        let isValid = true;

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
        }

        setFieldErrors(errors);
        setTouched({
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
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Login failed');
            }

            setSuccess('Login successful! Redirecting...');
            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);

        } catch (err) {
            setError(err.message || 'Invalid credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Placeholder for social login (not implemented yet)
    const handleGoogleLogin = () => {
        // TODO: Implement Google OAuth
        console.log('Google login clicked');
    };

    const handleFacebookLogin = () => {
        // TODO: Implement Facebook OAuth
        console.log('Facebook login clicked');
    };

    // Get input class names based on state
    const getInputClassName = (fieldName) => {
        const hasError = fieldErrors[fieldName] && touched[fieldName];
        const isEmailWithErrors = fieldName === 'email' && hasEmailErrors();
        const isEmpty = !formData[fieldName];

        let className = 'auth-input';
        if (hasError || isEmailWithErrors) {
            className += ' error';
        }
        if (hasError && isEmpty) {
            className += ' error-empty';
        }
        if (isEmailWithErrors) {
            className += ' error-invalid';
        }
        return className;
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
                <h1 className="auth-title">Log In</h1>

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

                    {/* Email */}
                    <div className="auth-field-group">
                        <label className="auth-label">Email</label>
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
                    <div className="auth-field-group small-margin">
                        <label className="auth-label">Password</label>
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
                        </div>
                        {fieldErrors.password && touched.password && (
                            <div className="auth-error-text">{fieldErrors.password}</div>
                        )}
                    </div>

                    {/* Forgot Password Link */}
                    <div className="auth-forgot-password">
                        <Link to="/forgot-password" className="auth-link">
                            Forgot Password?
                        </Link>
                    </div>

                    {/* Divider */}
                    <div className="auth-divider">
                        <div className="auth-divider-line" />
                        <span className="auth-divider-text">OR</span>
                        <div className="auth-divider-line" />
                    </div>

                    {/* Social Login Buttons */}
                    <div className="social-buttons-container">
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="social-btn google"
                        >
                            <GoogleIcon />
                            <span>Log In with Google</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleFacebookLogin}
                            className="social-btn facebook"
                        >
                            <FacebookIcon />
                            <span>Log In with Facebook</span>
                        </button>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="auth-submit-btn"
                    >
                        {isLoading ? 'Logging In...' : 'Log In'}
                    </button>
                </form>

                {/* Create Account Link */}
                <p className="auth-footer-text">
                    Not a Member?{' '}
                    <Link to="/signup" className="auth-link">
                        Create Account
                    </Link>
                </p>
            </div>
        </PageBackground>
    );
};

export default Login;