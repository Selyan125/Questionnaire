import React, { useEffect, useState } from 'react'
import { Box, Typography, Grid, Button, Stack, Skeleton, Avatar, Paper, Divider } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { listQuestionnaires } from '../api/questionnaires.js'
import TopAppBar from '../components/TopAppBar.jsx'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'

export default function TeacherSessions() {
  const [questionnaires, setQuestionnaires] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const authUser = JSON.parse(localStorage.getItem('authUser') || '{}')

  useEffect(() => {
    listQuestionnaires().then(setQuestionnaires).catch(console.error).finally(() => setLoading(false))
  }, [])

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    navigate('/login')
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fcfcfd' }}>
      <TopAppBar 
        title="Espace Enseignant" 
        rightActions={
          <Button startIcon={<LogoutIcon />} onClick={logout} sx={{ color: 'text.secondary', textTransform: 'none' }}>
            Déconnexion
          </Button>
        }
        hideDashboardLink
      />
      
      <Box sx={{ pt: 15, pb: 6, px: 3, maxWidth: 1200, mx: 'auto' }}>
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            mb: 6, 
            borderRadius: '24px', 
            bgcolor: '#fff', 
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 3
          }}
        >
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1a1a1b', mb: 0.5 }}>
              Bienvenue {authUser.name || authUser.nom || ''} {authUser.lastName || authUser.prenom || ''}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {authUser.email}
              </Typography>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
              <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {authUser.admin ? 'Administrateur' : ''}
              </Typography>
            </Stack>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ opacity: 0.6 }} />
          <Box sx={{ textAlign: 'right', minWidth: 100 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
              Questionnaires
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {loading ? '...' : questionnaires.length}
            </Typography>
          </Box>
        </Paper>

        <Box sx={{ mb: 8, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5, letterSpacing: '-0.02em' }}>Sessions disponibles</Typography>
          <Typography sx={{ color: 'text.secondary' }}>Choisissez un questionnaire pour commencer l'évaluation des étudiants.</Typography>
        </Box>

        <Grid container spacing={4} justifyContent="center">
          {loading ? (
            [1, 2, 3].map(i => (
              <Grid item key={i} xs={12} sm={6} md={4}>
                <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 4 }} />
              </Grid>
            ))
          ) : questionnaires.length > 0 ? (
            questionnaires.map(q => (
              <Grid item key={q.id} xs={12} sm={6} md={4}>
                <Box 
                  sx={{ 
                    p: 4, 
                    borderRadius: 5, 
                    bgcolor: 'rgba(0,0,0,0.025)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', transform: 'translateY(-4px)' }
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 18, textAlign: 'center' }}>
                    {q.title}
                  </Typography>
                  <Button 
                    variant="contained" 
                    disableElevation 
                    onClick={() => navigate(`/admin/question-manager/${q.id}`)}
                    sx={{ bgcolor: '#37398f', borderRadius: 100, px: 5, py: 1, textTransform: 'none', fontWeight: 600 }}
                  >
                    Accéder
                  </Button>
                </Box>
              </Grid>
            ))
          ) : (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography sx={{ color: 'text.secondary' }}>Aucun questionnaire ne vous est assigné pour le moment.</Typography>
            </Box>
          )}
        </Grid>
      </Box>
    </Box>
  )
}