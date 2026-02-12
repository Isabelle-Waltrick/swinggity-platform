import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBackground from "../../components/PageBackground";
import logoHome from '../../assets/logo-home.png';
import '../components/AuthStyles.css';

const VerifyEmail = () => {
    const navigate = useNavigate();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const inputRefs = useRef([]);

    // Fetch CSRF token and focus first input on mount
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
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await csrfFetch(`${API_URL}/api/auth/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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

    // Get input class based on state
    const getCodeInputClassName = () => {
        let className = 'auth-code-input';
        if (hasSubmitted && (isCodeEmpty() || error)) {
            className += ' error';
        }
        return className;
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
            <div className="auth-form-container with-gap" style={{ alignItems: 'center' }}>
                {/* Logo */}
                <img
                    src={logoHome}
                    alt="Swinggity"
                    className="auth-logo no-margin"
                />

                {/* Title */}
                <h1 className="auth-title no-margin" style={{ width: '100%' }}>
                    Verify your email
                </h1>

                {/* Description */}
                <p className="auth-description" style={{ width: '100%' }}>
                    Enter the 6-digit code sent to your email address.
                </p>

                <form onSubmit={handleSubmit} className="auth-form" style={{ width: '100%', alignItems: 'center' }}>
                    {/* Success Message */}
                    {success && (
                        <div className="auth-message success" style={{ width: '100%' }}>
                            {success}
                        </div>
                    )}

                    {/* Code Input Grid */}
                    <div className="auth-code-grid">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                className={getCodeInputClassName()}
                                aria-label={`Digit ${index + 1}`}
                            />
                        ))}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <p className="auth-verify-error">
                            {error}
                        </p>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="auth-submit-btn"
                    >
                        {getButtonText()}
                    </button>
                </form>

                {/* Sign In Link */}
                <p className="auth-footer-text no-margin" style={{ width: '100%' }}>
                    Already a Member?{' '}
                    <Link to="/login" className="auth-link">
                        Sign In
                    </Link>
                </p>
            </div>
        </PageBackground>
    );
};

export default VerifyEmail;