import React, { useEffect, useState } from 'react';
import { Tooltip, Box, Paper, Stack, Typography, Grid, IconButton, Avatar, Button, Divider, Skeleton, List, ListItemButton, ListItemIcon, ListItemText, Card, CardContent } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AdminImport from './AdminImport.jsx';
import StudentsView from '../components/StudentsView.jsx'
import TeachersView from '../components/TeachersView.jsx'
import TopAppBar from '../components/TopAppBar.jsx'
import { useNavigate } from 'react-router-dom'
import { getStats } from '../api/stats.js'
import { listTeachers } from '../api/teachers.js'
import { listQuestionnaires, createQuestionnaire, deleteQuestionnaire as deleteQuestionnaireApi, importQuestionnaire } from '../api/questionnaires.js'
import { apiFetch } from '../api/http.js'

export default function Dashboard() {
  const authUser = JSON.parse(localStorage.getItem('authUser') || '{}')
  const isAdmin = authUser?.admin === true
  
  if (!isAdmin) {
    return (
      <Box sx={{ p: 3, minHeight: '100vh' }}>
        <Typography color="error">Accès refusé. Seuls les administrateurs peuvent accéder au tableau de bord.</Typography>
        <Button variant="outlined" onClick={() => window.location.href = '/teacher-sessions'} sx={{ mt: 2 }}>Accéder à mes sessions</Button>
      </Box>
    )
  }
  const [selectedMenu, setSelectedMenu] = useState(0);
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [errorStats, setErrorStats] = useState(null)
  const [user, setUser] = useState(null)
  const [isApiOnline, setIsApiOnline] = useState(true)
  const navigate = useNavigate()
  const [questionnaires, setQuestionnaires] = useState([])
  const [importMessage, setImportMessage] = useState(null)
  const [exporting, setExporting] = useState(false)


  useEffect(() => {
    const raw = localStorage.getItem('authUser')
    if (raw) {
      try { setUser(JSON.parse(raw)) } catch (e) { setUser(null) }
    }
  }, [])
  
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await apiFetch('/api/status'); 
        setIsApiOnline(response.ok); 
      } catch (error) {
        setIsApiOnline(false); 
      }
    };
    checkApiStatus();
  }, []); 
  
  async function loadDashboard() {
    setLoadingStats(true)
    setErrorStats(null)
    try {
      const [sJson, tJson] = await Promise.all([
        getStats(),
        listTeachers(),
      ])
      setStats(sJson)
      // determine admin
      if (user && tJson && Array.isArray(tJson)) {
        const me = tJson.find(t => t.id === user.id)
      } 

      // load questionnaires list
      try {
        const qJson = await listQuestionnaires()
        setQuestionnaires(qJson)
      } catch {
        setQuestionnaires([])
      }

    } catch (err) {
      navigate('/server-status', { state: { error: err && err.message ? err.message : 'Erreur du chargement du tableau de bord' } })
    } finally {
      setLoadingStats(false)
    }
  }

  async function deleteQuestionnaire(id) {
    if (!id) return
    if (!confirm('Supprimer ce questionnaire ? Cette action est définitive.')) return
    try {
      await deleteQuestionnaireApi(id)
      await loadDashboard()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleGlobalExport() {
    setExporting(true)
    try {
      const resp = await apiFetch('/api/questionnaires/export-all')
      if (!resp.ok) throw new Error(`Erreur serveur (${resp.status})`)
      const data = await resp.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `export-complet-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export error:', e)
      setImportMessage(e.message || 'Export impossible')
    } finally {
      setExporting(false)
    }
  }

  async function handleQuestionnaireImport(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const imported = await importQuestionnaire(payload)
      const missingTeachers = imported.missingTeachers || []
      const missingStudents = imported.missingStudents || []
      const createdTeachers = imported.createdTeachers || []
      const createdStudents = imported.createdStudents || []

      const messages = []
      if (createdTeachers.length) {
        messages.push(`enseignants créés: ${createdTeachers.map(t => `${t.email} (${t.password})`).join(', ')}`)
      }
      if (createdStudents.length) {
        messages.push(`étudiants créés: ${createdStudents.map(s => `${s.email} (${s.password})`).join(', ')}`)
      }
      if (missingTeachers.length || missingStudents.length) {
        messages.push(...missingTeachers.map(email => `enseignant manquant: ${email}`))
        messages.push(...missingStudents.map(email => `étudiant manquant: ${email}`))
      }

      setImportMessage(messages.length ? `Questionnaire importé. ${messages.join(' | ')}` : 'Questionnaire importé.')
      await loadDashboard()
      const id = imported.id || imported.questionnaireId
      if (id) navigate(`/admin/question-manager/${id}`)
    } catch (e) {
      console.error(e)
      setImportMessage('Import impossible: fichier JSON invalide ou incompatible')
    }
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const menuItems = [
    { key: 'info', label: 'Informations', icon: <BarChartIcon /> },
    { key: 'teachers', label: 'Enseignants', icon: <PersonIcon /> },
    { key: 'students', label: 'Étudiants', icon: <SchoolIcon /> },
  ]
  if (isAdmin) {
    menuItems.push({ key: 'export', label: 'Exporter', icon: <DownloadIcon /> })
    menuItems.push({ key: 'import', label: 'Importer', icon: <UploadFileIcon /> })
  }

  function logout() {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    navigate('/login')
  }

  return (
    <Box sx={{ height: '100vh', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <TopAppBar
        title="Tableau de bord"
        hideDashboardLink
      />

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', flex: 1, minHeight: 0, pt: '72px', px: 2, pb: 2 }}>
        <Paper
          elevation={0}
          sx={{
            width: 260,
            flex: '0 0 240px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 0,
          }}
        >
          {/* Profile Section */}
          <Box sx={{ p: 3, mb: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: 14 }}>
                  {user?.email || 'Utilisateur'}
                </Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.3 }}>
                  <Box 
                    sx={{ 
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      bgcolor: isApiOnline ? 'success.main' : 'error.main', 
                      boxShadow: isApiOnline ? '0 0 4px rgba(76, 175, 80, 0.4)' : '0 0 4px rgba(244, 67, 54, 0.4)' 
                    }} 
                  />
                  <Typography sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '11px', lineHeight: 1 }}>
                    {isApiOnline ? 'API disponible' : 'API indisponible'}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Box>

          <Divider sx={{ mx: 2, opacity: 0.6 }} />

          {/* Navigation Menu */}
          <List sx={{ flex: 1, px: 2, mt: 2 }}>
            {menuItems.map((item, index) => (
              <ListItemButton
                key={item.key}
                selected={selectedMenu === index}
                onClick={() => setSelectedMenu(index)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  py: 1,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(55, 57, 143, 0.08)',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'rgba(55, 57, 143, 0.12)' },
                    '& .MuiListItemIcon-root': { color: 'primary.main' }
                  },
                  '& .MuiListItemIcon-root': { minWidth: 40, color: 'text.secondary' }
                }}
              >
                <ListItemIcon>{React.cloneElement(item.icon, { fontSize: 'small' })}</ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ fontSize: 14, fontWeight: selectedMenu === index ? 700 : 500, noWrap: true }} 
                />
                {selectedMenu === index && <ArrowForwardIosIcon sx={{ fontSize: 10, opacity: 0.5 }} />}
              </ListItemButton>
            ))}
          </List>

          {/* Bottom Actions */}
          <Box sx={{ p: 2, mt: 'auto', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <Button
              fullWidth
              variant="text"
              startIcon={<LogoutIcon />}
              onClick={logout}
              sx={{ 
                color: 'text.secondary', 
                textTransform: 'none', 
                justifyContent: 'flex-start', 
                px: 2, 
                borderRadius: 2,
                '&:hover': { color: 'error.main', bgcolor: 'rgba(211, 47, 47, 0.04)' }
              }}
            >
              Déconnexion
            </Button>
          </Box>
        </Paper>

        {/* Main content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 3 }, minHeight: 0, bgcolor: '#fcfcfd' }}>
          {importMessage && (
            <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(55, 57, 143, 0.05)', border: '1px solid rgba(55, 57, 143, 0.1)' }} elevation={0}><Typography variant="body2">{importMessage}</Typography></Paper>
          )}

          {selectedMenu === 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Vue d'ensemble</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Statistiques globales et gestion des questionnaires</Typography>
                </Box>
                {isAdmin && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button variant="text" startIcon={<AddIcon />} onClick={async () => {
                      try {
                        const data = await createQuestionnaire({ title: 'Nouveau questionnaire' })
                        const id = data && (data.id || data._id || data.questionnaireId)
                        if (id) navigate(`/admin/question-manager/${id}`)
                        else navigate('/admin/question-manager')
                      } catch (e) {
                        navigate('/admin/question-manager')
                      }
                    }} sx={{ textTransform: 'none' }}>Nouveau questionnaire</Button>
                  


                  </Box>
                )}
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[{
                  title: 'Étudiants',
                  value: stats ? stats.students : '—',
                  icon: <SchoolIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'Enseignants',
                  value: stats ? stats.teachers : '—',
                  icon: <PersonIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'Questionnaires',
                  value: stats ? stats.questionnaires : '—',
                  icon: <BarChartIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'En cours',
                  value: stats ? (stats.inProgress ?? stats.openQuestionnaires) : '—',
                  icon: <ShowChartIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'Ouverts',
                  value: stats ? stats.openQuestionnaires : '—',
                  icon: <PieChartIcon sx={{ color: '#4050f0' }} />
                }].map((card, i) => (
                  <Grid item xs={12} sm={6} md={3} key={i}>
                    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(55, 57, 143, 0.05)', color: 'primary.main', display: 'flex' }}>
                            {React.cloneElement(card.icon, { fontSize: 'small' })}
                          </Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                            {card.title}
                          </Typography>
                          <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.2 }}>{loadingStats ? <Skeleton width="40%" /> : card.value}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {errorStats && <Typography color="error">{errorStats}</Typography>}

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Questionnaires disponibles</Typography>
                <Grid container spacing={1.5}>
                  {questionnaires && questionnaires.length ? (
                    questionnaires.map(q => (
                      <Grid item key={q.id} xs={12} sm={6} md={4} lg={3}>
                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.025)', display: 'flex', flexDirection: 'column', gap: 1.5, transition: 'background 0.2s', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}>
                          <Box sx={{ mr: 2, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontWeight: 700, fontSize: 14, mb: 0 }}>{q.title}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', opacity: 0.8 }}>ID: {q.id}</Typography>
                          </Box>
                          <Divider sx={{ opacity: 0.5 }} />
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Button 
                              size="small" 
                              variant="contained" 
                              disableElevation 
                              onClick={() => navigate(`/admin/question-manager/${q.id}`)}
                              sx={{ textTransform: 'none', borderRadius: 1.5, bgcolor: 'primary.main', px: 2 }}
                            >
                              Ouvrir
                            </Button>
                            
                            {isAdmin && (
                              <Stack direction="row" spacing={0.5}>
                                <Tooltip title="Résultats">
                                  <IconButton size="small" onClick={() => navigate(`/admin/questionnaire/${q.id}/results`)}>
                                    <BarChartIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Supprimer">
                                  <IconButton size="small" onClick={() => deleteQuestionnaire(q.id)} color="error">
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </Box>
                        </Box>
                      </Grid>
                    ))
                  ) : (
          <Box sx={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: '#666' }}>Aucun questionnaire trouvé</Typography>
          </Box>
                  )}
                </Grid>
              </Box>
            </>
          )}

          {selectedMenu === 1 && (
            <>
              <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 2 }}>Enseignants</Typography>
              <TeachersView />
            </>
          )}

          {selectedMenu === 2 && (
            <>
              <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 2 }}>Étudiants</Typography>
              <StudentsView />
            </>
          )}

          {selectedMenu === 3 && isAdmin && (
            <>
              <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 2 }}>Exporter les données</Typography>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)', bgcolor: 'background.paper' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  Générez une sauvegarde complète du site au format JSON. Le fichier contiendra : questionnaires, étudiants, enseignants et résultats.
                </Typography>
                <Button 
                  variant="contained" 
                  disableElevation
                  startIcon={<DownloadIcon />} 
                  onClick={handleGlobalExport}
                  disabled={exporting}
                  sx={{ borderRadius: 2, px: 3, bgcolor: '#37398f', textTransform: 'none' }}
                >
                  {exporting ? 'Génération du fichier...' : 'Exporter (télécharger)'}
                </Button>
              </Paper>
            </>
          )}

          {selectedMenu === 4 && isAdmin && (
            <>
              <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 2 }}>Importation</Typography>
              <AdminImport />
            </>
          )}

        </Box>
      </Box>
    </Box>
  );
}
