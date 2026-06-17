import React, { useEffect, useState, useMemo } from 'react'
import { Box, Paper, Typography, TextField, IconButton, Checkbox, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, FormControlLabel, Select, MenuItem } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { apiJson } from '../api/http.js'

export default function StudentsView() {
  const [students, setStudents] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [editOpen, setEditOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editPrenom, setEditPrenom] = useState('')
  const [editNom, setEditNom] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [sortBy, setSortBy] = useState('year')

  // UI state for delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteTargetIds, setDeleteTargetIds] = useState([])

  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const data = await apiJson('/api/students')
      setStudents(data)
    } catch (err) {
      setError('Impossible de charger les étudiants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleEditStudent = (s) => {
    setEditingStudent(s)
    setEditPrenom(s.prenom || '')
    setEditNom(s.nom || '')
    setEditEmail(s.email || '')
    setEditYear(s.year || '')
    setEditGroup(s.group || '')
    setEditOpen(true)
  }

  const handleUpdateStudent = async () => {
    try {
      await apiJson(`/api/students/${editingStudent.id}`, {
        method: 'PUT',
        json: {
          prenom: editPrenom,
          nom: editNom,
          email: editEmail,
          year: editYear,
          group: editGroup
        }
      })
      setEditOpen(false)
      await load()
    } catch (err) {
      setError('Erreur lors de la sauvegarde')
    }
  }

  const askDelete = (ids) => {
    setDeleteTargetIds(ids)
    setConfirmDeleteOpen(true)
  }

  const handleDeleteSelected = async () => {
    try {
      await apiJson('/api/students', {
        method: 'DELETE',
        json: { ids: deleteTargetIds }
      })
      setConfirmDeleteOpen(false)
      setDeleteTargetIds([])
      setSelectedIds([])
      load()
    } catch (err) {
      setError('Erreur lors de la suppression')
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === students.length) setSelectedIds([])
    else setSelectedIds(students.map(s => s.id))
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const hasMultipleYears = useMemo(() => {
    const years = new Set(students.map(s => s.year).filter(Boolean))
    return years.size > 1
  }, [students])

  const { sortedYears, groupedStudents } = useMemo(() => {
    const base = [...students].sort((a, b) => {
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.toLowerCase()
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })

    if (sortBy === 'name') {
      return {
        sortedYears: ['Liste alphabétique'],
        groupedStudents: { 'Liste alphabétique': base }
      }
    }

    const groups = base.reduce((acc, s) => {
      const yearLabel = s.year ? `Année ${s.year}` : 'Année non spécifiée'
      if (!acc[yearLabel]) acc[yearLabel] = []
      acc[yearLabel].push(s)
      return acc
    }, {})

    return {
      sortedYears: Object.keys(groups).sort(),
      groupedStudents: groups
    }
  }, [students, sortBy])

  if (loading) return <Typography sx={{ p: 2 }}>Chargement...</Typography>

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={students.length > 0 && selectedIds.length === students.length} indeterminate={selectedIds.length > 0 && selectedIds.length < students.length} onChange={toggleSelectAll} />}
            label={<Typography sx={{ fontSize: 14, fontWeight: 600 }}>Tout sélectionner</Typography>}
            sx={{ ml: 0.5 }}
          />
          {selectedIds.length > 0 && (
            <Button variant="contained" color="error" disableElevation startIcon={<DeleteIcon />} onClick={() => askDelete(selectedIds)} sx={{ textTransform: 'none', borderRadius: 100, py: 0.5, px: 2 }}>
              Supprimer ({selectedIds.length})
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>Trier par :</Typography>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            size="small"
            sx={{ 
              height: 32, 
              fontSize: 13, 
              borderRadius: 100, 
              bgcolor: 'rgba(0,0,0,0.03)',
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
            }}
          >
            <MenuItem value="year">Année</MenuItem>
            <MenuItem value="name">Nom</MenuItem>
          </Select>
        </Box>
      </Box>

      <Paper sx={{ p: 1.5, borderRadius: 6, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}

        <Box sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          p: 1,
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { 
            background: 'rgba(0, 0, 0, 0.05)', 
            borderRadius: '10px',
            '&:hover': { background: 'rgba(0, 0, 0, 0.15)' }
          }
        }}>
          {students.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', mt: 4, fontWeight: 500 }}>Aucun étudiant trouvé</Typography>
          ) : (
            sortedYears.map(year => (
              <Box key={year} sx={{ mb: 4 }}>
                <Typography sx={{ fontWeight: 800, mb: 1.5, color: '#1a1a1b', fontSize: 15, letterSpacing: -0.2 }}>{year}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {groupedStudents[year].map(s => (
                    <Box key={s.id} sx={{ p: 1.5, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, border: '1px solid transparent', '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', borderColor: 'rgba(0,0,0,0.05)' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox size="small" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1a1a1b' }}>{s.nom} {s.prenom}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {s.email}
                            {s.email && s.group ? ' • ' : ''}
                            {s.group ? `Groupe ${s.group}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Modifier">
                          <IconButton size="small" color="primary" onClick={() => handleEditStudent(s)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" color="error" onClick={() => askDelete([s.id])}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#1a1a1b', fontWeight: 700 }}>Modifier l'étudiant</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 400, pt: 1 }}>
          <TextField label="Prénom" value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField label="Nom" value={editNom} onChange={(e) => setEditNom(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField label="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Année" value={editYear} onChange={(e) => setEditYear(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
            <TextField label="Groupe" value={editGroup} onChange={(e) => setEditGroup(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Annuler</Button>
          <Button variant="contained" onClick={handleUpdateStudent} disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#1a1a1b', fontWeight: 700 }}>Confirmation de suppression</DialogTitle>
        <DialogContent>
          <Typography>Voulez-vous vraiment supprimer {deleteTargetIds.length > 1 ? `ces ${deleteTargetIds.length} étudiants` : "cet étudiant"} ?</Typography>
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>Cette action est irréversible et supprimera toutes les notes associées.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Annuler</Button>
          <Button color="error" variant="contained" disableElevation onClick={handleDeleteSelected} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Supprimer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}