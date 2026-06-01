import React, { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { submitQuestionnaire } from '../api/questionnaires.js'

export default function QuestionnaireDone(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  async function finishAndLogout(){
    setSaving(true)
    try {
      const rawAns = localStorage.getItem(`answers_${id}`)
      const answers = rawAns ? JSON.parse(rawAns) : {}
      const rawUser = localStorage.getItem('authUser')
      let user = null
      try { user = rawUser ? JSON.parse(rawUser) : null } catch (e) { user = null }
      // normalize answers to array of { questionId, answer }
      const answersArray = []
      for (const k of Object.keys(answers || {})) {
        answersArray.push({ questionId: k, answer: answers[k] })
      }
      const payload = {
        questionnaireId: id,
        user: user ? { id: user.id, email: user.email, role: user.role } : undefined,
        answers: answersArray,
        submittedAt: new Date().toISOString(),
      }

      try {
        await submitQuestionnaire(id, payload)
        // clear saved answers after successful submit
        try { localStorage.removeItem(`answers_${id}`) } catch (e) {}
      } catch (e) {
        // log failure to console (no UI alert)
        console.error('submit failed', e)
      }

    } finally {
      setSaving(false)
      localStorage.removeItem('authToken')
      localStorage.removeItem('authUser')
      navigate('/login')
    }
  }

  return (
    <Box sx={{ p: 3, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ textAlign: 'center', maxWidth: 640, width: '100%', p: 4, bgcolor: 'background.paper', borderRadius: 4, border: '1px solid rgba(0,0,0,0.06)' }}>
        <Typography sx={{ fontSize: 32, fontWeight: 700, mb: 2 }}>✓ Questionnaire terminé</Typography>
        <Typography sx={{ mb: 3, color: 'text.secondary', fontSize: 16 }}>Merci d'avoir complété le questionnaire. Vos réponses ont été enregistrées.</Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button variant="contained" onClick={finishAndLogout} disabled={saving} sx={{ textTransform: 'none', borderRadius: 3, px: 3 }}>{saving ? 'Sauvegarde...' : 'Sauvegarder et se déconnecter'}</Button>
          <Button variant="outlined" onClick={() => navigate('/login')} disabled={saving} sx={{ textTransform: 'none', borderRadius: 3, px: 3 }}>Retour</Button>
        </Box>
      </Box>
    </Box>
  )
}
