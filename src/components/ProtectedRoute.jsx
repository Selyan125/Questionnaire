import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  if (!token) return <Navigate to="/login" replace />

  const rawUser = typeof window !== 'undefined' ? localStorage.getItem('authUser') : null
  let user = null
  try { user = rawUser ? JSON.parse(rawUser) : null } catch (e) { user = null }

  const location = useLocation()
  const pathname = location.pathname || ''

  // Students must not access the admin/dashboard area. Redirect them to /student landing.
  const isStudent = user && (user.role === 'student' || user.role === 'etudiant' || user.role === 'élève')
  if (isStudent) {
    // allow questionnaire pages and public pages
    if (pathname.startsWith('/questionnaire') || pathname.startsWith('/login') || pathname === '/student') {
      return children
    }
    // otherwise redirect to student landing
    return <Navigate to="/student" replace />
  }

  return children
}
