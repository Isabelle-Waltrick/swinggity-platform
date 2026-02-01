import blueShape from '../assets/blue-shape.png';
import yellowShape from '../assets/yellow-shape.png';
import greenShape from '../assets/green-shape.png';
import purpleShape from '../assets/purple-shape.png';

const PageBackground = ({ children }) => {
    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            maxWidth: '100vw',
            background: '#FFF8F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3.5rem 2rem',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            fontFamily: 'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
        }}>
            {/* Decorative Icons */}
            <div style={{
                position: 'absolute',
                top: '6%',
                left: '6%',
                width: '150px',
                height: '150px'
            }}>
                <img src={blueShape} alt="" style={{ width: '100%', height: '100%' }} />
            </div>

            <div style={{
                position: 'absolute',
                top: '3%',
                right: '6%',
                width: '180px',
                height: '180px'
            }}>
                <img src={yellowShape} alt="" style={{ width: '100%', height: '100%' }} />
            </div>

            <div style={{
                position: 'absolute',
                bottom: '6%',
                left: '3%',
                width: '260px',
                height: '260px'
            }}>
                <img src={greenShape} alt="" style={{ width: '100%', height: '100%' }} />
            </div>

            <div style={{
                position: 'absolute',
                bottom: '6%',
                right: '4%',
                width: '150px',
                height: '150px'
            }}>
                <img src={purpleShape} alt="" style={{ width: '100%', height: '100%' }} />
            </div>

            {/* Page Content */}
            <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                {children}
            </div>
        </div>
    );
};

export default PageBackground;
