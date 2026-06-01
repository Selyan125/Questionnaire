import React, { useEffect, useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuestionnaire } from '../api/questionnaires.js'
import QuestionnairePage from './QuestionnairePage.jsx'

export default function QuestionnaireTake(){
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const q = await getQuestionnaire(id)
        if (mounted) setQuestionnaire(q)
      } catch (e) {
        if (mounted) setError(e.message || String(e))
      } finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [id])

  if (loading) return <Box sx={{ p: 3 }}><Typography>Chargement...</Typography></Box>
  if (error) return <Box sx={{ p: 3 }}><Typography color="error">{error}</Typography></Box>
  if (!questionnaire) return <Box sx={{ p: 3 }}><Typography>Questionnaire introuvable</Typography></Box>

  // Start screen: centered flat card
  if (!started) {
    return (
      <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'background.default' }}>
        <Paper elevation={0} sx={{ width: { xs: '92%', sm: 640 }, borderRadius: 2, p: 4, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.06)', bgcolor: 'background.paper' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{questionnaire.title || 'Questionnaire'}</Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3 }}>{questionnaire.description || ''}</Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => setStarted(true)} sx={{ textTransform: 'none' }}>Démarrer</Button>
            <Button variant="text" onClick={() => navigate('/login')} sx={{ textTransform: 'none' }}>Quitter</Button>
          </Box>
        </Paper>
      </Box>
    )
  }

  // Once started, reuse the unified QuestionnairePage wrapper in readOnly mode for students/teachers
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <QuestionnairePage 
        questionnaireId={id} 
        readOnly
        viewerMode="student"
        rightActions={
          <Button 
            variant="text"
            onClick={() => {
              console.log('Terminate button clicked, navigating to:', `/questionnaire/${id}/done`);
              navigate(`/questionnaire/${id}/done`);
              // Refresh the page after navigation to ensure the page reloads properly
              setTimeout(() => window.location.reload(), 100);
            }} 
            sx={{ textTransform: 'none', borderRadius: 3 }}
            title="Terminer le questionnaire"
          >
            Terminer
          </Button>
        }
      />
    </Box>
  )
}
