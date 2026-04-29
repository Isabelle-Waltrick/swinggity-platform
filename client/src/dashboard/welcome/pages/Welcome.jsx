import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/context/useAuth';
import AdminFeedbackPopup from '../components/AdminFeedbackPopup';
import './Welcome.css';

/**
 * Welcome:
 * Dashboard landing page that orients users, links to key product sections,
 * and provides an in-context feedback channel to the admin team.
 */
export default function Welcome() {
  const { user } = useAuth();
  // Popup state for the admin feedback modal.
  const [isFeedbackPopupOpen, setIsFeedbackPopupOpen] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Opens inline feedback modal.
  const openFeedbackPopup = () => {
    setIsFeedbackPopupOpen(true);
  };

  // Closes inline feedback modal.
  const closeFeedbackPopup = () => {
    setIsFeedbackPopupOpen(false);
  };

  return (
    // Main welcome shell with product guidance and section links.
    <div className="welcome-container">
      <h1 className="welcome-title">Welcome to Swinggity!</h1>
      <div className="welcome-body">
        <p>
          Swinggity is your hub for the swing dance community. You can discover and post events in{' '}
          <Link className="welcome-link welcome-link-developed" to="/dashboard/calendar">Calendar</Link>,
          connect with dancers in{' '}
          <Link className="welcome-link welcome-link-developed" to="/dashboard/members">Members</Link>,
          and set up your public{' '}
          <Link className="welcome-link welcome-link-developed" to="/dashboard/profile">Profile</Link> so others can find you.
        </p>
        <p>
          If you are new here, a great first step is to complete your{' '}
          <Link className="welcome-link welcome-link-developed" to="/dashboard/profile">Profile</Link> and then check{' '}
          <Link className="welcome-link welcome-link-developed" to="/dashboard/calendar">Calendar</Link> for upcoming socials,
          classes, and festivals.
          {' '}We would love your feedback as we build these features, so please send us a{' '}
          <button type="button" className="welcome-link welcome-link-developed welcome-feedback-trigger" onClick={openFeedbackPopup}>message</button>.
        </p>
        <p>
          <strong>Coming soon</strong>:{' '}
          <Link className="welcome-link welcome-link-in-progress" to="/dashboard/accommodation">Share Stay</Link>,{' '}
          <Link className="welcome-link welcome-link-in-progress" to="/dashboard/library">Dance Library</Link>, and{' '}
          <Link className="welcome-link welcome-link-in-progress" to="/dashboard/forum">Forum</Link>. Share Stay will
          help dancers find accommodation buddies for events and festivals, Dance Library will host useful resources for
          learning and practice, and Forum will be a space for community discussions.
        </p>

        <section className="welcome-housekeeping" aria-labelledby="housekeeping-rules-title">
          <h2 id="housekeeping-rules-title" className="welcome-housekeeping-title">Housekeeping Rules</h2>
          <ul className="welcome-housekeeping-list">
            <li>Be kind and respectful to all members in messages, comments, and discussions.</li>
            <li>Keep event details accurate and update.</li>
            <li>Only share contact details you are comfortable with and respect others' boundaries.</li>
            <li>Report unsafe, inappropriate, or suspicious behavior to the admin team or report the member's profile directly.</li>
          </ul>
        </section>
      </div>

      <AdminFeedbackPopup
        isOpen={isFeedbackPopupOpen}
        currentUser={user}
        apiUrl={API_URL}
        onClose={closeFeedbackPopup}
      />
    </div>
  );
}