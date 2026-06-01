import React, { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Select, MenuItem,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Chip, IconButton
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { listTeachers, listJuries, assignTeacherJury, createTeacher } from '../api/teachers.js'

export default function TeachersView() {
  const [teachers, setTeachers] = useState([])
  const [juries, setJuries] = useState([])
  const [error, setError] = useState(null)

  // UI state for add
  const [addOpen, setAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [dragOverJury, setDragOverJury] = useState(null)

  function formatTeacher(t) {
    if (!t) return ''
    const last = t.nom || t.lastName || t.name || ''
    const first = t.prenom || t.firstName || ''
    const fullname = [last, first].filter(Boolean).join(' ').trim()
    return fullname ? `${fullname} (${t.email || ''})` : (t.email || '')
  }

  async function load() {
    setError(null)
    try {
      const [tJson, jJson] = await Promise.all([
        listTeachers(),
        listJuries(),
      ])
      setTeachers(tJson)
      setJuries((jJson || []).map(j => j.name))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  async function assign(teacherId, juryName) {
    try {
      await assignTeacherJury(teacherId, juryName)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateTeacher() {
    if (!newEmail) return
    try {
      await createTeacher({ email: newEmail })
      setNewEmail('')
      setAddOpen(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button variant="text" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ textTransform: 'none' }}>Ajouter</Button>
      </Box>

      <Paper sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.06)', background: '#fff', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', height: '100%', minHeight: 0 }}>
          {/* Left: juries droppable groups */}
          <Box sx={{ flex: 1, minWidth: 280, maxWidth: 520, overflowY: 'auto', p: 1, borderRight: '1px solid rgba(0,0,0,0.08)', pr: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Juries</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* droppable area to unassign (aucun) */}
              <Box
                onDragOver={(e) => { e.preventDefault(); setDragOverJury('') }}
                onDragLeave={() => setDragOverJury(null)}
                onDrop={async (e) => {
                  e.preventDefault(); setDragOverJury(null)
                  const teacherId = e.dataTransfer.getData('text/plain')
                  if (!teacherId) return
                  try { await assign(teacherId, '') } catch (err) {}
                }}
                sx={{ p: 1, borderRadius: 1, minHeight: 40, display: 'flex', alignItems: 'center', gap: 1, bgcolor: dragOverJury === '' ? 'rgba(0,0,0,0.04)' : 'transparent' }}
              >
                <Typography sx={{ fontWeight: 600, color: 'text.secondary' }}>(aucun)</Typography>
              </Box>

              {juries.map(j => (
                <Box
                  key={j}
                  onDragOver={(e) => { e.preventDefault(); setDragOverJury(j) }}
                  onDragLeave={() => setDragOverJury(null)}
                  onDrop={async (e) => {
                    e.preventDefault(); setDragOverJury(null)
                    const teacherId = e.dataTransfer.getData('text/plain')
                    if (!teacherId) return
                    const existing = teachers.find(t => String(t.id) === String(teacherId) && (t.jury || '') === j)
                    if (existing) { console.warn('Enseignant déjà présent dans ce jury'); return }
                    try {
                      await assign(teacherId, j)
                    } catch (err) { /* handled in assign */ }
                  }}
                  sx={{ p: 1, borderRadius: 1, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, bgcolor: dragOverJury === j ? 'rgba(0,0,0,0.04)' : 'transparent' }}
                >
                  <Typography sx={{ fontWeight: 600 }}>{j}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {(teachers.filter(t => t.jury === j) || []).map(t => (
                      <Box key={t.id} draggable onDragStart={(ev) => ev.dataTransfer.setData('text/plain', String(t.id))}>
                        <Chip size="small" label={formatTeacher(t)} onDelete={() => assign(t.id, '')} sx={{ mr: 0.5 }} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Right: list of all teachers draggable */}
          <Box sx={{ flex: 1.2, overflowY: 'auto', p: 1 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Enseignants</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {teachers.map(t => (
                <Box key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))} sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 14 }}>{formatTeacher(t)}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t.jury || '—'}</Typography>
                    <IconButton size="small" onClick={() => assign(t.id, '')} aria-label="retirer"><CloseIcon fontSize="small" /></IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Paper>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <DialogTitle>Ajouter un enseignant</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 400 }}>
          <TextField label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreateTeacher}>Ajouter</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
