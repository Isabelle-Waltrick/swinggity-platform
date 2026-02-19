import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./auth/context/AuthProvider"
import Home from "./landing/Home"
import Signup from "./auth/pages/Signup"
import VerifyEmail from "./auth/pages/VerifyEmail"
import Login from "./auth/pages/Login"
import ForgotPassword from "./auth/pages/ForgotPassword"
import ResetPassword from "./auth/pages/ResetPassword"
import DashboardLayout from './dashboard/template/DashboardLayout'
import Welcome from './dashboard/welcome/pages/Welcome'

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

          {/* Dashboard routes with DashboardLayout */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            {/* /dashboard */}
            <Route index element={<Welcome />} />

            {/* /dashboard/welcome */}
            <Route path="welcome" element={<Welcome />} />

            {/* the rest become /dashboard/... */}
            <Route path="calendar" element={<div>Calendar Page</div>} />
            <Route path="accommodation" element={<div>Accommodation Share Page</div>} />
            <Route path="members" element={<div>Members Page</div>} />
            <Route path="library" element={<div>Dance Library Page</div>} />
            <Route path="forum" element={<div>Forum Page</div>} />
            <Route path="settings" element={<div>Settings Page</div>} />
            <Route path="profile" element={<div>Profile Page</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
