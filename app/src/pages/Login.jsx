import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextField, Paper, Typography, MenuItem, Box, Link } from '@mui/material'
import { login } from '../api/auth.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('teacher')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      const data = await login({ email: email.trim(), password, role })
      if (!data || !data.token) {
        setError('Réponse invalide du serveur')
        return
      }
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('authUser', JSON.stringify(data.user || {}))
      navigate('/dashboard')
    } catch (err) {
      const status = err && err.status
      const payload = err && err.data
      if (status === 401) {
        setError((payload && (payload.error || payload.message)) || 'Identifiants invalides')
        return
      }
      if (status === 404) {
        setError((payload && (payload.error || payload.message)) || 'Utilisateur non trouvé')
        return
      }
      if (status === 400) {
        setError((payload && (payload.error || payload.message)) || 'Requête invalide')
        return
      }
      console.error('Login error', err)
      setError(err && err.message ? err.message : 'Erreur réseau')
    }
  }
  // 2yYB1YTZ3XVCg745Uj4up7413lqtyI5huX136Q / admin@softwarenotes.local


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
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Questionnaire</Typography>
          <Typography variant="body2" color="text.secondary">Connexion</Typography>
        </Box>

        <Box component="form" onSubmit={submit}>
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            margin="normal"
            autoComplete="email"
            required
            variant="outlined"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />

          <TextField
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            margin="normal"
            autoComplete="current-password"
            required
            variant="outlined"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />

          <TextField
            select
            label="Rôle"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          >
            <MenuItem value="teacher">Enseignant</MenuItem>
            <MenuItem value="student">Étudiant</MenuItem>
          </TextField>

          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(211,47,47,0.08)', borderRadius: 2 }}>{error}</Typography>
          )}

          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 3, py: 1.2, fontWeight: 600, borderRadius: 3, textTransform: 'none' }}>Se connecter</Button>
        </Box>
      </Paper>
    </Box>
  )
}
