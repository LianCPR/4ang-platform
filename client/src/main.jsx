import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Lazy-loaded: a normal listener should never pay the download cost of
// the Admin Platform (incl. recharts) just to open 4ANG (Part 61).
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={
          <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F8F3E8' }} />}>
            <AdminApp />
          </Suspense>
        } />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
