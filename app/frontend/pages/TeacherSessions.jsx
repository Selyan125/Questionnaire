import React, { useEffect, useState } from 'react'
import { Box, Typography, Grid, Button, Stack, Skeleton } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { listQuestionnaires } from '../api/questionnaires.js'
import TopAppBar from '../components/TopAppBar.jsx'
import LogoutIcon from '@mui/icons-material/Logout'

export default function TeacherSessions() {
  const [questionnaires, setQuestionnaires] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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
                    sx={{ bgcolor: '#37398f', borderRadius: 2, px: 5, py: 1, textTransform: 'none', fontWeight: 600 }}
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