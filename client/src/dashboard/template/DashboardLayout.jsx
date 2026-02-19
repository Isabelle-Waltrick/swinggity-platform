import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/context/useAuth';
import ProfileAvatar from '../../components/ProfileAvatar';
// Logo
import logoHome from '../../assets/logo-home.png';
// icons
import welcomeIcon from '../../assets/welcome-icon.png';
import calendarIcon from '../../assets/calendar-icon.png';
import homeIcon from '../../assets/Home-icon.png';
import membersIcon from '../../assets/members-icon.png';
import libraryIcon from '../../assets/library-icon.png';
import forumIcon from '../../assets/forum-icon.png';
import settingsIcon from '../../assets/settings-icon.png';
import './DashboardStyles.css';

const ProfileIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const LogoutIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="#FF5454" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="16,17 21,12 16,7" stroke="#FF5454" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="21" y1="12" x2="9" y2="12" stroke="#FF5454" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ChevronIcon = ({ isOpen }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
        }}
    >
        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Hamburger menu icon (3 lines)
const HamburgerIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Close icon (X)
const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const DashboardLayout = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                navigate('/login');
            }
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    // Close dropdown when clicking outside
    const handleClickOutside = () => {
        if (isDropdownOpen) {
            setIsDropdownOpen(false);
        }
    };

    const navItems = [
        { path: '/dashboard', label: 'Welcome', icon: welcomeIcon },
        { path: '/dashboard/calendar', label: 'Calendar', icon: calendarIcon },
        { path: '/dashboard/accommodation', label: 'Share Stay', icon: homeIcon },
        { path: '/dashboard/members', label: 'Members', icon: membersIcon },
        { path: '/dashboard/library', label: 'Dance Library', icon: libraryIcon },
        { path: '/dashboard/forum', label: 'Forum', icon: forumIcon },
    ];

    return (
        <div className="dashboard-layout" onClick={handleClickOutside}>
            {/* Navbar */}
            <header className="dashboard-navbar">
                <div className="navbar-logo">
                    <img src={logoHome} alt="Swinggity" />
                </div>

                {/* Desktop: Avatar dropdown */}
                <div className="navbar-user desktop-only">
                    <button
                        className="user-avatar-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown();
                        }}
                    >
                        <div className="avatar-container">
                            <ProfileAvatar
                                firstName={user?.firstName}
                                lastName={user?.lastName}
                                size={40}
                            />
                        </div>
                        <ChevronIcon isOpen={isDropdownOpen} />
                    </button>

                    {isDropdownOpen && (
                        <div className="user-dropdown" onClick={(e) => e.stopPropagation()}>
                            <NavLink to="/dashboard/profile" className="dropdown-item">
                                <ProfileIcon />
                                <span>View / Edit profile</span>
                            </NavLink>
                            <button className="dropdown-item logout" onClick={handleLogout}>
                                <LogoutIcon />
                                <span>Log out</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile: Hamburger menu button */}
                <button
                    className="mobile-menu-btn mobile-only"
                    onClick={toggleMobileMenu}
                    aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                >
                    {isMobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}>
                <nav className="mobile-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/dashboard'}
                            className={({ isActive }) =>
                                `mobile-nav-item ${isActive ? 'active' : ''}`
                            }
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <img src={item.icon} alt={item.label} className="nav-icon" />
                            <span style={{ whiteSpace: 'pre-line' }}>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mobile-menu-footer">
                    {/* User info */}
                    <NavLink
                        to="/dashboard/profile"
                        className="mobile-user-info"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div className="avatar-container">
                            <ProfileAvatar
                                firstName={user?.firstName}
                                lastName={user?.lastName}
                                size={40}
                            />
                        </div>
                        {/* Optionally, show name if you have it in state/context */}
                    </NavLink>

                    {/* Logout */}
                    <button className="mobile-nav-item logout" onClick={handleLogout}>
                        <LogoutIcon />
                        <span>Log out</span>
                    </button>

                    {/* Settings */}
                    <NavLink
                        to="/dashboard/settings"
                        className={({ isActive }) =>
                            `mobile-nav-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <img src={settingsIcon} alt="Settings" className="nav-icon" />
                        <span>Settings</span>
                    </NavLink>
                </div>
            </div>

            {/* Main Container (Sidebar + Content) */}
            <div className="dashboard-container">
                {/* Sidebar - Desktop only */}
                <aside className="dashboard-sidebar">
                    <nav className="sidebar-nav">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/dashboard'}
                                className={({ isActive }) =>
                                    `sidebar-nav-item ${isActive ? 'active' : ''}`
                                }
                            >
                                <img src={item.icon} alt={item.label} className="nav-icon" />
                                <span style={{ whiteSpace: 'pre-line' }}>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    <div className="sidebar-footer">
                        <NavLink
                            to="/dashboard/settings"
                            className={({ isActive }) =>
                                `sidebar-nav-item settings ${isActive ? 'active' : ''}`
                            }
                        >
                            <img src={settingsIcon} alt="Settings" className="nav-icon settings-icon" />
                            <span>Settings</span>
                        </NavLink>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="dashboard-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;