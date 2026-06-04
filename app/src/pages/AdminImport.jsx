import React, { useState } from 'react'
import { Box, Paper, Typography, TextField, MenuItem, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { importUsers } from '../api/admin.js'
import { createQuestionnaire } from '../api/questionnaires.js'

export default function AdminImport() {
  const [csv, setCsv] = useState('')
  const [targetRole, setTargetRole] = useState('student')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const rows = []
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      // expect at least email in first column
      rows.push({ email: parts[0], nom: parts[1] || '', prenom: parts[2] || '' })
    }
    return rows
  }

  async function submit() {
    setError(null)
    setResults(null)
    const users = parseCsv(csv)
    if (users.length === 0) return setError('Aucune ligne trouvée')
    setLoading(true)
    try {
      const data = await importUsers({ targetRole, users })
      setResults(data && data.results ? data.results : null)
    } catch (err) {
      setError(err.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const navigate = useNavigate()

  async function handleCreateQuestionnaire() {
    setError(null)
    try {
      const data = await createQuestionnaire({ title: 'Nouveau questionnaire' })
      const id = data && (data.id || data._id || data.questionnaireId)
      if (id) navigate(`/admin/question-manager/${id}`)
      else navigate('/admin/question-manager')
    } catch (err) {
      setError(err.message || 'Erreur réseau')
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, maxWidth: 900 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Import CSV - étudiants / enseignants</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Format attendu: email,nom,prenom (ou juste email) — une ligne par utilisateur.
        </Typography>

        <TextField
          select
          label="Type"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          sx={{ mb: 2, width: 220 }}
        >
          <MenuItem value="student">Étudiant</MenuItem>
          <MenuItem value="teacher">Enseignant</MenuItem>
        </TextField>

        <TextField
          label="CSV"
          placeholder="ex: user1@example.com,Nom,Prenom"
          multiline
          minRows={6}
          fullWidth
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          sx={{ mb: 2 }}
        />

        {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

        <Button variant="contained" onClick={submit} disabled={loading}>{loading ? 'Import...' : 'Importer'}</Button>

        {results && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1">Résultats</Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Mot de passe généré</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.email || (r.input && r.input.email) || ''}</TableCell>
                    <TableCell>{r.status}{r.reason ? ` (${r.reason})` : ''}</TableCell>
                    <TableCell>{r.password || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
