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
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 24, fontWeight: 600, mb: 2 }}>Bonjour{user && user.email ? `, ${user.email}` : ''}</Typography>
      <Paper sx={{ p: 2, maxWidth: 640 }} elevation={0}>
        {assignedId ? (
          <>
            <Typography sx={{ mb: 1 }}>Un questionnaire vous a été assigné.</Typography>
            <Button variant="contained" onClick={() => navigate(`/questionnaire/${assignedId}/take`)}>Démarrer le questionnaire</Button>
          </>
        ) : (
          <>
            <Typography sx={{ mb: 1 }}>Aucun questionnaire assigné pour le moment. Contactez votre enseignant.</Typography>
            <Button variant="outlined" onClick={() => navigate('/login')}>Se déconnecter</Button>
          </>
        )}
      </Paper>
    </Box>
  )
}
