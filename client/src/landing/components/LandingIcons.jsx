import LandingPage from "./components/LandingIcons";

export const PlaceholderIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    </svg>
);

export default function Home() {
    return (
        <div>
            <LandingPage />
        </div>
    );
}
