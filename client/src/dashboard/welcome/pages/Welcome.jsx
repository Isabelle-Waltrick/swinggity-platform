import './Welcome.css'; // Create this file for any new styles if needed

export default function Welcome() {
  return (
    <div className="welcome-container">
      <h1 className="welcome-title">Welcome to Swinggity!</h1>
      <div className="welcome-body">
        <p>
          This is a space where swing dancers can connect, stay in the loop with events and look for people to share accommodation with when going to festivals. Note that this website is in their beta mode and more features will be added going forward. With that said, so your feedback is very valuable.
        </p>
        <p>
          For any queries, comments, questions and feedback, please send me an{' '}
          <a className="welcome-link" href="mailto:your@email.com">Email</a>.
        </p>
        <p>
          To make sure everyone can enjoy the community safely. Please follow our{' '}
          <a className="welcome-link" href="/guidelines">guidelines</a>.
        </p>
      </div>
    </div>
  );
}