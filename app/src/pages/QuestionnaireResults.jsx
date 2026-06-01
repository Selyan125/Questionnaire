import React, { useEffect, useState } from 'react'
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuestionnaire, getQuestionnaireResults } from '../api/questionnaires.js'

export default function QuestionnaireResults(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [results, setResults] = useState([])

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
    const cols = ['student', 'email', 'score', 'submittedAt']
    const lines = [cols.join(',')]
    for (const r of results) {
      const student = (r.student && (r.student.name || r.student.nom || r.student.email)) || (r.user && r.user.email) || r.email || ''
      const email = (r.student && r.student.email) || (r.user && r.user.email) || r.email || ''
      const score = typeof r.score !== 'undefined' ? r.score : (r.result && r.result.score) ? r.result.score : ''
      const submitted = r.submittedAt ? new Date(r.submittedAt).toISOString() : (r.submitted_at ? new Date(r.submitted_at).toISOString() : '')
      lines.push([`"${student.replace(/"/g,'""')}",` + `"${email}",` + `${score},` + `"${submitted}"`])
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${questionnaire?.title || 'results'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Résultats - {questionnaire?.title || 'Questionnaire'}</Typography>
        <Box>
          <Button variant="text" onClick={() => navigate('/dashboard')}>Retour</Button>
          <Button variant="text" onClick={downloadCsv}>Exporter CSV</Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2 }}>
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
                    <TableCell>Email</TableCell>
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
                      <TableCell>{(r.student && r.student.email) || (r.user && r.user.email) || r.email || ''}</TableCell>
                      <TableCell>{typeof r.score !== 'undefined' ? r.score : (r.result && r.result.score) ? r.result.score : '—'}</TableCell>
                      <TableCell>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : (r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—')}</TableCell>
                      <TableCell>{rid ? <Button size="small" variant="text" onClick={() => navigate(`/admin/result/${rid}`)}>Détails</Button> : '—'}</TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Paper>
    </Box>
  )
}
