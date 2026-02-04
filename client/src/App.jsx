import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./landing/Home"
import Signup from "./auth/pages/Signup"
import VerifyEmail from "./auth/pages/VerifyEmail"
import Login from "./auth/pages/Login"
import ForgotPassword from "./auth/pages/ForgotPassword"
import ResetPassword from "./auth/pages/ResetPassword"
import Navbar from './components/Navbar'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
