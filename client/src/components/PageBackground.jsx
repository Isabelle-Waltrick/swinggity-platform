// The code in this file were created with help of AI (Copilot)

/**
 * PageBackground:
 * Shared full-screen wrapper that centers child content and applies the
 * brand background tone used by auth and standalone pages.
 */
const PageBackground = ({ children }) => {
    return (
        // Outer viewport container controls layout, spacing, and visual baseline.
        <div style={{
            minHeight: '100vh',
            width: '100%',
            maxWidth: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3.5rem 2rem',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            fontFamily: '"Sora", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
            backgroundColor: 'var(--colour-brand-body-light)'
        }}>
            {/* Keeps app content above decorative/background layers. */}
            <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                {children}
            </div>
        </div>
    );
};

export default PageBackground;
