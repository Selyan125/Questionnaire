import React, { useEffect, useState } from 'react'
import { Box, Typography, Button, Paper, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Stack, Divider } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import TopAppBar from '../components/TopAppBar.jsx'
import { listQuestionnaires } from '../api/questionnaires.js'

export default function TeacherSessions() {
  const navigate = useNavigate()
  const authUser = JSON.parse(localStorage.getItem('authUser') || '{}')
  const isAdmin = authUser?.admin === true
  const [questionnaires, setQuestionnaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const qs = await listQuestionnaires()
        setQuestionnaires(Array.isArray(qs) ? qs : [])
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement des questionnaires')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function parseSessionsFromQuestionnaire(q) {
    const raw = q?.sessions;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function openQuestionnaireDetail(questionnaire) {
    setSelectedQuestionnaire(questionnaire)
    setSessions(parseSessionsFromQuestionnaire(questionnaire))
  }

  function closeDetail() {
    setSelectedQuestionnaire(null)
    setSessions([])
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR')
    } catch {
      return dateStr
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      <TopAppBar 
        title="Mes évaluations" 
        pages={[]} // Correction du crash : TopAppBar attend un tableau
        hideDashboardLink={!isAdmin}
      />
      
      <Box sx={{ flex: 1, p: 3, pt: '76px', overflow: 'auto' }}>
        {error && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        ) : questionnaires.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Aucun questionnaire disponible</Typography>
          </Paper>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 450px))',
            gap: 4,
            justifyContent: 'center',
            alignContent: 'start',
            maxWidth: 1600,
            mx: 'auto',
            width: '100%'
          }}>
            {questionnaires.map(q => {
              const sessions = parseSessionsFromQuestionnaire(q)
              return (
                <Card key={q.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 1 }}>{q.title || 'Sans titre'}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
                      ID: {q.id} • Créé: {formatDate(q.date)}
                    </Typography>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    {sessions.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {sessions.slice(0, 3).map((s, i) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                             <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                              • {s.name || `Session ${i + 1}`}
                            </Typography>
                            {s.active && (
                              <Chip label="Ouverte" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                            )}
                          </Box>
                        ))}
                        {sessions.length > 3 && (
                          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>
                            ... et {sessions.length - 3} autre(s)
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Aucune session</Typography>
                    )}
                  </CardContent>
                  <Box sx={{ p: 2, display: 'flex', gap: 1, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => openQuestionnaireDetail(q)}
                      sx={{ textTransform: 'none', borderRadius: 2, bgcolor: '#37398f' }}
                    >
                      Voir les sessions
                    </Button>
                    {isAdmin && (
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/admin/question-manager/${q.id}`)}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        Gérer
                      </Button>
                    )}
                  </Box>
                </Card>
              )
            })}
          </Box>
        )}
      </Box>

      <Dialog open={!!selectedQuestionnaire} onClose={closeDetail} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selectedQuestionnaire && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>{selectedQuestionnaire.title || 'Questionnaire'}</DialogTitle>
            <DialogContent dividers>
              {sessions.length > 0 ? (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nom</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Étudiants</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sessions.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.name || `Session ${i + 1}`}</TableCell>
                        <TableCell>{formatDate(s.date)}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {(s.students || []).length > 0 ? (
                              s.students.map((st, idx) => (
                                <Chip 
                                  key={idx} 
                                  label={`${st.studentNom || ''} ${st.studentPrenom || ''}`} 
                                  size="small" 
                                  variant="outlined" 
                                  sx={{ fontSize: 11 }} 
                                />
                              ))
                            ) : (
                              <Typography variant="caption" color="text.disabled">Aucun étudiant</Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Button 
                            variant="contained" 
                            size="small"
                            disabled={!s.active && !isAdmin}
                            onClick={() => navigate(`/questionnaire/${selectedQuestionnaire.id}`)}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                          >
                            Démarrer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography color="text.secondary">Aucune session définie</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDetail}>Fermer</Button>
              {isAdmin && (
                <Button
                  variant="contained"
                  onClick={() => {
                    closeDetail()
                    navigate(`/admin/question-manager/${selectedQuestionnaire.id}`)
                  }}
                >
                  Gérer les sessions
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
