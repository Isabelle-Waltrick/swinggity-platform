import { useNavigate } from 'react-router-dom';
import logoHome from '../assets/logo-home.png';
import './components/LandingStyles.css';
// Import decorative shapes - add these images to your assets folder
// import blueShape from '../assets/blue-shape.png';
// import greenShape from '../assets/green-shape.png';
// import yellowShape from '../assets/yellow-shape.png';
// import purpleShape from '../assets/purple-shape.png';

const Home = () => {
    const navigate = useNavigate();

    const handleJoinNow = () => {
        navigate('/signup');
    };

    return (
        <div className="landing-page-desktop">
            {/* Decorative blue flower shape - top left */}
            {/* <img className="shape-blue" alt="" src={blueShape} /> */}

            {/* Decorative yellow checkered shape - top right */}
            {/* <img className="shape-yellow" alt="" src={yellowShape} /> */}

            {/* Decorative green leaves shape - bottom left */}
            {/* <img className="shape-green" alt="" src={greenShape} /> */}

            {/* Decorative purple pinwheel shape - bottom right */}
            {/* <img className="shape-purple" alt="" src={purpleShape} /> */}

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

            {/* Join Now Button */}
            <button className="button-primary" onClick={handleJoinNow}>
                <span className="button-text-primary">Join Now!</span>
            </button>

            {/* Visit Button */}
            <button className="button-secondary-home">
                <span className="button-text-secondary">Visit</span>
            </button>
        </div>
    );
};

export default Home;
