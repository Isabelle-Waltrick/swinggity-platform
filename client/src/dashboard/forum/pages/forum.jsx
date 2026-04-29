import underConstructionImage from '../../../assets/under-construction.png';
import '../styles/forum.css';

/**
 * ForumPage:
 * Placeholder route for the upcoming forum feature, preserving navigation and layout.
 */
export default function ForumPage() {
    return (
        // Page shell aligned with dashboard section conventions.
        <div className="forum-page">
            <h1 className="forum-title">Forum</h1>

            <div className="forum-content">
                {/* Temporary under-construction panel until forum functionality ships. */}
                <div className="construction-container">
                    <img
                        src={underConstructionImage}
                        alt="Under Construction"
                        className="construction-image"
                    />
                    <p className="construction-message">This page is under construction. Stay tuned!</p>
                </div>
            </div>
        </div>
    );
}
