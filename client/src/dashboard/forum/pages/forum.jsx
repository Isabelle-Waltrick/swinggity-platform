import underConstructionImage from '../../../assets/under-construction.png';
import '../styles/forum.css';

export default function ForumPage() {
    return (
        <div className="forum-page">
            <h1 className="forum-title">Forum</h1>

            <div className="forum-content">
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
