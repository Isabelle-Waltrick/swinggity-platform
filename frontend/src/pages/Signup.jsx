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

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(''); // Clear error when user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('http://localhost:5000/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies for JWT
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Signup failed');
            }

            setSuccess('Account created successfully! Please check your email for verification.');
            // Navigate to verify email
            setTimeout(() => {
                navigate('/verify-email');
            }, 2000);

        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '1rem',
        fontSize: '1rem',
        border: '2px solid #222',
        borderRadius: '12px',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s ease'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '1.1rem',
        fontWeight: 500,
        marginBottom: '0.5rem',
        color: '#222',
        textAlign: 'left'
    };

    return (
        <PageBackground>
            <div style={{
                width: '100%',
                maxWidth: '500px',
                margin: '0 auto',
                padding: '2rem',
                backgroundColor: '#fff',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}>
                {/* Logo */}
                <img
                    src={logoHome}
                    alt="Swinggity"
                    style={{
                        maxWidth: '280px',
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        margin: '0 auto 1.5rem auto'
                    }}
                />

                {/* Title */}
                <h1 style={{
                    fontSize: '2.2rem',
                    fontWeight: 700,
                    color: '#222',
                    textAlign: 'center',
                    marginBottom: '2rem'
                }}>
                    Register
                </h1>

                <form onSubmit={handleSubmit}>
                    {/* Error Message */}
                    {error && (
                        <div style={{
                            backgroundColor: '#FFE6E6',
                            color: '#D63031',
                            padding: '1rem',
                            borderRadius: '12px',
                            marginBottom: '1.25rem',
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
                            borderRadius: '12px',
                            marginBottom: '1.25rem',
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
                        gap: '1rem',
                        marginBottom: '1.25rem'
                    }}>
                        <div>
                            <label style={labelStyle}>
                                First Name <span style={{ color: '#FF6B6B' }}>*</span>
                            </label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>
                                Last Name <span style={{ color: '#FF6B6B' }}>*</span>
                            </label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>
                            Email <span style={{ color: '#FF6B6B' }}>*</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            style={inputStyle}
                        />
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>
                            Password <span style={{ color: '#FF6B6B' }}>*</span>
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            style={inputStyle}
                        />
                    </div>

                    {/* Password Requirements */}
                    <div style={{
                        textAlign: 'left',
                        marginBottom: '2rem',
                        color: '#222'
                    }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1rem' }}>
                            Password must contain:
                        </p>
                        <ul style={{
                            margin: 0,
                            paddingLeft: '1.5rem',
                            lineHeight: '1.8',
                            fontSize: '0.95rem'
                        }}>
                            <li>At least 8 characters.</li>
                            <li>At least one uppercase letter.</li>
                            <li>At least one lowercase letter.</li>
                            <li>At least one number.</li>
                            <li>At least one special character<br />(e.g. !@#$%^&*)</li>
                        </ul>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            backgroundColor: isLoading ? '#666' : '#000',
                            color: '#fff',
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            padding: '1rem 2rem',
                            border: 'none',
                            borderRadius: '999px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                            opacity: isLoading ? 0.7 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.22)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.18)';
                        }}
                    >
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                {/* Sign In Link */}
                <p style={{
                    textAlign: 'center',
                    marginTop: '1.5rem',
                    fontSize: '1rem',
                    color: '#222'
                }}>
                    Already a Member?{' '}
                    <Link
                        to="/login"
                        style={{
                            color: '#FF6B9D',
                            fontWeight: 700,
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