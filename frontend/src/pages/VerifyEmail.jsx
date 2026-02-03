import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBackground from "../components/PageBackground";
import logoHome from '../assets/logo-home.png';

const VerifyEmail = () => {
    const navigate = useNavigate();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const inputRefs = useRef([]);

    // Focus first input on mount
    useEffect(() => {
        // Small delay to ensure refs are attached
        const timer = setTimeout(() => {
            if (inputRefs.current[0]) {
                inputRefs.current[0].focus();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Check if code is empty (all fields empty)
    const isCodeEmpty = () => {
        return code.every(digit => digit === '');
    };

    // Check if code is incomplete (some fields filled, some empty)
    const isCodeIncomplete = () => {
        const filledCount = code.filter(digit => digit !== '').length;
        return filledCount > 0 && filledCount < 6;
    };

    // Get the full code as string
    const getFullCode = () => {
        return code.join('');
    };

    // Handle input change
    const handleChange = (index, e) => {
        const value = e.target.value;

        // Only allow single character, convert to lowercase
        const lastChar = value.slice(-1).toLowerCase();

        // Only allow alphanumeric characters (letters and numbers)
        if (lastChar && !/^[a-z0-9]$/.test(lastChar)) {
            return;
        }

        const newCode = [...code];
        newCode[index] = lastChar;
        setCode(newCode);
        setError('');

        // Auto-focus next input if a character was entered
        if (lastChar && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle key down for backspace navigation
    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (!code[index] && index > 0) {
                // If current field is empty, move to previous and clear it
                inputRefs.current[index - 1]?.focus();
                const newCode = [...code];
                newCode[index - 1] = '';
                setCode(newCode);
            } else {
                // Clear current field
                const newCode = [...code];
                newCode[index] = '';
                setCode(newCode);
            }
            setError('');
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle paste
    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim().toLowerCase();

        // Extract only alphanumeric characters from pasted content
        const chars = pastedData.replace(/[^a-z0-9]/g, '').slice(0, 6);

        if (chars.length === 0) {
            return;
        }

        const newCode = ['', '', '', '', '', ''];
        for (let i = 0; i < chars.length && i < 6; i++) {
            newCode[i] = chars[i];
        }
        setCode(newCode);
        setError('');

        // Focus the next empty input or the last filled one
        const nextEmptyIndex = newCode.findIndex(char => char === '');
        if (nextEmptyIndex !== -1) {
            inputRefs.current[nextEmptyIndex]?.focus();
        } else {
            inputRefs.current[5]?.focus();
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setHasSubmitted(true);

        // Validate empty code
        if (isCodeEmpty()) {
            setError('Please, insert the code sent to your inbox');
            return;
        }

        // Validate incomplete code
        if (isCodeIncomplete()) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('http://localhost:5000/api/auth/verify-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ code: getFullCode() }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Verification failed');
            }

            setSuccess('Email verified successfully! Redirecting...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            // Handle wrong code error
            if (err.message.includes('Invalid') || err.message.includes('expired')) {
                setError('Wrong code, please try again.');
            } else {
                setError(err.message || 'Something went wrong. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Get input border color - only show error after submission attempt
    const getInputBorderColor = () => {
        if (hasSubmitted && (isCodeEmpty() || error)) {
            return '#FF5454';
        }
        return '#000000';
    };

    // Get button text based on state
    const getButtonText = () => {
        if (isLoading) {
            return 'Verifying...';
        }
        if (hasSubmitted && isCodeEmpty()) {
            return 'Check your Inbox';
        }
        return 'Verify Account';
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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
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
                    fontFamily: '"Sora", Helvetica, sans-serif',
                    width: '100%'
                }}>
                    Verify your email
                </h1>

                {/* Description */}
                <p style={{
                    fontSize: '20px',
                    fontWeight: 400,
                    color: '#000',
                    textAlign: 'center',
                    margin: 0,
                    lineHeight: '30px',
                    fontFamily: '"Sora", Helvetica, sans-serif',
                    width: '100%'
                }}>
                    Enter the 6-digit code sent to your email address.
                </p>

                {/* Success Message */}
                {success && (
                    <div style={{
                        backgroundColor: '#E6FFE6',
                        color: '#00B894',
                        padding: '1rem',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        textAlign: 'center',
                        width: '100%',
                        boxSizing: 'border-box'
                    }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    {/* Code Input Boxes */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '12px',
                        marginBottom: error ? '16px' : '37px',
                        flexWrap: 'wrap'
                    }}>
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={el => { inputRefs.current[index] = el; }}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    border: `2px solid ${getInputBorderColor()}`,
                                    borderRadius: '4px',
                                    fontSize: '24px',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                    fontFamily: '"Sora", Helvetica, sans-serif',
                                    outline: 'none',
                                    backgroundColor: '#fff',
                                    transition: 'border-color 0.2s ease',
                                    caretColor: '#000'
                                }}
                                aria-label={`Digit ${index + 1}`}
                            />
                        ))}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <p style={{
                            color: '#FF5454',
                            fontSize: '20px',
                            fontWeight: 600,
                            fontStyle: 'italic',
                            textAlign: 'left',
                            margin: '0 0 37px 0',
                            fontFamily: '"Sora", Helvetica, sans-serif'
                        }}>
                            {error}
                        </p>
                    )}

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
                        {getButtonText()}
                    </button>
                </form>

                {/* Sign In Link */}
                <p style={{
                    textAlign: 'center',
                    fontSize: '20px',
                    color: '#000',
                    fontFamily: '"Sora", Helvetica, sans-serif',
                    fontWeight: 400,
                    lineHeight: '20px',
                    margin: 0,
                    width: '100%'
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

export default VerifyEmail;