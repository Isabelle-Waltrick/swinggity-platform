import './App.css'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AuthProvider } from "./auth/context/AuthProvider"
import { useAuth } from "./auth/context/useAuth"
import Home from "./landing/Home"
import Signup from "./auth/pages/Signup"
import VerifyEmail from "./auth/pages/VerifyEmail"
import Login from "./auth/pages/Login"
import ForgotPassword from "./auth/pages/ForgotPassword"
import ResetPassword from "./auth/pages/ResetPassword"
import DashboardLayout from './dashboard/template/DashboardLayout'
import Welcome from './dashboard/welcome/pages/Welcome'
import CalendarPage from './dashboard/calendar/pages/Calendar'
import ProfilePage from './dashboard/Profile/pages/Profile'
import EditProfilePage from './dashboard/Profile/pages/EditProfile'

function ProtectedDashboardRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/login" element={<Login />} />
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
            <Route index element={<Welcome />} />

            {/* /dashboard/welcome */}
            <Route path="welcome" element={<Welcome />} />

            {/* the rest become /dashboard/... */}
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="accommodation" element={<div>Accommodation Share Page</div>} />
            <Route path="members" element={<div>Members Page</div>} />
            <Route path="library" element={<div>Dance Library Page</div>} />
            <Route path="forum" element={<div>Forum Page</div>} />
            <Route path="settings" element={<div>Settings Page</div>} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/edit" element={<EditProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
