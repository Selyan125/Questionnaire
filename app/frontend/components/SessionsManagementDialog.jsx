import React, { useState, useMemo } from 'react'
import {
  Drawer,
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
import 'dayjs/locale/fr'
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
  onDeleteJuryMaster,
  onSelectSession,
}) {
  const [selectedSessionTab, setSelectedSessionTab] = useState(0)
  const [editingName, setEditingName] = useState({})
  const [editingDate, setEditingDate] = useState({})
  const [newJuryName, setNewJuryName] = useState('')
  const [poolTab, setPoolTab] = useState(0)
  const [studentSortBy, setStudentSortBy] = useState('year')
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
      const session = sessions.find(s => s.id === sessionId)

      if (expectedType && dragType !== expectedType) return 

      if (dragType === 'teacher') {
        if (session?.juries?.some(j => j.teacherId === data.id)) return
        const juryId = targetJuryId || data.juryId || (availableJuries?.[0]?.id)
        if (juryId) onAddJury(sessionId, juryId, data.id)
      } else if (dragType === 'student') {
        if (session?.students?.some(s => s.studentId === data.id)) return
        const effectiveJuryId = targetJuryId || (sessions.find(s => s.id === sessionId)?.juries?.[0]?.juryId) || (availableJuries?.[0]?.id)
        if (effectiveJuryId) onAddStudent(sessionId, data.id, effectiveJuryId)
      }
    } catch (err) {
      console.error('Drop failed', err)
    }
  }

  const currentSession = useMemo(() => sessions[selectedSessionTab], [sessions, selectedSessionTab])

  const poolTeachers = useMemo(() => {
    const all = availableTeachers || []
    if (!currentSession) return all
    const sessionTeacherIds = (currentSession.juries || []).map(j => j.teacherId)
    return all.filter(t => !sessionTeacherIds.includes(t.id))
  }, [availableTeachers, currentSession])

  const hasMultipleYears = useMemo(() => {
    const all = availableStudents || []
    const years = new Set(all.map(s => s.year).filter(Boolean))
    return years.size > 1
  }, [availableStudents])

  const poolStudents = useMemo(() => {
    const all = availableStudents || []
    let filtered = [...all]
    if (currentSession) {
      const sessionStudentIds = (currentSession.students || []).map(s => s.studentId)
      filtered = filtered.filter(s => !sessionStudentIds.includes(s.id))
    }
    
    const sorted = filtered.sort((a, b) => {
      if (studentSortBy === 'year') {
        const yA = parseInt(a.year) || 0
        const yB = parseInt(b.year) || 0
        if (yA !== yB) return yA - yB
      }
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.toLowerCase()
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })

    if (studentSortBy === 'name') {
      return { keys: ['Liste alphabétique'], groups: { 'Liste alphabétique': sorted } }
    }

    const groups = sorted.reduce((acc, s) => {
      const label = s.year ? `Année ${s.year}` : 'Année non spécifiée'
      if (!acc[label]) acc[label] = []
      acc[label].push(s)
      return acc
    }, {})

    return {
      keys: Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      groups
    }
  }, [availableStudents, currentSession, studentSortBy])

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

  const handleTabChange = (event, newValue) => {
    setSelectedSessionTab(newValue);
    if (sessions[newValue] && typeof onSelectSession === 'function') {
      onSelectSession(sessions[newValue].id);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 800, md: 1000 }, borderRadius: { xs: 0, sm: '28px 0 0 28px' }, boxShadow: 'none', borderLeft: '1px solid rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ color: '#1a1a1b', bgcolor: 'background.paper', borderBottom: '1px solid rgba(0,0,0,0.08)', py: 2, fontWeight: 700 }}>
        Gestion des sessions d'oral
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: '#fbfbfb', p: 0, display: 'flex', height: 'calc(100vh - 130px)' }}>
        {/* Left Pool Panel */}
        <Box sx={{ width: 300, borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', flexShrink: 0 }}>
          <Tabs value={poolTab} onChange={(_, v) => setPoolTab(v)} variant="fullWidth" sx={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <Tab  label="Enseignants" sx={{ textTransform: 'none', minHeight: 54, fontSize: 14}} />
            <Tab  label="Étudiants" sx={{ textTransform: 'none', minHeight: 54, fontSize: 14 }} />
          </Tabs>
          {poolTab === 1 && (
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>Trier :</Typography>
              <Select
                value={studentSortBy}
                onChange={(e) => setStudentSortBy(e.target.value)}
                size="small"
                variant="standard"
                disableUnderline
                sx={{ fontSize: 12, fontWeight: 500 }}
              >
                <MenuItem value="year" sx={{ fontSize: 12 }}>Par année</MenuItem>
                <MenuItem value="name" sx={{ fontSize: 12 }}>Par nom</MenuItem>
              </Select>
            </Box>
          )}
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
            <List size="small">
              {poolTab === 0 ? (
                poolTeachers.map((item) => (
                  <ListItem
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item, 'teacher')}
                    sx={{
                      mb: 1, borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)',
                      cursor: 'grab', display: 'flex', alignItems: 'center', py: 1,
                      '&:hover': { bgcolor: 'action.hover' }, '&:active': { cursor: 'grabbing' }
                    }}
                  >
                    <DragIndicatorIcon sx={{ color: 'text.disabled', mr: 1, fontSize: 20 }} />
                    {(() => {
                      const fullname = `${item.name || ''} ${item.lastName || ''}`.trim()
                      const email = (item.email && !item.email.includes('_')) ? item.email : ''
                      return (
                    <ListItemText
                      sx={{ m: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                      primary={fullname || email}
                      slotProps={{
                        primary: { noWrap: true, sx: { fontSize: 14, fontWeight: 500 } }
                      }}
                    />
                    ) })()}
                  </ListItem>
                ))
              ) : (
                poolStudents.keys.map((year) => (
                  <Box key={year} sx={{ mb: 2 }}>
                    {hasMultipleYears && (
                      <Typography sx={{ 
                        px: 1.5, py: 0.4, mb: 1, mt: 1, fontSize: 11, fontWeight: 800, 
                        color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.03)', 
                        textTransform: 'uppercase', borderRadius: 1 
                      }}>
                        {year}
                      </Typography>
                    )}
                    {poolStudents.groups[year].map((item) => (
                      <ListItem
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item, 'student')}
                        sx={{
                          mb: 0.5, borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)',
                          cursor: 'grab', display: 'flex', alignItems: 'center', py: 1,
                          '&:hover': { bgcolor: 'action.hover' }, '&:active': { cursor: 'grabbing' }
                        }}
                      >
                        <DragIndicatorIcon sx={{ color: 'text.disabled', mr: 1, fontSize: 20 }} />
                        <ListItemText
                          sx={{ m: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                          primary={`${item.prenom || ''} ${item.nom || ''}`.trim()}
                          slotProps={{
                            primary: {
                              noWrap: true,
                              sx: { fontSize: 14, fontWeight: 500 },
                            }
                          }}
                        />
                      </ListItem>
                    ))}
                  </Box>
                ))
              )}
            </List>
          </Box>
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
           <Typography
              component="div"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 400,
                letterSpacing: '0.03333em',
                color: 'text.secondary',
                lineHeight: 1.3,
              }}
            >
              Glissez-déposez une personne sur une session pour l'assigner.
            </Typography>
          </Box>
        </Box>

        {/* Right Sessions Panel */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', px: 2, bgcolor: 'background.paper', gap: 1, minHeight: 56, flexShrink: 0 }}>
            <Tabs 
              value={selectedSessionTab} 
              onChange={handleTabChange} 
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
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 100, height: 32, mr: -0.5 }}
                      >
                        Créer jury
                      </Button>
                    </InputAdornment>
                  ),
                sx: { borderRadius: '24px', pr: 0.5, bgcolor: 'background.default' }
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
              backgroundSize: '20px 20px',
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': { 
                background: 'rgba(0, 0, 0, 0.05)', 
                borderRadius: '10px',
                '&:hover': { background: 'rgba(0, 0, 0, 0.15)' }
              }
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
              <Paper sx={{ p: 2, borderRadius: '24px', bgcolor: 'background.paper', display: 'flex', gap: 2, alignItems: 'center', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <TextField
                  label="Nom"
                  value={editingName[currentSession.id] ?? currentSession.name}
                  onChange={(e) => handleNameChange(currentSession.id, currentSession, e.target.value)}
                  onBlur={() => handleSaveSessionChanges(currentSession.id, currentSession)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
                  <DatePicker
                    label="Date"
                    format="DD/MM/YYYY"
                    value={editingDate[currentSession.id] ? dayjs(editingDate[currentSession.id]) : (currentSession.date ? dayjs(currentSession.date) : null)}
                    onChange={(newValue) => {
                      const formatted = newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : '';
                      handleDateChange(currentSession.id, currentSession, formatted);
                    onUpdateSession(currentSession.id, editingName[currentSession.id] ?? currentSession.name, formatted || null, !!currentSession.active);
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        sx: { width: 180, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }
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
                    <Card key={group.juryId || idx} sx={{ borderRadius: '24px', width: '100%', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                      <CardContent sx={{ p: 2, flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Typography sx={{ fontWeight: 700, color: 'primary.main', fontSize: 14 }}>
                            {group.juryName}
                          </Typography>
                          {typeof onDeleteJuryMaster === 'function' && (
                            <Tooltip title="Supprimer ce modèle de jury">
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => { if(window.confirm(`Supprimer le jury "${group.juryName}" ?`)) onDeleteJuryMaster(group.juryId) }}
                                sx={{ mt: -0.5, mr: -0.5, opacity: 0.5, '&:hover': { opacity: 1 } }}
                              >
                                <DeleteIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                        
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
                                bgcolor: dragOverZone === `teacher-${group.juryId}` ? 'rgba(55,57,143,0.06)' : 'rgba(0,0,0,0.01)',
                                borderRadius: '16px',
                                p: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            >
                              {group.teachers.length > 0 ? (
                                group.teachers.map(t => (
                                  <Box key={t.id} sx={{ p: 0.75, px: 1, bgcolor: 'background.paper', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 3 }}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 500 }}>
                                      {(() => {
                                        const fullname = `${t.teacherName || ''} ${t.teacherLastName || ''}`.trim()
                                        const email = (t.teacherEmail && !t.teacherEmail.includes('_')) ? t.teacherEmail : ''
                                        return fullname || email
                                      })()}
                                    </Typography>
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
                                bgcolor: dragOverZone === `student-${group.juryId}` ? 'rgba(55,57,143,0.06)' : 'rgba(0,0,0,0.01)',
                                borderRadius: '16px',
                                p: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            >
                              {group.students.length > 0 ? (
                                group.students.map(s => (
                                  <Box key={s.id} sx={{ p: 0.75, px: 1, bgcolor: 'background.paper', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 3, mb: 0.5 }}>
                                    <Typography sx={{ fontSize: 11 }}>{s.studentPrenom} {s.studentNom}</Typography>
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
                    <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 5 }}>Aucun jury disponible. Créez en un via le champ en haut à droite.</Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
          )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1, bgcolor: 'background.paper', borderTop: '1px solid rgba(0,0,0,0.08)', borderRadius: '0 0 5px 5px' }}>
        <Button variant="contained" disableElevation onClick={onClose} sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600, px: 4 }}>
          Fermer
        </Button>
      </DialogActions>
    </Drawer>
  )
}
