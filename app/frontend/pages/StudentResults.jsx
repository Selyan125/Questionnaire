import React, { useEffect, useState } from 'react'
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { getStudentResults } from '../api/students.js'

export default function StudentResults(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])
  const [studentInfo, setStudentInfo] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load(){
      setLoading(true)
      setError(null)
      try{
        const r = await getStudentResults(id)
        if (!mounted) return
        // server may return { student, results } or array
        if (r && r.student) setStudentInfo(r.student)
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
    const cols = ['nom', 'prenom', 'année', 'email', 'questionnaire', 'session', 'evaluateur', 'note', 'date']
    const lines = [cols.join(',')]
    for (const r of results) {
      const q = (r.questionnaire && (r.questionnaire.title || r.questionnaire.name)) || r.questionnaireTitle || ''
      const year = studentInfo?.year || ''
      const session = r.session?.name || 'N/A'
      const evaluator = r.evaluator || 'N/A'
      const score = typeof r.score !== 'undefined' ? r.score : (r.result && r.result.score) ? r.result.score : ''
      const submitted = r.submittedAt ? new Date(r.submittedAt).toISOString() : (r.submitted_at ? new Date(r.submitted_at).toISOString() : '')
      lines.push([
        `"${(studentInfo?.nom || '').replace(/"/g, '""')}"`,
        `"${(studentInfo?.prenom || '').replace(/"/g, '""')}"`,
        `"${String(year).replace(/"/g, '""')}"`,
        `"${studentInfo?.email || ''}"`,
        `"${q.replace(/"/g,'""')}"`,
        `"${session.replace(/"/g,'""')}"`,
        `"${evaluator.replace(/"/g,'""')}"`,
        score,
        `"${submitted}"`
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${studentInfo?.email || 'student-results'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Résultats - {studentInfo?.email || 'Étudiant'}</Typography>
        <Box>
          <Button variant="text" onClick={() => navigate('/dashboard')}>Retour</Button>
          <Button variant="text" onClick={downloadCsv}>Exporter CSV</Button>
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
              <Typography>Aucun résultat trouvé pour cet étudiant</Typography>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Questionnaire</TableCell>
                    <TableCell>Session</TableCell> {/* Nouvelle colonne */}
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
                      <TableCell>{(r.questionnaire && (r.questionnaire.title || r.questionnaire.name)) || r.questionnaireTitle || 'N/A'}</TableCell>
                      <TableCell>{(r.session && r.session.name) || 'N/A'}</TableCell> {/* Afficher le nom de la session */}
                      <TableCell sx={{ fontSize: 13 }}>{r.evaluator || '—'}</TableCell>
                      <TableCell>{typeof r.score !== 'undefined' ? r.score : (r.result && r.result.score) ? r.result.score : '—'}</TableCell>
                      <TableCell>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : (r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—')}</TableCell>
                      <TableCell> 
                        {rid ? <Button size="small" variant="text" onClick={() => navigate(`/admin/result/${rid}`)} sx={{ borderRadius: 3, textTransform: 'none' }}>Détails</Button> : '—'}
                      </TableCell>
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
