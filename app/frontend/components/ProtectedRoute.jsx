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

  return children
}
