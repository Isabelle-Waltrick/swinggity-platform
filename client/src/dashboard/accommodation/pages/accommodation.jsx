import underConstructionImage from '../../../assets/under-construction.png';
import '../styles/accommodation.css';

/**
 * AccommodationPage:
 * Temporary placeholder page for the future Share Stay feature area.
 */
export default function AccommodationPage() {
    return (
        // Page shell aligned with dashboard section styling.
        <div className="accommodation-page">
            <h1 className="accommodation-title">Share Stay</h1>

            <div className="accommodation-content">
                {/* Under-construction placeholder keeps routing stable while feature is in progress. */}
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
