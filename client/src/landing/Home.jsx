// The code in this file were created with help of AI (Copilot)

import { useNavigate } from 'react-router-dom';
import logoHome from '../assets/logo-home.png';
import './components/LandingStyles.css';


/**
 * Landing Home:
 * Public-facing entry screen with product value proposition and primary auth CTAs.
 */
const Home = () => {
    const navigate = useNavigate();

    // Primary CTA route handler.
    const handleJoinNow = () => {
        navigate('/signup');
    };

    return (
        // Desktop landing layout container.
        <div className="landing-page-desktop">

            {/* Logo */}
            <img className="logo-home" alt="Swinggity" src={logoHome} />

            {/* Tagline */}
            <p className="explore-our-swing">
                <span className="text-wrapper">Explore our </span>
                <span className="span">swing dance</span>
                <span className="text-wrapper">
                    {" "}
                    calendar to discover events in your area and connect with fellow dancers whereas growing your jam circle!
                </span>
            </p>

            {/* Call-to-action buttons for onboarding and returning users. */}
            <div className="landing-cta-row">
                {/* Join Now Button */}
                <button className="button-primary" onClick={handleJoinNow}>
                    <span className="button-text-primary">Join Now!</span>
                </button>

                {/* Log In Button */}
                <button
                    className="button-secondary-home"
                    onClick={() => navigate('/login')}
                >
                    <span className="button-text-secondary">Log In</span>
                </button>
            </div>
        </div>
    );
};

export default Home;
