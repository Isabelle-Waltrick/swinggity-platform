import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBackground from "../components/PageBackground";
import logoHome from '../assets/logo-home.png';

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
            const response = await fetch('http://localhost:5000/api/auth/login', {
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

    // Exclamation mark icon component
    const ExclamationIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#FF5454" strokeWidth="2" fill="none" />
            <line x1="12" y1="7" x2="12" y2="13" stroke="#FF5454" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#FF5454" />
        </svg>
    );

    // Google icon component
    const GoogleIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );

    // Facebook icon component
    const FacebookIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="11" fill="#1877F2" />
            <path d="M16.5 12.5h-3v8h-3v-8h-2v-3h2V7.5c0-2.5 1.5-4 4-4h2v3h-1.5c-.5 0-1 .5-1 1v2h2.5l-.5 3z" fill="white" />
        </svg>
    );

    const getInputStyle = (fieldName) => {
        const hasError = fieldErrors[fieldName] && touched[fieldName];
        const isEmailWithErrors = fieldName === 'email' && hasEmailErrors();
        const showError = hasError || isEmailWithErrors;

        return {
            width: '100%',
            padding: '0.75rem 1rem',
            paddingLeft: (hasError && !formData[fieldName]) ? '2.5rem' : '1rem',
            paddingRight: isEmailWithErrors ? '2.5rem' : '1rem',
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

    const socialButtonStyle = {
        width: '100%',
        backgroundColor: '#fff',
        border: '1px solid #000',
        borderRadius: '20px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        cursor: 'pointer',
        fontFamily: '"Sora", Helvetica, sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        color: '#000',
        boxShadow: '-1px 1px 0px 0px rgba(0, 0, 0, 1)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        minHeight: '40px'
    };

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
                boxSizing: 'border-box'
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
                    fontSize: '40px',
                    fontWeight: 600,
                    color: '#000',
                    textAlign: 'center',
                    marginBottom: '37px',
                    fontFamily: '"Sora", Helvetica, sans-serif'
                }}>
                    Log In
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

                    {/* Email */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Email</label>
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
                    <div style={{ marginBottom: '8px' }}>
                        <label style={labelStyle}>Password</label>
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
                        </div>
                        {fieldErrors.password && touched.password && (
                            <div style={errorTextStyle}>{fieldErrors.password}</div>
                        )}
                    </div>

                    {/* Forgot Password Link */}
                    <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                        <Link
                            to="/forgot-password"
                            style={{
                                color: '#FF6699',
                                fontFamily: '"Sora", Helvetica, sans-serif',
                                fontSize: '20px',
                                fontWeight: 600,
                                textDecoration: 'none'
                            }}
                        >
                            Forgot Password?
                        </Link>
                    </div>

                    {/* Divider */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '24px 0',
                        gap: '16px'
                    }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#000' }} />
                        <span style={{
                            fontFamily: '"Sora", Helvetica, sans-serif',
                            fontSize: '20px',
                            fontWeight: 400,
                            color: '#000'
                        }}>
                            OR
                        </span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#000' }} />
                    </div>

                    {/* Social Login Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            style={socialButtonStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '-2px 2px 0px 0px rgba(0, 0, 0, 1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '-1px 1px 0px 0px rgba(0, 0, 0, 1)';
                            }}
                        >
                            <GoogleIcon />
                            <span>Log In with Google</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleFacebookLogin}
                            style={socialButtonStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '-2px 2px 0px 0px rgba(0, 0, 0, 1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '-1px 1px 0px 0px rgba(0, 0, 0, 1)';
                            }}
                        >
                            <FacebookIcon />
                            <span>Log In with Facebook</span>
                        </button>
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
                        {isLoading ? 'Logging In...' : 'Log In'}
                    </button>
                </form>

                {/* Create Account Link */}
                <p style={{
                    textAlign: 'center',
                    marginTop: '37px',
                    fontSize: '20px',
                    color: '#000',
                    fontFamily: '"Sora", Helvetica, sans-serif',
                    fontWeight: 400,
                    lineHeight: '20px'
                }}>
                    Not a Member?{' '}
                    <Link
                        to="/signup"
                        style={{
                            color: '#FF6699',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        Create Account
                    </Link>
                </p>
            </div>
        </PageBackground>
    );
};

export default Login;