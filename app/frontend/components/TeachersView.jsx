import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Tooltip, Checkbox, FormControlLabel, Switch, InputAdornment } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import LockResetIcon from '@mui/icons-material/LockReset'
import DeleteIcon from '@mui/icons-material/Delete'
import { listTeachers, createTeacher, resetTeacherPassword, deleteTeachers, updateTeacher } from '../api/teachers.js'

export default function TeachersView() {
  const [teachers, setTeachers] = useState([])
  const [error, setError] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  // UI state for add
  const [addOpen, setAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newNom, setNewNom] = useState('')
  const [newPrenom, setNewPrenom] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  // UI state for edit
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editEmail, setEditEmail] = useState('')
  const [editNom, setEditNom] = useState('')
  const [editPrenom, setEditPrenom] = useState('')
  const [editIsAdmin, setEditIsAdmin] = useState(false)

  // UI state for password reset confirmation
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [teacherToReset, setTeacherToReset] = useState(null)

  // UI state for admin warning
  const [adminWarningOpen, setAdminWarningOpen] = useState(false)

  function formatTeacher(t) {
    if (!t) return ''
    const last = t.nom || t.lastName || ''
    const first = t.prenom || t.name || t.firstName || ''
    const fullname = [last, first].filter(Boolean).join(' ').trim()
    return fullname ? `${fullname} (${t.email || ''})` : (t.email || '')
  }

  async function load() {
    setError(null)
    try {
      const tJson = await listTeachers()
      setTeachers(tJson)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreateTeacher() {
    if (!newEmail) return
    try {
      const result = await createTeacher({ email: newEmail, password: newPassword, nom: newNom, prenom: newPrenom })
      setNewEmail('')
      setNewNom('')
      setNewPrenom('')
      setNewPassword('')
      if (result?.password) {
        setGeneratedPassword(result.password)
        setPasswordDialogOpen(true)
      }
      setAddOpen(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleEditTeacher(t) {
    setEditingId(t.id)
    setEditEmail(t.email || '')
    setEditNom(t.nom || t.lastName || '')
    setEditPrenom(t.prenom || t.name || t.firstName || '')
    setEditIsAdmin(!!t.admin)
    setEditOpen(true)
  }

  async function handleUpdateTeacher() {
    if (!editEmail) return
    try {
      await updateTeacher(editingId, {
        email: editEmail,
        nom: editNom,
        prenom: editPrenom,
        admin: editIsAdmin
      })
      setEditOpen(false)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function askResetPassword(teacher) {
    setTeacherToReset(teacher)
    setConfirmResetOpen(true)
  }

  async function handleResetPassword() {
    if (!teacherToReset) return
    try {
      const result = await resetTeacherPassword(teacherToReset.id)
      if (result?.password) {
        setGeneratedPassword(result.password)
        setConfirmResetOpen(false)
        setPasswordDialogOpen(true)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return
    if (!window.confirm(`Supprimer ${selectedIds.length} enseignant(s) ?`)) return
    try {
      await deleteTeachers(selectedIds)
      setSelectedIds([])
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ textTransform: 'none', borderRadius: 100, px: 3 }}>Ajouter</Button>
          {selectedIds.length > 0 && (
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleBulkDelete} sx={{ textTransform: 'none', borderRadius: 100, px: 2 }}>
              Supprimer ({selectedIds.length})
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 1.5, borderRadius: 6, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', height: '100%', minHeight: 0 }}>
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
            <Typography sx={{ fontWeight: 800, mb: 1.5, color: '#1a1a1b' }}>Liste des enseignants</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {teachers.map(t => (
                <Box key={t.id} sx={{ p: 1.5, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, border: '1px solid transparent', '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', borderColor: 'rgba(0,0,0,0.05)' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {t.id !== 1 && (
                      <Checkbox size="small" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                    )}
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1a1a1b' }}>{formatTeacher(t)}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t.admin ? 'Administrateur' : 'Enseignant'}</Typography>
                    </Box>
                  </Box>
                  {t.id !== 1 && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Modifier">
                        <IconButton size="small" color="primary" onClick={() => handleEditTeacher(t)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => { setSelectedIds([t.id]); handleBulkDelete(); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Paper>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#1a1a1b', fontWeight: 700 }}>Ajouter un enseignant</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 400 }}>
          <TextField label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField label="Nom" value={newNom} onChange={(e) => setNewNom(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField label="Prénom" value={newPrenom} onChange={(e) => setNewPrenom(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField
            label="Mot de passe (optionnel)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Laissez vide pour générer automatiquement un mot de passe"
            fullWidth
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Annuler</Button>
          <Button variant="contained" onClick={handleCreateTeacher} disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Ajouter</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }}>
        <DialogTitle sx={{ color: '#1a1a1b', fontWeight: 700 }}>Modifier l'enseignant</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 400, pt: 1 }}>
          <TextField label="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField label="Nom" value={editNom} onChange={(e) => setEditNom(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField label="Prénom" value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }} />
          <TextField 
            label="Changer le mot de passe" 
            type="password" 
            value="********"
            disabled
            helperText="Utilisez les boutons ci-dessous pour modifier l'accès"
            fullWidth 
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={editIsAdmin} 
                disabled={editingId === 1}
                onChange={(e) => {
                  if (e.target.checked) setAdminWarningOpen(true);
                  else setEditIsAdmin(false);
                }} 
              />
            }
            label="Administrateur"
          />
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button 
              size="small" 
              variant="contained" 
              disableElevation
              onClick={() => { 
                setEditOpen(false); 
                askResetPassword(teachers.find(t => t.id === editingId)); 
              }}
              startIcon={<LockResetIcon />}
              sx={{ textTransform: 'none', borderRadius: 100, bgcolor: 'rgba(0,0,0,0.05)', color: 'text.primary', px: 2, '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }}
            >
              Nouveau mot de passe
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Annuler</Button>
          <Button variant="contained" onClick={handleUpdateTeacher} disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmResetOpen} onClose={() => setConfirmResetOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }}>
        <DialogTitle sx={{ color: '#1a1a1b', fontWeight: 700 }}>Réinitialiser le mot de passe</DialogTitle>
        <DialogContent>
          <Typography>Voulez-vous vraiment réinitialiser le mot de passe de <strong>{teacherToReset?.email}</strong> ?</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirmResetOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Annuler</Button>
          <Button color="primary" onClick={handleResetPassword} variant="contained" disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Confirmer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adminWarningOpen} onClose={() => setAdminWarningOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }}>
        <DialogTitle sx={{ color: 'warning.main', fontWeight: 700 }}>Attention : Droits Administrateur</DialogTitle>
        <DialogContent>
          <Typography>
            Promouvoir cet utilisateur en tant qu'<strong>administrateur</strong> lui donnera un accès complet au panneau de gestion, 
            incluant la possibilité de modifier ou supprimer d'autres enseignants ainsi que tous les questionnaires.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAdminWarningOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Annuler</Button>
          <Button variant="contained" color="primary" onClick={() => { setEditIsAdmin(true); setAdminWarningOpen(false); }} disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Confirmer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }}>
        <DialogTitle sx={{ color: '#1a1a1b', fontWeight: 700 }}>Mot de passe généré</DialogTitle>
        <DialogContent>
          <Typography>Copiez ce mot de passe pour le transmettre à l'enseignant :</Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography sx={{ fontWeight: 700, wordBreak: 'break-word', fontFamily: 'monospace' }}>{generatedPassword}</Typography>
            <Button size="small" variant="contained" disableElevation onClick={() => navigator.clipboard.writeText(generatedPassword)} sx={{ borderRadius: 100, px: 2 }}>
              Copier
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setPasswordDialogOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
