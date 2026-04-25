/**
 * Calendar Component Guide
 * Reusable presentational calendar component consumed by calendar pages.
 * Keeps page files cleaner by isolating rendering responsibilities.
 */

export const Calendar = ({ className = "" }) => (
    <svg
        className={className}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <rect x="4" y="6" width="24" height="22" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M10 2v8M22 2v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="2" />
    </svg>
);
