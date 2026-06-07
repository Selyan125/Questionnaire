import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, TextField, Paper, Typography, MenuItem, Box, Link } from '@mui/material'
import { login } from '../api/auth.js'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const data = location.state || {}
  const error = data.error || 'Une erreur est survenue'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        padding: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 4,
          px: 4,
          py: 5,
          boxShadow: 'none',
          border: '1px solid rgba(0,0,0,0.06)',
          bgcolor: 'background.paper'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Oups....</Typography>
          <Typography variant="body2" color="text.secondary">Une erreur est survenue, si le problème persiste, contactez votre administrateur.</Typography>
          <Typography color="error" variant="body2" sx={{ mt: 5, p: 1.5, bgcolor: 'rgba(211,47,47,0.08)', borderRadius: 2 }}>{error}</Typography>
        </Box>

        <Box>

          <Button onClick={() => navigate('/')} variant="contained" color="primary" fullWidth sx={{ mt: 0.2, py: 1.2, fontWeight: 600, borderRadius: 3, textTransform: 'none' }}>Réessayer</Button>
        </Box>
      </Paper>
    </Box>
  )
}
