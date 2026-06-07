import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { listTeachers, createTeacher, resetTeacherPassword } from '../api/teachers.js'

export default function TeachersView() {
  const [teachers, setTeachers] = useState([])
  const [error, setError] = useState(null)

  // UI state for add
  const [addOpen, setAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

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
      const result = await createTeacher({ email: newEmail, password: newPassword })
      setNewEmail('')
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

  async function handleResetPassword(teacher) {
    try {
      const result = await resetTeacherPassword(teacher.id)
      if (result?.password) {
        setGeneratedPassword(result.password)
        setPasswordDialogOpen(true)
      }
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
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Enseignants</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {teachers.map(t => (
                <Box key={t.id} sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box>
                    <Typography sx={{ fontSize: 14 }}>{formatTeacher(t)}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t.admin ? 'Administrateur' : 'Enseignant'}</Typography>
                  </Box>
                  <Button size="small" onClick={() => handleResetPassword(t)}>Réinitialiser le mot de passe</Button>
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
          <TextField
            label="Mot de passe (optionnel)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Laissez vide pour générer automatiquement un mot de passe"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreateTeacher}>Ajouter</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>Mot de passe généré</DialogTitle>
        <DialogContent>
          <Typography>Copiez ce mot de passe pour le transmettre à l'enseignant :</Typography>
          <Typography sx={{ mt: 2, fontWeight: 700, wordBreak: 'break-word' }}>{generatedPassword}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
