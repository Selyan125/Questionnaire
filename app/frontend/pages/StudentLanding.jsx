import React from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function StudentLanding(){
  const navigate = useNavigate()
  let raw = null
  try { raw = localStorage.getItem('authUser') } catch (e) { raw = null }
  let user = null
  try { user = raw ? JSON.parse(raw) : null } catch (e) { user = null }
  const assignedId = user && (user.assignedQuestionnaireId || user.questionnaireId || user.currentQuestionnaireId)

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'background.default' }}>
      <Box sx={{ textAlign: 'center', maxWidth: 640, width: '100%' }}>
        <Typography sx={{ fontSize: 24, fontWeight: 600, mb: 3 }}>Bonjour{user && user.email ? `, ${user.email}` : ''}</Typography>
        <Paper sx={{ p: 4, elevation: 0, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 3 }}>
          {assignedId ? (
            <>
              <Typography sx={{ mb: 2 }}>Un questionnaire vous a été assigné. Bon courage !</Typography>
              <Button variant="contained" onClick={() => navigate(`/questionnaire/${assignedId}/take`)}>Démarrer le questionnaire</Button>
            </>
          ) : (
            <>
              <Typography sx={{ mb: 3 }}>Aucun questionnaire assigné pour le moment. Contactez votre enseignant.</Typography>
              <Button variant="outlined" onClick={() => navigate('/login')}>Se déconnecter</Button>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
