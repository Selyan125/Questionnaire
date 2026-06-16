import React, { useEffect, useState } from 'react'
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Divider } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuestionnaire, getQuestionnaireResults } from '../api/questionnaires.js'

export default function QuestionnaireResults(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [results, setResults] = useState([])
  const [selectedSubmission, setSelectedSubmission] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load(){
      setLoading(true)
      setError(null)
      try{
        const [q, r] = await Promise.all([
          getQuestionnaire(id),
          getQuestionnaireResults(id),
        ])
        if (!mounted) return
        setQuestionnaire(q)
        setResults(Array.isArray(r) ? r : (r && r.results) ? r.results : [])
      }catch(e){
        if (!mounted) return
        setError(e.message || String(e))
      }finally{
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  function downloadCsv() {
    if (!results || !results.length) { console.warn('Aucun résultat à exporter'); return }

    // Préparation des colonnes dynamiques pour les questions
    const questionCols = []
    const questionMap = [] // Pour retrouver l'ordre
    if (questionnaire && questionnaire.categories) {
      questionnaire.categories.forEach(cat => {
        const sortedQs = [...(cat.questions || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0))
        sortedQs.forEach(q => {
          questionCols.push(`"${cat.title.replace(/"/g, '""')} - ${q.title.replace(/"/g, '""')}"`)
          questionMap.push(q)
        })
      })
    }

    const cols = ['nom', 'prenom', 'année', 'email', 'jury', 'juryTeachers', 'session', 'evaluator', 'score', 'submittedAt', ...questionCols]
    const lines = [cols.join(',')]

    for (const r of results) {
      const nom = r.student?.nom || ''
      const prenom = r.student?.prenom || ''
      const year = r.student?.year || ''
      const email = (r.student && r.student.email) || (r.user && r.user.email) || r.email || ''
      const jury = r.juryName || ''
      const juryTeachers = r.juryTeachers?.join('; ') || ''
      const session = r.sessionName || ''
      const evaluator = r.evaluator || ''
      const score = typeof r.score !== 'undefined' ? r.score : (r.result && r.result.score) ? r.result.score : ''
      const submitted = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('fr-FR') : (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '')

      // Extraction des réponses pour ce résultat
      const answers = questionMap.map(q => {
        const ans = r.answers[q.id]
        if (ans === undefined || ans === null) return '""'
        
        const selectedIds = Array.isArray(ans) ? ans.map(String) : [String(ans)]
        const elements = q.elements.filter(e => selectedIds.includes(String(e.id)))
        const text = elements.map(e => e.title).join('; ') || String(ans)
        return `"${text.replace(/"/g, '""')}"`
      })

      lines.push([
        `"${nom.replace(/"/g,'""')}"`, 
        `"${prenom.replace(/"/g,'""')}"`, 
        `"${String(year).replace(/"/g,'""')}"`,
        `"${email}"`, 
        `"${jury.replace(/"/g,'""')}"`, 
        `"${juryTeachers.replace(/"/g,'""')}"`, 
        `"${session.replace(/"/g,'""')}"`, 
        `"${evaluator.replace(/"/g,'""')}"`, 
        score, 
        `"${submitted}"`,
        ...answers
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${questionnaire?.title || 'results'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadSingleDetailedCsv(r) {
    if (!r || !questionnaire) return
    const cols = ['Nom', 'Prénom', 'Année', 'Catégorie', 'Question', 'Réponse', 'Points', 'Type d\'évaluation']
    const lines = [cols.join(',')]
    
    const nom = r.student?.nom || ''
    const prenom = r.student?.prenom || ''
    const year = r.student?.year || ''
    
    questionnaire.categories.forEach(cat => {
      const sortedQs = [...(cat.questions || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0))
      sortedQs.forEach(q => {
        const ans = r.answers[q.id]
        const selectedIds = Array.isArray(ans) ? ans.map(String) : [String(ans)]
        const elements = q.elements.filter(e => selectedIds.includes(String(e.id)))
        
        const responseText = elements.map(e => e.title).join('; ') || 'Aucune réponse'
        
        const evaluatingElements = elements.filter(e => Number(e.evaluatingType || 0) !== 0)
        
        const pointsValue = evaluatingElements
            .map(e => Number(e.evaluatingValue || 0))
            .join('; ')

        const typeLabel = evaluatingElements
            .map(e => {
                const type = Number(e.evaluatingType || 0)
                if (type === 1) return 'ajoute'
                if (type === 2) return 'enlève'
                if (type === 3) return 'coefficient'
                if (type === 5) return 'plafond catégorie'
                return ''
            })
            .join('; ')

        lines.push([
          `"${nom.replace(/"/g, '""')}"`,
          `"${prenom.replace(/"/g, '""')}"`,
          `"${String(year).replace(/"/g, '""')}"`,
          `"${cat.title.replace(/"/g, '""')}"`,
          `"${q.title.replace(/"/g, '""')}"`,
          `"${responseText.replace(/"/g, '""')}"`,
          `"${pointsValue}"`,
          `"${typeLabel.replace(/"/g, '""')}"`
        ].join(','))
      })
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `details-${r.student?.nom || 'resultat'}-${r.student?.prenom || ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Résultats {"de " + questionnaire?.title || 'du questionnaire'}</Typography>
          <Box>
            <Button variant="text" onClick={() => navigate('/dashboard')} sx={{ borderRadius: 100, textTransform: 'none' }}>Retour</Button>
            <Button variant="text" onClick={downloadCsv} sx={{ borderRadius: 100, textTransform: 'none' }}>Exporter CSV</Button>
          </Box>
        </Box>

        <Paper sx={{ p: 2, borderRadius: 5, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.08)' }}>
          {loading ? (
            <Typography>Chargement...</Typography>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <>
              {results.length === 0 ? (
                <Typography>Aucun résultat pour ce questionnaire</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Étudiant</TableCell>
                      <TableCell>Jury / Session</TableCell>
                      <TableCell>Évaluateur</TableCell>
                      <TableCell>Score</TableCell>
                      <TableCell>Soumis le</TableCell>
                      <TableCell>Détails</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((r, i) => {
                      const rid = r.id || r.resultId || r.submissionId || r._id
                      return (
                      <TableRow key={i}>
                        <TableCell>{(r.student && (r.student.name || r.student.nom || r.student.email)) || (r.user && r.user.email) || (r.email) || 'N/A'}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.juryName}</Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontStyle: 'italic' }}>
                          {r.juryTeachers?.join(', ')}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{r.sessionName}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{r.evaluator}</TableCell>
                      <TableCell>{typeof r.score !== 'undefined' ? r.score : (r.result && r.result.score) ? r.result.score : '—'}</TableCell>
                      <TableCell>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('fr-FR') : (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '—')}</TableCell>
                      <TableCell>{rid ? <Button size="small" variant="text" onClick={() => setSelectedSubmission(r)} sx={{ borderRadius: 100, textTransform: 'none' }}>Détails</Button> : '—'}</TableCell>
                    </TableRow>
                  )})}
                </TableBody>
                </Table>
              )}
            </>
          )}
        </Paper>
      </Box>

      {/* Modal de détails des réponses */}
      <Dialog 
        open={!!selectedSubmission} 
        onClose={() => setSelectedSubmission(null)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: '28px', p: 1 } }}
      >
      <DialogTitle sx={{ fontWeight: 800, color: '#1a1a1b' }}>
          Détails : {selectedSubmission?.student?.nom} {selectedSubmission?.student?.prenom}
          <Typography variant="body2" color="text.secondary">Score final : {selectedSubmission?.score} / {questionnaire?.maxScore}</Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ border: 'none' }}>
          <Stack spacing={4} sx={{ py: 1 }}>
            {questionnaire?.categories?.map(cat => (
              <Box key={cat.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: 1.5 }}>{cat.title}</Typography>
                {cat.currentNote > 0 && (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'error.main', bgcolor: 'rgba(211, 47, 47, 0.05)', px: 1, py: 0.2, borderRadius: 1 }}>Plafond : {cat.currentNote} pts</Typography>
                )}
              </Box>
                <Divider sx={{ mb: 2, mt: 0.5, opacity: 0.5 }} />
                <Stack spacing={2}>
                  {[...(cat.questions || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0)).map(q => {
                    const ans = selectedSubmission?.answers?.[q.id]
                    const selectedIds = Array.isArray(ans) ? ans.map(String) : [String(ans)]
                    const elements = q.elements.filter(e => selectedIds.includes(String(e.id)))

                    return (
                      <Box key={q.id} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: '16px' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 0.5 }}>{q.title}</Typography>
                      <Stack spacing={1}>
                        {elements.length ? elements.map(e => {
                          const type = Number(e.evaluatingType || 0)
                          const val = Number(e.evaluatingValue || 0)
                          let pointText = ''
                          let isNegative = false

                          if (type === 1) pointText = `+${val} pts`
                          else if (type === 2) { pointText = `-${val} pts`; isNegative = true }
                          else if (type === 3) pointText = `x${val} coef`
                          else if (type === 5) { pointText = 'Plafond catégorie'; isNegative = true }

                          return (
                            <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontSize: 14 }}>• {e.title}</Typography>
                              {pointText && (
                                <Typography variant="caption" sx={{ color: isNegative ? 'error.main' : 'text.secondary', fontWeight: 700, bgcolor: isNegative ? 'rgba(211, 47, 47, 0.05)' : 'transparent', px: 0.5, borderRadius: 1 }}>
                                  ({pointText})
                                </Typography>
                              )}
                            </Box>
                          )
                        }) : (
                          <Typography sx={{ fontSize: 14, color: 'text.disabled', fontStyle: 'italic' }}>Aucune réponse</Typography>
                        )}
                      </Stack>
                      </Box>
                    )
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => downloadSingleDetailedCsv(selectedSubmission)} variant="outlined" sx={{ borderRadius: 100, px: 3, mr: 'auto' }}>Exporter CSV</Button>
          <Button onClick={() => setSelectedSubmission(null)} variant="contained" disableElevation sx={{ borderRadius: 100, px: 4 }}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
