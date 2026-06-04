import React, { useEffect, useState } from 'react'
import { Box, Typography, Button, Paper, Alert } from '@mui/material'
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
  const [validationError, setValidationError] = useState(null)

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

  function validateAnswers() {
    const rawAns = localStorage.getItem(`answers_${id}`)
    const answers = rawAns ? JSON.parse(rawAns) : {}
    
    // Collect all questions from all categories
    const allQuestions = []
    if (questionnaire && Array.isArray(questionnaire.categories)) {
      for (const cat of questionnaire.categories) {
        if (Array.isArray(cat.questions)) {
          allQuestions.push(...cat.questions)
        }
      }
    }

    // Check if each question has at least one answer
    const unansweredQuestions = []
    for (const q of allQuestions) {
      const answer = answers[q.id]
      const emptyArray = Array.isArray(answer) && answer.length === 0
      const emptyObject = answer && typeof answer === 'object' && !Array.isArray(answer) && Object.keys(answer).length === 0

      if (answer === null || answer === undefined || answer === '' || emptyArray || emptyObject) {
        unansweredQuestions.push(q.title || `Question ${q.id}`)
      }
    }

    if (unansweredQuestions.length > 0) {
      setValidationError(`Les questions suivantes doivent être répondues : ${unansweredQuestions.join(', ')}`)
      return false
    }

    return true
  }

  function handleTerminateClick() {
    if (validateAnswers()) {
      setValidationError(null)
      console.log('Terminate button clicked, navigating to:', `/questionnaire/${id}/done`);
      navigate(`/questionnaire/${id}/done`);
      setTimeout(() => window.location.reload(), 100);
    }
  }

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}><Typography>Chargement...</Typography></Box>
  if (error) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}><Typography color="error">{error}</Typography></Box>
  if (!questionnaire) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}><Typography>Questionnaire introuvable</Typography></Box>

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

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {validationError && (
        <Box sx={{ position: 'fixed', top: 20, left: 20, right: 20, zIndex: 1300 }}>
          <Alert severity="error" onClose={() => setValidationError(null)} sx={{ borderRadius: 2 }}>
            {validationError}
          </Alert>
        </Box>
      )}
      <QuestionnairePage 
        questionnaireId={id} 
        readOnly
        viewerMode="student"
        rightActions={
          <Button 
            variant="text"
            onClick={handleTerminateClick}
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
