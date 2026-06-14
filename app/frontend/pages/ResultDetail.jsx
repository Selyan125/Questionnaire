import React, { useEffect, useState } from 'react'
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { apiJson } from '../api/http.js'

async function fetchResultById(id) {
  try {
    return await apiJson(`/api/results/${id}`)
  } catch (err) {
    if (err && err.status === 404) {
      try { return await apiJson(`/api/submissions/${id}`) } catch (e) { throw err }
    }
    throw err
  }
}

export default function ResultDetail(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load(){
      setLoading(true); setError(null)
      try{
        const r = await fetchResultById(id)
        if (!mounted) return
        setResult(r)
      }catch(e){
        if (!mounted) return
        setError(e.message || String(e))
      }finally{ if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [id])

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Détail résultat</Typography>
        <Button variant="text" onClick={() => navigate('/dashboard')}>Retour</Button>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 5, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.08)' }}>
        {loading ? <Typography>Chargement...</Typography> : error ? <Typography color="error">{error}</Typography> : (
          <>
            {result && result.student && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontWeight: 700 }}>Étudiant</Typography>
                <Typography>{result.student.nom} {result.student.prenom}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{result.student.email}</Typography>
              </Box>
            )}
            
            {result && result.submittedAt && (
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontWeight: 700 }}>Date soumise</Typography>
                <Typography>{new Date(result.submittedAt).toLocaleString('fr-FR')}</Typography>
              </Box>
            )}

            {result && result.answers && Array.isArray(result.answers) && result.answers.length > 0 ? (
              <>
                <Typography sx={{ fontWeight: 700, mb: 2 }}>Réponses</Typography>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Question</TableCell>
                      <TableCell>Réponse</TableCell>
                      <TableCell align="right">Points</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.answers.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ maxWidth: 300 }}>{a.questionTitle || a.question || a.q || '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 400 }}>{Array.isArray(a.answer) ? a.answer.join(', ') : (a.answer ?? '—')}</TableCell>
                        <TableCell align="right">{a.score ?? a.points ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <Typography color="text.secondary">Aucune réponse enregistrée</Typography>
            )}
          </>
        )}
      </Paper>
    </Box>
  )
}
