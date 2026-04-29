import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installCsrfFetchInterceptor } from './utils/csrf.js'

// Install a global fetch wrapper so every API request can include CSRF protection automatically.
installCsrfFetchInterceptor();

// App startup entry point:
// 1) React mounts <App /> into the #root element in index.html.
// 2) App.jsx defines routes (for example /signup) and decides which page flow to render.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
