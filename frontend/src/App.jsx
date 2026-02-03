//import { useState } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/home"
import Signup from "./pages/Signup"
import Navbar from './components/Navbar'

function App() {
  return (
    <BrowserRouter>
    <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        
      </Routes>
    </BrowserRouter>
  )
}

export default App
