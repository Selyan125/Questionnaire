import React, { useState } from 'react'
import { Box, Paper, Typography, TextField, MenuItem, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { importUsers } from '../api/admin.js'
import { createQuestionnaire } from '../api/questionnaires.js'
import { apiJson } from '../api/http.js' // Assuming apiJson is available for new import

export default function AdminImport() {
  const [csv, setCsv] = useState('')
  const [targetRole, setTargetRole] = useState('student')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [jsonFile, setJsonFile] = useState(null) // New state for JSON file

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

  async function handleImport() {
    setError(null)
    setResults(null)
    
    if (targetRole === 'full_json') {
      if (!jsonFile) {
        setError('Veuillez sélectionner un fichier JSON.');
        return;
      }
    } else { // CSV import
      const users = parseCsv(csv);
      if (users.length === 0) {
        setError('Aucune ligne trouvée dans le CSV.');
        return;
      }
    }

    setLoading(true)
    try {
      let data;
      if (targetRole === 'full_json') {
        const fileContent = await jsonFile.text();
        const payload = JSON.parse(fileContent);
        // This API endpoint needs to be created in the backend
        data = await apiJson('/api/admin/import-all', { method: 'POST', json: payload });
        setResults([{ status: 'success', message: data.message || 'Importation complète réussie.' }]);
      } else { // CSV import for students or teachers
        data = await importUsers({ targetRole: targetRole.replace('_csv', ''), users: parseCsv(csv) });
        setResults(data && data.results ? data.results : null);
      }
    } catch (err) {
      console.error('Import error:', err);
      const errorMsg = err.message || 'Erreur lors de l\'importation';
      setError(errorMsg);
      setResults([{ status: 'error', message: errorMsg }]);
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
          {targetRole === 'full_json'
            ? 'Sélectionnez un fichier JSON contenant une sauvegarde complète (questionnaires, étudiants, enseignants).'
            : 'Format CSV: email,nom,prenom | Les mots de passe sont générés automatiquement.'
          }
        </Typography>

        <TextField
          select
          label="Type d'importation"
          value={targetRole}
          onChange={(e) => {
            setTargetRole(e.target.value);
            setCsv(''); // Clear CSV when changing type
            setJsonFile(null); // Clear JSON file when changing type
            setResults(null); // Clear results
            setError(null); // Clear error
          }}
          sx={{ mb: 2, width: 280 }}
        >
          <MenuItem value="student_csv">Étudiants (CSV)</MenuItem>
          <MenuItem value="teacher_csv">Enseignants (CSV)</MenuItem>
          <MenuItem value="full_json">Sauvegarde complète (JSON)</MenuItem>
        </TextField>

        {targetRole === 'full_json' ? (
          <Box sx={{ mb: 2 }}>
            <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5, textTransform: 'none', borderRadius: 2 }}>
              {jsonFile ? jsonFile.name : 'Sélectionner un fichier JSON'}
              <input type="file" accept="application/json" hidden onChange={(e) => setJsonFile(e.target.files ? e.target.files[0] : null)} />
            </Button>
          </Box>
        ) : (
          <TextField label="Données CSV" placeholder="ex: user1@example.com,Nom,Prenom" multiline minRows={6} fullWidth value={csv} onChange={(e) => setCsv(e.target.value)} sx={{ mb: 2 }} />
        )}

        {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

        <Button variant="contained" onClick={handleImport} disabled={loading}>{loading ? 'Importation...' : 'Importer'}</Button>

        {results && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1">Résultats</Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email / Élément</TableCell>
                  <TableCell>Statut</TableCell>
                  {targetRole !== 'full_json' && <TableCell>Mot de passe généré</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.email || (r.input && r.input.email) || r.message || ''}</TableCell>
                    <TableCell>{r.status}{r.reason ? ` (${r.reason})` : ''}</TableCell>
                    {targetRole !== 'full_json' && <TableCell>{r.password || ''}</TableCell>}
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
