import underConstructionImage from '../../../assets/under-construction.png';
import '../styles/library.css';

export default function LibraryPage() {
    return (
        <div className="library-page">
            <h1 className="library-title">Dance Library</h1>

            <div className="library-content">
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
