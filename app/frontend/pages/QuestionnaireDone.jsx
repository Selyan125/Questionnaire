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
      const answersArray = []
      for (const k of Object.keys(answers || {})) {
        // Extract the actual questionId from keys like "ans_q123" or just use k if it's already the ID
        const questionId = k.startsWith('ans_q') ? k.substring(5) : k
        answersArray.push({ questionId, answer: answers[k] })
      }
      const payload = {
        questionnaireId: Number(id),
        answers: answersArray,
        submittedAt: new Date().toISOString(),
      }

      console.log('Submitting questionnaire', {
        questionnaireId: payload.questionnaireId,
        answersCount: payload.answers.length,
        submittedAt: payload.submittedAt,
      })

      try {
        const result = await submitQuestionnaire(id, payload)
        console.log('Submission successful:', result)
        try { localStorage.removeItem(`answers_${id}`) } catch (e) {}
        localStorage.removeItem('authToken')
        localStorage.removeItem('authUser')
        navigate('/login')
        return
      } catch (e) {
        console.error('Submission failed:', e)
        const message = (e && e.message) ? e.message : 'Erreur lors de l\'enregistrement'
        alert(`Échec de l\'enregistrement : ${message}`)
        setSaving(false)
        return
      }
    } catch (err) {
      console.error('Error preparing submission:', err)
      alert('Erreur lors de la préparation de l\'envoi.')
      setSaving(false)
      return
    }
  }

  return (
    <Box sx={{ p: 3, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ textAlign: 'center', maxWidth: 640, width: '100%', p: 4, bgcolor: 'background.paper', borderRadius: 4, border: '1px solid rgba(0,0,0,0.06)' }}>
        <Typography sx={{ fontSize: 32, fontWeight: 700, mb: 2 }}>Questionnaire terminé</Typography>
        <Typography sx={{ mb: 3, color: 'text.secondary', fontSize: 16 }}>Le questionnaire est terminé. Vous n'avez pas accès aux résultats.</Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button variant="contained" onClick={finishAndLogout} disabled={saving} sx={{ textTransform: 'none', borderRadius: 3, px: 3 }}>{saving ? 'Sauvegarde...' : 'Sauvegarder et se déconnecter'}</Button>
          <Button variant="outlined" onClick={() => navigate('/login')} disabled={saving} sx={{ textTransform: 'none', borderRadius: 3, px: 3 }}>Retour</Button>
        </Box>
      </Box>
    </Box>
  )
}
