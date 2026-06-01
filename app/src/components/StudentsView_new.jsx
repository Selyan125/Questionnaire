import React, { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Select, MenuItem,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment, Switch
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import { listStudents, listJuries, assignStudentJury, createStudent, updateStudent } from '../api/students.js'
import { listTeachers } from '../api/teachers.js'
import { useNavigate } from 'react-router-dom'

export default function StudentsView() {
  const [students, setStudents] = useState([])
  const [juries, setJuries] = useState([])
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
      const [sJson, jJson, tJson] = await Promise.all([
        listStudents(),
        listJuries(),
        listTeachers(),
      ])
      setStudents(sJson)
      setJuries((jJson || []).map(j => j.name))
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

  async function assignJury(studentId, juryName) {
    try {
      await assignStudentJury(studentId, juryName)
      await load()
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

  const filtered = students.filter(s => s.email.toLowerCase().includes(filter.toLowerCase()))

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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Ajouter</Button>
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
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Nom</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Prénom</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Test</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Jury</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id} hover>
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
                        <Switch 
                          checked={s.isTest || false} 
                          onChange={(e) => {
                            updateStudent(s.id, { isTest: e.target.checked })
                            const idx = students.findIndex(st => st.id === s.id)
                            if (idx !== -1) {
                              students[idx].isTest = e.target.checked
                              setStudents([...students])
                            }
                          }}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        {editingId !== s.id && (
                          <Select size="small" value={s.assignedJury || ''} onChange={(e) => assignJury(s.id, e.target.value)} sx={{ minWidth: 140 }}>
                            <MenuItem value="">(aucun)</MenuItem>
                            {juries.map(j => <MenuItem key={j} value={j}>{j}</MenuItem>)}
                          </Select>
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        {editingId === s.id ? (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button size="small" variant="text" onClick={saveEditing}>Sauvegarder</Button>
                            <Button size="small" variant="text" onClick={cancelEditing}>Annuler</Button>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button size="small" variant="text" onClick={() => startEditing(s)}>Éditer</Button>
                            {isAdmin && (
                              <Button size="small" variant="text" onClick={() => navigate(`/admin/student/${s.id}/results`)} sx={{ textTransform: 'none' }}>Résultats</Button>
                            )}
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
          <TextField label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} fullWidth />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Mode test:</Typography>
            <Switch checked={newIsTest} onChange={(e) => setNewIsTest(e.target.checked)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreateStudent}>Ajouter</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
