import { useNavigate } from 'react-router-dom';
import logoHome from '../assets/logo-home.png';
import './components/LandingStyles.css';


const Home = () => {
    const navigate = useNavigate();

    const handleJoinNow = () => {
        navigate('/signup');
    };

    return (
        <div className="landing-page-desktop">

            {/* Logo */}
            <img className="logo-home" alt="Swinggity" src={logoHome} />

            {/* Tagline */}
            <p className="explore-our-swing">
                <span className="text-wrapper">Explore our </span>
                <span className="span">swing dance</span>
                <span className="text-wrapper">
                    {" "}
                    calendar, find people to share accommodation for swing dance festivals
                    and invite fellow dancers to your jam circle!
                </span>
            </p>

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
