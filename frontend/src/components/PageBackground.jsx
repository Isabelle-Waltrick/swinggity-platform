const PageBackground = ({ children }) => {
    return (
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
            {/* Page Content */}
            <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                {children}
            </div>
        </div>
    );
};

export default PageBackground;
