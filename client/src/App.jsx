// The code in this file were created with help of AI (Copilot)

// The main application component that sets up routing and authentication context for the entire app.

// App-level styling so this file controls the top-level look and spacing.
import './App.css'
// Router tools for page mapping, redirects, and reading current location.
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
// Wraps the app so every page can read authentication state.
import { AuthProvider } from "./auth/context/AuthProvider"
// Hook used by protected routes to check whether a user is logged in.
import { useAuth } from "./auth/context/useAuth"

// Importing all the page components that will be rendered for different routes.
import Home from "./landing/Home"
import Signup from "./auth/pages/Signup"
import VerifyEmail from "./auth/pages/VerifyEmail"
import Login from "./auth/pages/Login"
import ForgotPassword from "./auth/pages/ForgotPassword"
import ResetPassword from "./auth/pages/ResetPassword"
import DashboardLayout from './dashboard/template/DashboardLayout'
import Welcome from './dashboard/welcome/pages/Welcome'
import CalendarPage from './dashboard/calendar/pages/Calendar'
import CalendarCreatePage from './dashboard/calendar/pages/CalendarCreate'
import CalendarViewEventPage from './dashboard/calendar/pages/CalendarViewEvent'
import MembersPage from './dashboard/members/pages/Members'
import MemberPublicProfilePage from './dashboard/members/pages/MemberPublicProfile'
import ProfilePage from './dashboard/Profile/pages/Profile'
import EditProfilePage from './dashboard/Profile/pages/EditProfile'
import EditOrganisationPage from './dashboard/Profile/pages/EditOrganisation'
import AccommodationPage from './dashboard/accommodation/pages/accommodation'
import ForumPage from './dashboard/forum/pages/forum'
import LibraryPage from './dashboard/library/pages/library'

// This wrapper acts like a "security gate" for all dashboard pages.
// If the user is not logged in, we send them to login first.
function ProtectedDashboardRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // While auth state is loading, we render nothing to avoid flicker.
  if (isLoading) {
    return null
  }

  // If there is no active session, redirect to login and remember where they came from.
  // After login, that saved location can be used to send them back.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If authenticated, allow access to the requested dashboard content.
  return children
}
// The main App component sets up the routing structure and wraps everything in the AuthProvider.
function App() {
  return (
    // AuthProvider makes authentication state available to the whole app.
    <AuthProvider>
      {/* BrowserRouter enables client-side navigation without full page refreshes. */}
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          {/* Landing page for visitors */}
          <Route path="/" element={<Home />} />
          {/* Account creation flow */}
          <Route path="/signup" element={<Signup />} />
          {/* Email verification after signup */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          {/* Login page */}
          <Route path="/login" element={<Login />} />
          {/* Catch any accidental nested login path and normalize it */}
          <Route path="/login/*" element={<Navigate to="/login" replace />} />
          {/* Password recovery flow */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Dashboard routes with auth protection */}
          <Route
            path="/dashboard"
            element={
              <ProtectedDashboardRoute>
                <DashboardLayout />
              </ProtectedDashboardRoute>
            }
          >
            {/* /dashboard */}
            {/* Default dashboard screen */}
            <Route index element={<Navigate to="welcome" replace />} />

            {/* /dashboard/welcome */}
            {/* FR20: authenticated users can view the dedicated welcome page route. */}
            <Route path="welcome" element={<Welcome />} />

            {/* All routes below are nested, so they resolve under /dashboard/... */}
            {/* Calendar management */}
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="calendar/create" element={<CalendarCreatePage />} />
            <Route path="calendar/edit/:eventId" element={<CalendarCreatePage />} />
            <Route path="calendar/:eventId" element={<CalendarViewEventPage />} />

            {/* Community features */}
            <Route path="accommodation" element={<AccommodationPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="members/:id" element={<MemberPublicProfilePage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="forum" element={<ForumPage />} />

            {/* Settings currently points to profile editing for a smoother user flow */}
            <Route path="settings" element={<Navigate to="/dashboard/profile/edit" replace />} />

            {/* Profile area */}
            <Route path="profile" element={<ProfilePage />} />
            {/* Read-only style preview (edit controls intentionally hidden) */}
            <Route path="profile/preview" element={<ProfilePage showEditControls={false} />} />
            <Route path="profile/edit" element={<EditProfilePage />} />
            <Route path="profile/organisation/edit" element={<EditOrganisationPage />} />
          </Route>

          {/* Fallback: unknown routes return users to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
