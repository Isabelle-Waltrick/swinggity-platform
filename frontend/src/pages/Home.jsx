import { useNavigate } from 'react-router-dom';
import PageBackground from '../components/PageBackground';
import logoHome from '../assets/logo-home.png';

const Home = () => {
  const navigate = useNavigate();

  return (
    <PageBackground>
      <div style={{
        width: '100%',
        maxWidth: '1100px',
        textAlign: 'center',
        padding: '0 2rem',
        margin: '0 auto'
      }}>
        {/* Logo (large, centered) */}
        <img src={logoHome} alt="" style={{ maxWidth: '900px', width: '100%', height: 'auto', marginBottom: '2rem' }} />

        {/* Description */}
        <p style={{
          fontSize: 'clamp(1.25rem, 2.4vw, 1.6rem)',
          lineHeight: '1.6',
          color: '#222222',
          marginBottom: '3rem',
          fontWeight: 600,
          maxWidth: '760px',
          margin: '0 auto 3rem auto'
        }}>
          Explore our <strong style={{ fontWeight: 800 }}>swing dance</strong> calendar, find people to share accommodation for swing dance festivals and invite fellow dancers to your jam circle!
        </p>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '1.75rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button style={{
            backgroundColor: '#000',
            color: '#fff',
            fontSize: '1.25rem',
            fontWeight: 800,
            padding: '1rem 3rem',
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)'
          }}
            onClick={() => navigate('/signup')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 18px 34px rgba(0,0,0,0.22)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.18)';
            }}>

            Join Now!
          </button>

          <button style={{
            backgroundColor: '#fff',
            color: '#000',
            fontSize: '1.25rem',
            fontWeight: 700,
            padding: '0.95rem 2.8rem',
            border: '4px solid #000',
            borderRadius: '999px',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 14px 30px rgba(0,0,0,0.16)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.12)';
            }}>
            Visit
          </button>
        </div>
      </div>
    </PageBackground>
  );
};

export default Home;