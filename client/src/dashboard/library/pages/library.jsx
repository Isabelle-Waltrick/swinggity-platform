// The code in this file were created with help of AI (Copilot)

import underConstructionImage from '../../../assets/under-construction.png';
import '../styles/library.css';

/**
 * LibraryPage:
 * Placeholder route for the Dance Library feature while implementation is pending.
 */
export default function LibraryPage() {
    return (
        // Page wrapper consistent with other dashboard sections.
        <div className="library-page">
            <h1 className="library-title">Dance Library</h1>

            <div className="library-content">
                {/* Under-construction messaging keeps user expectations clear. */}
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
