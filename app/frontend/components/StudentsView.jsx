import React, { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment,
  IconButton, Switch, Tooltip, Chip, FormControlLabel
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import { listStudents, createStudent, updateStudent, generateStudentPassword } from '../api/students.js'
import { listTeachers } from '../api/teachers.js'
import { useNavigate } from 'react-router-dom'

export default function StudentsView() {
  const [students, setStudents] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  // UI state
  const [filter, setFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newIsTest, setNewIsTest] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingNom, setEditingNom] = useState('')
  const [editingPrenom, setEditingPrenom] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [sJson, tJson] = await Promise.all([
        listStudents(),
        listTeachers(),
      ])
      setStudents(sJson)
      // determine admin status from teachers list and current user
      const raw = localStorage.getItem('authUser')
      let current = null
      if (raw) {
        try { current = JSON.parse(raw) } catch (e) { current = null }
      }
      setUser(current)
      if (current && Array.isArray(tJson)) {
        const me = tJson.find(t => t.id === current.id)
        setIsAdmin(!!(me && me.admin))
      } else {
        setIsAdmin(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // generate/reset password (admin only)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState(null)
  const [generatedFor, setGeneratedFor] = useState(null)

  async function handleGeneratePassword(student) {
    try {
      const resp = await generateStudentPassword(student.id)
      const pass = resp && resp.password ? resp.password : null
      setGeneratedPassword(pass)
      setGeneratedFor(student.email)
      setPasswordDialogOpen(true)
    } catch (err) {
      setError(err.message)
    }
  }

  function startEditing(student) {
    setEditingId(student.id)
    setEditingNom(student.nom || '')
    setEditingPrenom(student.prenom || '')
  }

  async function saveEditing() {
    if (editingId === null) return
    try {
      // Update student with new nom/prenom via API
      await updateStudent(editingId, { nom: editingNom, prenom: editingPrenom })
      const studentIndex = students.findIndex(s => s.id === editingId)
      if (studentIndex !== -1) {
        students[studentIndex].nom = editingNom
        students[studentIndex].prenom = editingPrenom
        setStudents([...students])
      }
      setEditingId(null)
      setEditingNom('')
      setEditingPrenom('')
    } catch (err) {
      setError(err.message)
    }
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingNom('')
    setEditingPrenom('')
  }

  async function handleCreateStudent() {
    if (!newEmail) return
    try {
      await createStudent({ email: newEmail, isTest: newIsTest })
      setNewEmail('')
      setNewIsTest(false)
      setAddOpen(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleTest(student) {
    try {
      await updateStudent(student.id, { isTest: !student.isTest })
      // update local state
      const idx = students.findIndex(s => s.id === student.id)
      if (idx !== -1) {
        const copy = [...students]
        copy[idx].isTest = !student.isTest
        setStudents(copy)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = students
    .filter(s => s.email.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b.isTest ? 1 : 0) - (a.isTest ? 1 : 0))

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Rechercher..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            sx={{ width: 220 }}
          /> 
          <Button variant="text" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Ajouter</Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.06)', background: '#fff', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Typography>Chargement...</Typography>
          </Box>
        ) : (
          filtered.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="text.secondary">Aucun étudiant/enseignant ajouté</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto', flex: 1, minWidth: 0 }}>
              <Table size="medium" sx={{ minWidth: 0, width: '100%', '& .MuiTableCell-root': { py: 1.5 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Test</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Nom</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Prénom</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Accès</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ py: 1.5 }}>
                        {s.isTest && (
                          <Chip label="Test" size="small" color="secondary" variant="outlined" sx={{ fontSize: 10, fontWeight: 700 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        {editingId === s.id ? (
                          <TextField
                            size="small"
                            value={editingNom}
                            onChange={(e) => setEditingNom(e.target.value)}
                            sx={{ width: 120 }}
                          />
                        ) : (
                          s.nom || '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        {editingId === s.id ? (
                          <TextField
                            size="small"
                            value={editingPrenom}
                            onChange={(e) => setEditingPrenom(e.target.value)}
                            sx={{ width: 120 }}
                          />
                        ) : (
                          s.prenom || '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>{s.email}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        {isAdmin ? (
                          <Button size="small" variant="outlined" onClick={() => handleGeneratePassword(s)} sx={{ textTransform: 'none' }}>Générer mot de passe</Button>
                        ) : (
                          <Typography sx={{ color: 'text.secondary' }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        {editingId === s.id ? (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button size="small" variant="text" onClick={saveEditing}>Sauvegarder</Button>
                            <Button size="small" variant="text" onClick={cancelEditing}>Annuler</Button>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <Tooltip title="Éditer">
                              <IconButton size="small" onClick={() => startEditing(s)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {isAdmin && (
                              <Button size="small" variant="text" onClick={() => navigate(`/admin/student/${s.id}/results`)} sx={{ textTransform: 'none' }}>Résultats</Button>
                            )}
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title={s.isTest ? "Retirer mode test" : "Marquer comme test"}>
                              <Switch size="small" checked={!!s.isTest} onChange={() => toggleTest(s)} />
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )
        )}
      </Paper>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <DialogTitle>Ajouter un étudiant</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 420 }}>
          <FormControlLabel
            control={
              <Switch checked={newIsTest} onChange={(e) => setNewIsTest(e.target.checked)} />
            }
            label="Marquer comme compte de test"
            sx={{ mb: 1 }}
          />
          <TextField label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuler</Button>
          <Button variant="text" onClick={handleCreateStudent}>Ajouter</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>Mot de passe généré</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 420 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Utilisateur: {generatedFor || '—'}</Typography>
          <TextField label="Mot de passe" value={generatedPassword || ''} fullWidth InputProps={{ readOnly: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            if (generatedPassword && navigator && navigator.clipboard) navigator.clipboard.writeText(generatedPassword)
          }}>Copier</Button>
          <Button onClick={() => setPasswordDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
