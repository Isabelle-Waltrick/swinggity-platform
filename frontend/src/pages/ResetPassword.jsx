import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageBackground from "../components/PageBackground";
import logoHome from '../assets/logo-home.png';

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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setError('');

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
        } else if (name === 'confirmPassword' && value !== formData.password) {
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
        } else if (formData.confirmPassword !== formData.password) {
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
            const response = await fetch(`http://localhost:5000/api/auth/reset-password/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
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

    // Exclamation mark icon component
    const ExclamationIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#FF5454" strokeWidth="2" fill="none" />
            <line x1="12" y1="7" x2="12" y2="13" stroke="#FF5454" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#FF5454" />
        </svg>
    );

    const getInputStyle = (fieldName) => {
        const hasError = fieldErrors[fieldName] && touched[fieldName];
        const { minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial } = passwordValidation;
        const isPasswordWithErrors = fieldName === 'password' && touched.password && formData.password.length > 0 &&
            (!minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial);
        const isConfirmPasswordWithErrors = fieldName === 'confirmPassword' && touched.confirmPassword &&
            formData.confirmPassword.length > 0 && formData.confirmPassword !== formData.password;
        const showError = hasError || isPasswordWithErrors || isConfirmPasswordWithErrors;

        return {
            width: '100%',
            padding: '0.75rem 1rem',
            paddingLeft: (hasError && !formData[fieldName]) ? '2.5rem' : '1rem',
            paddingRight: (isPasswordWithErrors || isConfirmPasswordWithErrors) ? '2.5rem' : '1rem',
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
                    Reset Password
                </h1>

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

                    {/* Success Message */}
                    {success && (
                        <div style={{
                            backgroundColor: '#E6FFE6',
                            color: '#00B894',
                            padding: '1rem',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            textAlign: 'center'
                        }}>
                            {success}
                        </div>
                    )}

                    {/* New Password */}
                    <div>
                        <label style={labelStyle}>New password</label>
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
                            {touched.password && formData.password.length > 0 &&
                                (!passwordValidation.minLength || !passwordValidation.hasUppercase || !passwordValidation.hasLowercase || !passwordValidation.hasNumber || !passwordValidation.hasSpecial) && (
                                    <div style={iconStyleRight}>
                                        <ExclamationIcon />
                                    </div>
                                )}
                        </div>
                        {fieldErrors.password && touched.password && !formData.password && (
                            <div style={errorTextStyle}>{fieldErrors.password}</div>
                        )}
                        {touched.password && formData.password.length > 0 &&
                            (!passwordValidation.minLength || !passwordValidation.hasUppercase || !passwordValidation.hasLowercase || !passwordValidation.hasNumber || !passwordValidation.hasSpecial) && (
                                <div style={errorTextStyle}>Please fix the following:</div>
                            )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label style={labelStyle}>Confirm new password</label>
                        <div style={inputWrapperStyle}>
                            {fieldErrors.confirmPassword && touched.confirmPassword && !formData.confirmPassword && (
                                <div style={iconStyle}>
                                    <ExclamationIcon />
                                </div>
                            )}
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                style={getInputStyle('confirmPassword')}
                            />
                            {touched.confirmPassword && formData.confirmPassword.length > 0 &&
                                formData.confirmPassword !== formData.password && (
                                    <div style={iconStyleRight}>
                                        <ExclamationIcon />
                                    </div>
                                )}
                        </div>
                        {fieldErrors.confirmPassword && touched.confirmPassword && (
                            <div style={errorTextStyle}>{fieldErrors.confirmPassword}</div>
                        )}
                    </div>

                    {/* Password Requirements */}
                    <div style={{
                        textAlign: 'left',
                        color: '#000',
                        fontFamily: '"Sora", Helvetica, sans-serif',
                        fontSize: '16px',
                        lineHeight: '24px'
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
                        {isLoading ? 'Resetting...' : 'Set New Password'}
                    </button>
                </form>
            </div>
        </PageBackground>
    );
};

export default ResetPassword;