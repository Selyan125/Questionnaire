import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Collapse,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import PersonIcon from '@mui/icons-material/Person'
import SchoolIcon from '@mui/icons-material/School'

export default function SessionsManagementDialog({
  open,
  onClose,
  sessions,
  availableTeachers,
  availableStudents,
  availableJuries,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onAddJury,
  onRemoveJury,
  onAddStudent,
  onRemoveStudent,
  onAddJuryMaster,
}) {
  const [selectedSessionTab, setSelectedSessionTab] = useState(0)
  const [editingName, setEditingName] = useState({})
  const [editingDate, setEditingDate] = useState({})
  const [newJuryName, setNewJuryName] = useState('')
  const [poolTab, setPoolTab] = useState(0)
  const [dragOverZone, setDragOverZone] = useState(null)

  const handleDragStart = (e, item, type) => {
    e.dataTransfer.setData('drag-type', type)
    const data = { ...item, dragType: type }
    e.dataTransfer.setData('application/json', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleNameChange = (sessionId, session, newName) => {
    setEditingName(prev => ({ ...prev, [sessionId]: newName }))
  }

  const handleDateChange = (sessionId, session, newDate) => {
    setEditingDate(prev => ({ ...prev, [sessionId]: newDate }))
  }

  const handleSaveSessionChanges = (sessionId, session) => {
    if (!session) return
    const currentName = editingName[sessionId] !== undefined ? editingName[sessionId] : session.name
    const currentDate = editingDate[sessionId] !== undefined ? editingDate[sessionId] : (session.date ? session.date.split('T')[0] : '')
    
    onUpdateSession(sessionId, currentName, currentDate || null, !!session.active)
  }

  const handleDrop = (e, sessionId, targetJuryId = null, expectedType = null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverZone(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      const dragType = data.dragType

      if (expectedType && dragType !== expectedType) return 

      if (dragType === 'teacher') {
        const juryId = targetJuryId || data.juryId || (availableJuries?.[0]?.id)
        if (juryId) onAddJury(sessionId, juryId, data.id)
      } else if (dragType === 'student') {
        const effectiveJuryId = targetJuryId || (sessions.find(s => s.id === sessionId)?.juries?.[0]?.juryId) || (availableJuries?.[0]?.id)
        if (effectiveJuryId) onAddStudent(sessionId, data.id, effectiveJuryId)
      }
    } catch (err) {
      console.error('Drop failed', err)
    }
  }

  const poolTeachers = useMemo(() => availableTeachers || [], [availableTeachers])
  const poolStudents = useMemo(() => availableStudents || [], [availableStudents])

  const currentSession = useMemo(() => sessions[selectedSessionTab], [sessions, selectedSessionTab])

  const juryGroups = useMemo(() => {
    if (!currentSession) return []
    const groups = {}
    
    ;(availableJuries || []).forEach(j => {
      groups[j.id] = { juryId: j.id, juryName: j.name, teachers: [], students: [] }
    })

    ;(currentSession.juries || []).forEach(sj => {
      if (groups[sj.juryId]) groups[sj.juryId].teachers.push(sj)
    })

    ;(currentSession.students || []).forEach(ss => {
      if (groups[ss.juryId]) groups[ss.juryId].students.push(ss)
    })

    return Object.values(groups)
  }, [currentSession, availableJuries])

  return (
    <Dialog
      fullWidth
      maxWidth="lg"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden', boxShadow: 'none', border: '1px solid rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ color: 'text.primary', bgcolor: 'background.paper', borderBottom: '1px solid rgba(0,0,0,0.08)', py: 2, fontWeight: 700 }}>
        Gestion des sessions d'oral
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: '#fbfbfb', p: 0, display: 'flex', height: '75vh' }}>
        {/* Left Pool Panel */}
        <Box sx={{ width: 300, borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', flexShrink: 0 }}>
          <Tabs value={poolTab} onChange={(_, v) => setPoolTab(v)} variant="fullWidth" sx={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <Tab icon={<PersonIcon />} label="Profs" sx={{ textTransform: 'none', minHeight: 64 }} />
            <Tab icon={<SchoolIcon />} label="Étudiants" sx={{ textTransform: 'none', minHeight: 64 }} />
          </Tabs>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
            <List size="small">
              {(poolTab === 0 ? poolTeachers : poolStudents).map((item) => (
                <ListItem
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item, poolTab === 0 ? 'teacher' : 'student')}
                  sx={{
                    mb: 1,
                    borderRadius: 1.5,
                    border: '1px solid rgba(0,0,0,0.06)',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    py: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:active': { cursor: 'grabbing' }
                  }}
                >
                  <DragIndicatorIcon sx={{ color: 'text.disabled', mr: 1, fontSize: 20 }} />
                  <ListItemText
                    sx={{ m: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                    primary={poolTab === 0 ? item.email : `${item.nom || ''} ${item.prenom || ''}`} 
                    secondary={poolTab === 1 ? item.email : (item.jury || 'Sans jury')}
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600, noWrap: true }}
                    secondaryTypographyProps={{ fontSize: 11, noWrap: true }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <Typography variant="caption" color="text.secondary">
              Glissez-déposez une personne sur une session pour l'assigner.
            </Typography>
          </Box>
        </Box>

        {/* Right Sessions Panel */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', px: 2, bgcolor: 'background.paper', gap: 1, minHeight: 56, flexShrink: 0 }}>
            <Tabs 
              value={selectedSessionTab} 
              onChange={(_, v) => setSelectedSessionTab(v)} 
              variant="scrollable" 
              scrollButtons="auto"
              sx={{ flex: 1, minWidth: 0, '& .MuiTabs-scroller': { overflow: 'hidden !important' } }}
            >
              {sessions.map((s) => (
                <Tab key={s.id} label={s.name} sx={{ textTransform: 'none', minHeight: 48 }} />
              ))}
            </Tabs>

            <IconButton size="small" onClick={onAddSession} sx={{ ml: 0.5, flexShrink: 0 }} title="Ajouter une session">
              <AddIcon />
            </IconButton>

            <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto', borderLeft: '1px solid rgba(0,0,0,0.08)', pl: 1.5, flexShrink: 0 }}>
              <TextField
                placeholder="Nom du jury..."
                value={newJuryName}
                onChange={(e) => setNewJuryName(e.target.value)}
                size="small"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newJuryName.trim()) {
                    await onAddJuryMaster(newJuryName)
                    setNewJuryName('')
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        variant="contained"
                        disableElevation
                        size="small"
                        onClick={async () => {
                          if (!newJuryName.trim()) return
                          await onAddJuryMaster(newJuryName)
                          setNewJuryName('')
                        }}
                        endIcon={<AddIcon />}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1, height: 32, mr: -0.5 }}
                      >
                        Créer jury
                      </Button>
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2, pr: 0.5, bgcolor: 'background.default' }
                }}
                sx={{ width: 220 }}
              />
            </Box>
          </Box>

          <Box 
            sx={{ 
              flex: 1, 
              p: 3, 
              overflowY: 'auto', 
              backgroundImage: 'radial-gradient(rgba(0,0,0,0.02) 1px, transparent 0)',
              backgroundSize: '20px 20px'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => currentSession && handleDrop(e, currentSession.id)}
          >
          {!currentSession ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography sx={{ color: 'text.secondary' }}>Aucune session définie.</Typography>
            </Box>
          ) : (
            <Stack spacing={3} sx={{ width: '100%' }}>
              {/* Info Bar */}
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', display: 'flex', gap: 2, alignItems: 'center', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'none' }}>
                <TextField
                  label="Nom"
                  value={editingName[currentSession.id] ?? currentSession.name}
                  onChange={(e) => handleNameChange(currentSession.id, currentSession, e.target.value)}
                  onBlur={() => handleSaveSessionChanges(currentSession.id, currentSession)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Date"
                    value={editingDate[currentSession.id] ? dayjs(editingDate[currentSession.id]) : (currentSession.date ? dayjs(currentSession.date) : null)}
                    onChange={(newValue) => {
                      const formatted = newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : '';
                      handleDateChange(currentSession.id, currentSession, formatted);
                    onUpdateSession(currentSession.id, editingName[currentSession.id] ?? currentSession.name, formatted || null, !!currentSession.active);
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        sx: { width: 180, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }
                      }
                    }}
                  />
                </LocalizationProvider>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={!!currentSession.active}
                      onChange={(e) => onUpdateSession(currentSession.id, editingName[currentSession.id] ?? currentSession.name, editingDate[currentSession.id] ?? (currentSession.date ? currentSession.date.split('T')[0] : ''), e.target.checked)}
                    />
                  }
                  label={<Typography sx={{ fontSize: 12, fontWeight: 600 }}>Session ouverte</Typography>}
                  sx={{ ml: 1, mr: 0 }}
                />
                <Tooltip title="Supprimer la session">
                  <IconButton color="error" onClick={() => onDeleteSession(currentSession.id)} size="small" sx={{ flexShrink: 0 }}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Paper>

              <Stack spacing={2} sx={{ width: '100%' }}>
                {juryGroups.length > 0 ? juryGroups.map((group, idx) => (
                    <Card key={group.juryId || idx} variant="outlined" sx={{ borderRadius: 2, width: '100%', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'none' }}>
                      <CardContent sx={{ p: 2, flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, mb: 2, color: 'primary.main', fontSize: 14 }}>
                          {group.juryName}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}>
                              Enseignant (Jury)
                            </Typography>
                            <Box 
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverZone(`teacher-${group.juryId}`); }}
                              onDragLeave={() => setDragOverZone(null)}
                              onDrop={(e) => { handleDrop(e, currentSession.id, group.juryId, 'teacher'); }}
                              sx={{ 
                                minHeight: 52, 
                                border: `1px dashed ${dragOverZone === `teacher-${group.juryId}` ? '#37398f' : 'rgba(0,0,0,0.12)'}`,
                                bgcolor: dragOverZone === `teacher-${group.juryId}` ? 'rgba(55,57,143,0.04)' : 'rgba(0,0,0,0.01)',
                                borderRadius: 1,
                                p: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                transition: 'all 0.2s'
                              }}
                            >
                              {group.teachers.length > 0 ? (
                                group.teachers.map(t => (
                                  <Box key={t.id} sx={{ p: 0.75, px: 1, bgcolor: 'background.paper', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 1.5 }}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{t.teacherEmail}</Typography>
                                    <IconButton size="small" onClick={() => onRemoveJury(t.id)} sx={{ p: 0.25 }}>
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', py: 1 }}>Déposez un enseignant</Typography>
                              )}
                            </Box>
                          </Box>

                          <Box sx={{ flex: 2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}>
                              Étudiants
                            </Typography>
                            <Box 
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverZone(`student-${group.juryId}`); }}
                              onDragLeave={() => setDragOverZone(null)}
                              onDrop={(e) => { handleDrop(e, currentSession.id, group.juryId, 'student'); }}
                              sx={{ 
                                minHeight: 52, 
                                border: `1px dashed ${dragOverZone === `student-${group.juryId}` ? '#37398f' : 'rgba(0,0,0,0.12)'}`,
                                bgcolor: dragOverZone === `student-${group.juryId}` ? 'rgba(55,57,143,0.04)' : 'rgba(0,0,0,0.01)',
                                borderRadius: 1,
                                p: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                transition: 'all 0.2s'
                              }}
                            >
                              {group.students.length > 0 ? (
                                group.students.map(s => (
                                  <Box key={s.id} sx={{ p: 0.75, px: 1, bgcolor: 'background.paper', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 1, mb: 0.5 }}>
                                    <Typography sx={{ fontSize: 11 }}>{s.studentNom} {s.studentPrenom}</Typography>
                                    <IconButton size="small" onClick={() => onRemoveStudent(s.id)} sx={{ p: 0.5 }}>
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Box>
                                ))
                              ) : (
                                <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', py: 3 }}>Déposez des étudiants</Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                )) : (
                  <Box sx={{ width: '100%', py: 5 }}>
                    <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 5 }}>Aucun jury disponible. Veuillez créer des jurys dans l'onglet Enseignants du Dashboard.</Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
          )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1, bgcolor: 'background.paper', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <Button variant="text" onClick={onClose} sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}>
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  )
}
