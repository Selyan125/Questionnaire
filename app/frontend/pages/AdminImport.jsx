import React, { useState, useEffect } from 'react'
import { Box, Paper, Typography, TextField, MenuItem, Button, Table, TableBody, TableCell, TableHead, TableRow, Stack, Divider, FormControlLabel, Switch, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { importUsers } from '../api/admin.js'
import { createQuestionnaire } from '../api/questionnaires.js'
import { apiJson, apiFetch } from '../api/http.js' // Assuming apiJson is available for new import
//import { useSnackbar } from 'notistack'

export default function AdminImport() {
  const [csv, setCsv] = useState('')
  const [targetRole, setTargetRole] = useState('teacher_csv')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false); 
  const [jsonFile, setJsonFile] = useState(null)
  
  // States pour l'import de questions
  const [questionnaires, setQuestionnaires] = useState([])
  const [selectedQId, setSelectedQId] = useState('new')
  const [qConfig, setQConfig] = useState({ title: 'Import Questions', maxScore: 20, gradingMode: 'points' })

  // States pour l'ajout manuel d'un étudiant
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [newStudent, setNewStudent] = useState({ nom: '', prenom: '', year: '', group: '', email: '' })
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    async function loadQ() {
      try {
        const data = await apiJson('/api/questionnaires')
        setQuestionnaires(data || [])
      } catch (e) { console.error(e) }
    }
    loadQ()
  }, [])

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const rows = []
    // On commence à i=1 pour ignorer la ligne d'en-tête (Nom, Prénom, Email)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split(',')
      const cleanParts = parts.map(p => p.trim().replace(/^"|"$/g, ''))

      if (targetRole === 'teacher_csv') {
        // Format attendu pour enseignants : nom, prenom, email
        rows.push({
          nom: cleanParts[0] || '',
          prenom: cleanParts[1] || '',
          email: cleanParts[2] || ''
        })
      } else if (targetRole === 'student_csv') {
        // Format attendu pour étudiants : nom, prenom, année, groupe, email
        rows.push({
          nom: cleanParts[0] || '',
          prenom: cleanParts[1] || '',
          year: cleanParts[2] || '',
          group: cleanParts[3] || '',
          email: cleanParts[4] || ''
        })
      }
    }
    return rows
  }

  const handleExportResultsCsv = () => {
    if (!results || !results.length) return
    const isTeacher = targetRole === 'teacher_csv'
    const headers = ['Nom', 'Prénom', 'Email']
    if (isTeacher) headers.push('Mot de passe')
    
    const lines = [headers.join(',')]
    results.forEach(r => {
      const input = r.input || {}
      // On ne veut pas exporter les emails techniques ou N/A
      const displayEmail = (r.email || input.email || '');
      const cleanEmail = (displayEmail === 'N/A' || displayEmail.includes('_')) ? '' : displayEmail;

      const row = [
        `"${(input.nom || '').replace(/"/g, '""')}"`,
        `"${(input.prenom || '').replace(/"/g, '""')}"`,
        `"${cleanEmail.replace(/"/g, '""')}"`
      ]
      if (isTeacher) row.push(`"${(r.password || '').replace(/"/g, '""')}"`)
      lines.push(row.join(','))
    })
    
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `resultats_import_${targetRole}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDraggingOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDraggingOver(false)
    setError(null)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target.result;
        if (targetRole === 'full_json') {
            setJsonFile(file);
        } else {
            setCsv(content);
        }
        // Le changement de state étant asynchrone, l'import utilisera 
        // les valeurs passées ici ou via un effet. 
      };
      reader.readAsText(file)
    }
  }

  async function handleImport() {
    setError(null)
    setResults(null)
    
    if (targetRole === 'full_json') {
      if (!jsonFile) {
        setError('Veuillez sélectionner un fichier JSON.');
        return;
      }
    } else if (!csv) { // CSV import, check if csv content is present
        setError('Veuillez entrer des données CSV ou déposer un fichier.');
        return;
    } else if (parseCsv(csv).length === 0) {
      setError('Aucune ligne valide trouvée dans le CSV.');
      return;
    }

    setLoading(true)
    try {
      let data;
      if (targetRole === 'full_json') {
        const fileContent = await jsonFile.text();
        const payload = JSON.parse(fileContent);
        // This API endpoint needs to be created in the backend
        data = await apiJson('/api/admin/import-all', { method: 'POST', json: payload });
        setResults([{ status: 'success', reason: data.message || 'Importation complète réussie.' }]);
      } else if (targetRole === 'questions_csv') {
        data = await apiJson('/api/questionnaires/import-questions-csv', {
          method: 'POST',
          json: {
            csv,
            questionnaireId: selectedQId === 'new' ? null : selectedQId,
            config: qConfig
          }
        })
        setResults([{ status: 'success', reason: 'Questions importées avec succès.' }])
        if (data.questionnaireId) navigate(`/admin/question-manager/${data.questionnaireId}`)
      } else { // CSV import for students or teachers
        data = await importUsers({ targetRole: targetRole.replace('_csv', ''), users: parseCsv(csv) });
        setResults(data && data.results ? data.results : null);
      }
    } catch (err) {
      console.error('Import error:', err);
      const errorMsg = err.message || 'Erreur lors de l\'importation';
      setError(errorMsg);
      setResults([{ status: 'error', reason: errorMsg }]);
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickAddStudent() {
    if (!newStudent.nom || !newStudent.prenom) {
      alert('Nom et prénom requis.');
      return;
    }
    setIsAdding(true);
    try {
      await apiJson('/api/students', { method: 'POST', json: newStudent });
      setNewStudent({ nom: '', prenom: '', year: '', group: '', email: '' });
      setShowManualAdd(false);
      alert('Étudiant ajouté avec succès !');
    } catch (err) { alert(err.message || 'Erreur lors de l\'ajout'); }
    finally { setIsAdding(false); }
  }

  async function handleStudentExportCsv() {
    try {
      const resp = await apiFetch('/api/questionnaires/students/export-csv')
      if (!resp.ok) throw new Error("Erreur export")
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export_etudiants_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) { alert("Erreur lors de l'export des étudiants") }
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
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => setShowManualAdd(true)} sx={{ borderRadius: 100, textTransform: 'none' }}>
              + Ajouter un étudiant
            </Button>
            <Button variant="outlined" size="small" color="secondary" onClick={handleStudentExportCsv} sx={{ borderRadius: 100, textTransform: 'none' }}>
              Exporter la liste
            </Button>
          </Stack>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {targetRole === 'full_json'
            ? 'Sélectionnez un fichier JSON contenant une sauvegarde complète (questionnaires, étudiants, enseignants).'
            : targetRole === 'teacher_csv'
              ? 'Format CSV : nom, prenom, email (optionnel)'
              : 'Format CSV : nom, prenom, année, groupe, email (optionnel)'
          }
        </Typography>

        <TextField
          select // No borderRadius here, it's handled by the root TextField style
          label="Type d'importation"
          value={targetRole}
          onChange={(e) => {
            setTargetRole(e.target.value);
            setCsv(''); // Clear CSV when changing type
            setJsonFile(null); // Clear JSON file when changing type
            setResults(null); // Clear results
            setError(null); // Clear error
          }}
        >
          <MenuItem value="student_csv">Étudiants (CSV)</MenuItem>
          <MenuItem value="teacher_csv">Enseignants (CSV)</MenuItem>
          <MenuItem value="questions_csv">Questions (CSV)</MenuItem>
          <MenuItem value="full_json">Sauvegarde complète (JSON)</MenuItem>
        </TextField>

        {targetRole === 'questions_csv' && (
          <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 3, border: '1px solid rgba(0,0,0,0.05)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>Destination de l'import</Typography>
            <Stack spacing={2}>
              <TextField
                select
                label="Importer dans..."
                value={selectedQId}
                onChange={(e) => setSelectedQId(e.target.value)}
                fullWidth
              >
                <MenuItem value="new">+ Créer un nouveau questionnaire</MenuItem>
                {questionnaires.map(q => (
                  <MenuItem key={q.id} value={q.id}>{q.title} (ID: {q.id})</MenuItem>
                ))}
              </TextField>
              
              {selectedQId === 'new' && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Titre" value={qConfig.title} onChange={(e) => setQConfig({ ...qConfig, title: e.target.value })} fullWidth />
                  <TextField label="Note Max" type="number" value={qConfig.maxScore} onChange={(e) => setQConfig({ ...qConfig, maxScore: e.target.value })} sx={{ width: 120 }} />
                  <TextField
                    select
                    label="Notation"
                    value={qConfig.gradingMode}
                    onChange={(e) => setQConfig({ ...qConfig, gradingMode: e.target.value })}
                    sx={{ width: 150 }}
                  >
                    <MenuItem value="points">Points</MenuItem>
                    <MenuItem value="coefficient">Coefficients</MenuItem>
                    <MenuItem value="percentage">Pourcentage</MenuItem>
                  </TextField>
                </Stack>
              )}
            </Stack>
          </Box>
        )}

        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            border: `2px dashed ${isDraggingOver ? 'primary.main' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: 4,
            p: 3,
            mb: 2,
            mt: 1,
            textAlign: 'center',
            bgcolor: isDraggingOver ? 'primary.light' : 'transparent',
            transition: 'background-color 0.3s, border-color 0.3s',
            cursor: 'pointer',
          }}
        >
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            Glissez-déposez un fichier ici ou
          </Typography>
          {targetRole === 'full_json' ? (
            <Button variant="outlined" component="label" sx={{ textTransform: 'none', borderRadius: 100, px: 3 }}>
              {jsonFile ? jsonFile.name : 'Sélectionner un fichier JSON'}
              <input type="file" accept="application/json" hidden onChange={(e) => setJsonFile(e.target.files ? e.target.files[0] : null)} />
            </Button>
          ) : (
            <Button variant="outlined" component="label" sx={{ textTransform: 'none', borderRadius: 100, px: 3 }}>
              {csv ? 'Fichier CSV chargé' : 'Sélectionner un fichier CSV'}
              <input type="file" accept=".csv" hidden onChange={(e) => {
                const file = e.target.files ? e.target.files[0] : null;
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => setCsv(event.target.result);
                  reader.readAsText(file);
                } else {
                  setCsv('');
                }
              }} />
            </Button>
          )}
        </Box>

        {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={handleImport} disabled={loading || (!csv && !jsonFile)} disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 4 }}>
            {loading ? 'Importation...' : 'Importer'}
          </Button>
          {results && results.length > 0 && (
            <Button variant="outlined" color="primary" onClick={handleExportResultsCsv} sx={{ borderRadius: 100, textTransform: 'none', px: 4 }}>
              Exporter ces résultats (avec mots de passe)
            </Button>
          )}
        </Stack>

        {results && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Détails de l'importation</Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom / Prénom</TableCell>
                  <TableCell>Email / Login</TableCell>
                  <TableCell>Statut</TableCell>
                  {targetRole === 'teacher_csv' && <TableCell>Mot de passe (Enseignants uniquement)</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{`${r.input?.nom || ''} ${r.input?.prenom || ''}`}</TableCell>
                    <TableCell>
                      {/* Masquer les emails techniques (contenant _) ou N/A */}
                      {r.email && !r.email.includes('_') && r.email !== 'N/A' 
                        ? r.email 
                        : (r.input?.email !== 'N/A' ? r.input?.email : '')}
                    </TableCell>
                    <TableCell>
                      <Typography color={['success', 'created', 'updated'].includes(r.status) ? 'success.main' : 'error.main'} sx={{ fontWeight: 600, fontSize: 14 }}>
                        {['success', 'created', 'updated'].includes(r.status) ? 'Réussi' : 'Erreur'}{(r.reason || r.message) ? ` : ${r.reason || r.message}` : ''}
                      </Typography>
                    </TableCell>
                    {targetRole === 'teacher_csv' && <TableCell>{r.password || ''}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Dialog open={showManualAdd} onClose={() => setShowManualAdd(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ajouter un étudiant</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nom" value={newStudent.nom} onChange={e => setNewStudent({...newStudent, nom: e.target.value})} fullWidth />
            <TextField label="Prénom" value={newStudent.prenom} onChange={e => setNewStudent({...newStudent, prenom: e.target.value})} fullWidth />
            <TextField label="Année" value={newStudent.year} onChange={e => setNewStudent({...newStudent, year: e.target.value})} fullWidth />
            <TextField label="Groupe" value={newStudent.group} onChange={e => setNewStudent({...newStudent, group: e.target.value})} fullWidth />
            <TextField label="Email (optionnel)" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowManualAdd(false)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button variant="contained" onClick={handleQuickAddStudent} disabled={isAdding} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>
            {isAdding ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
