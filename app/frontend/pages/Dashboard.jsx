import React, { useEffect, useState } from 'react';
import { Menu, MenuItem, Tooltip, Box, Paper, Stack, Typography, Grid, IconButton, Avatar, Button, Divider, Skeleton, List, ListItemButton, ListItemIcon, ListItemText, Card, CardContent, Checkbox, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CodeIcon from '@mui/icons-material/Code';
import ListAltIcon from '@mui/icons-material/ListAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AdminImport from './AdminImport.jsx';
import TeachersView from '../components/TeachersView.jsx';
import StudentsView from '../components/StudentsView.jsx';
import TopAppBar from '../components/TopAppBar.jsx'
import { useNavigate } from 'react-router-dom'
import { getStats } from '../api/stats.js'
import { listStudents } from '../api/students.js'
import { listTeachers } from '../api/teachers.js'
import { listQuestionnaires, createQuestionnaire, deleteQuestionnaire as deleteQuestionnaireApi, importQuestionnaire, getQuestionnaire } from '../api/questionnaires.js'
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
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [selectedTeachers, setSelectedTeachers] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])
  const [errorStats, setErrorStats] = useState(null)
  const [user, setUser] = useState(null)
  const [isApiOnline, setIsApiOnline] = useState(true)
  const navigate = useNavigate()
  const [questionnaires, setQuestionnaires] = useState([])
  const [importMessage, setImportMessage] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  // States pour l'ajout manuel d'un étudiant depuis le dashboard
  const [showStudentAdd, setShowStudentAdd] = useState(false)
  const [newStudent, setNewStudent] = useState({ nom: '', prenom: '', year: '', group: '', email: '' })
  const [isAddingStudent, setIsAddingStudent] = useState(false)

  // Menu states for cards
  const [exportAnchor, setExportAnchor] = useState(null);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [activeQId, setActiveQId] = useState(null);

  const handleExportOpen = (event, id) => {
    setExportAnchor(event.currentTarget);
    setActiveQId(id);
  };
  const handleMoreOpen = (event, id) => {
    setMoreAnchor(event.currentTarget);
    setActiveQId(id);
  };
  const handleMenuClose = () => {
    setExportAnchor(null);
    setMoreAnchor(null);
    setActiveQId(null);
  };

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
      const [sJson, tJson, stJson] = await Promise.all([
        getStats(),
        listTeachers(),
        listStudents()
      ])
      setStats(sJson)
      setTeachers(tJson || [])
      setStudents(stJson || [])
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

  async function handleQuickAddStudent() {
    if (!newStudent.nom || !newStudent.prenom) {
      alert('Nom et prénom requis.');
      return;
    }
    setIsAddingStudent(true);
    try {
      await apiFetch('/api/students', { method: 'POST', json: newStudent });
      setNewStudent({ nom: '', prenom: '', year: '', group: '', email: '' });
      setShowStudentAdd(false);
      loadDashboard(); // Recharger la liste
    } catch (err) { alert(err.message || 'Erreur lors de l\'ajout'); }
    finally { setIsAddingStudent(false); }
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

  async function handleDuplicateQuestionnaire(id) {
    try {
      const qData = await getQuestionnaire(id);
      const { id: _, createdAt, updatedAt, ...cleanData } = qData;
      const copy = { ...cleanData, title: `${qData.title} (Copie)` };
      
      await importQuestionnaire(copy)
      await loadDashboard()
    } catch (e) {
      console.error('Duplication error:', e)
      alert(`Erreur lors de la duplication : ${e.message || 'Vérifiez que la route /api/questionnaires/import existe sur le serveur.'}`)
    }
  }

  async function handleDeleteTeachers(ids) {
    const toDelete = Array.isArray(ids) ? ids : [ids]
    if (!confirm(`Supprimer ${toDelete.length} enseignant(s) ?`)) return
    try {
      await apiFetch('/api/teachers', { method: 'DELETE', json: { ids: toDelete } })
      setTeachers(prev => prev.filter(t => !toDelete.includes(t.id)))
      setSelectedTeachers([])
    } catch (e) {
      alert("Erreur lors de la suppression : " + e.message)
    }
  }

  async function handleDeleteStudents(ids) {
    const toDelete = Array.isArray(ids) ? ids : [ids]
    if (!confirm(`Supprimer ${toDelete.length} étudiant(s) ?`)) return
    try {
      await apiFetch('/api/students', { method: 'DELETE', json: { ids: toDelete } })
      setStudents(prev => prev.filter(s => !toDelete.includes(s.id)))
      setSelectedStudents([])
    } catch (e) {
      alert("Erreur lors de la suppression : " + e.message)
    }
  }

  async function handleExportJson(id) {
    try {
      const resp = await apiFetch(`/api/questionnaires/${id}/export-json`)
      if (!resp.ok) throw new Error("Erreur export")
      const data = await resp.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `questionnaire-${id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      console.error(e)
      alert("Erreur lors de l'export JSON")
    }
  }

  async function handleExportCsv(id) {
    try {
      const resp = await apiFetch(`/api/questionnaires/${id}/export-questions-csv`)
      if (!resp.ok) throw new Error("Erreur export")
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `questions-questionnaire-${id}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      console.error(e)
      alert("Erreur lors de l'export CSV")
    }
  }

  async function handleAllResultsExport() {
    try {
      const resp = await apiFetch('/api/questionnaires/results/all-csv')
      if (!resp.ok) throw new Error("Erreur export")
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tous-les-resultats-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) { alert("Erreur lors de l'export des résultats") }
  }

  async function handleStudentExportCsv() {
    try {
      const resp = await apiFetch('/api/questionnaires/students/export-csv')
      if (!resp.ok) throw new Error("Erreur export")
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export_etudiants_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) { alert("Erreur lors de l'export des étudiants") }
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
            borderRight: '0.7px solid rgba(0,0,0,0.08)',
            borderRadius: 6
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
                    {isApiOnline ? 'Opérationnelle' : 'API indisponible'}
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
                  borderRadius: 8,
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
              onClick={() => setLogoutDialogOpen(true)}
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
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: { xs: 2, md: 3 }, 
          minHeight: 0, 
          bgcolor: '#fcfcfd',
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { 
            background: 'rgba(0, 0, 0, 0.05)', 
            borderRadius: '10px',
            '&:hover': { background: 'rgba(0, 0, 0, 0.15)' }
          }
        }}>
          {importMessage && (
            <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(55, 57, 143, 0.05)', border: '1px solid rgba(55, 57, 143, 0.1)' }} elevation={0}><Typography variant="body2">{importMessage}</Typography></Paper>
          )}

          {selectedMenu === 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a1a1b', letterSpacing: '-0.02em', mb: 0.5 }}>Vue d'ensemble</Typography>
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
                    <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(0,0,0,0.08)', bgcolor: '#fff', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(0,0,0,0.12)' } }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(55, 57, 143, 0.05)', color: 'primary.main', display: 'flex' }}>
                            {React.cloneElement(card.icon, { fontSize: 'small' })}
                          </Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', color: '#1a1a1b', opacity: 0.6 }}>
                            {card.title}
                          </Typography>
                          <Typography sx={{ fontSize: 24, fontWeight: 800, mt: 0.2, color: '#1a1a1b' }}>{loadingStats ? <Skeleton width="40%" /> : card.value}</Typography>
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
                        <Box sx={{ 
                          p: 2.5, 
                          borderRadius: '24px', 
                          bgcolor: '#fff', 
                          border: '1px solid rgba(0,0,0,0.06)', 
                          position: 'relative',
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 1.5, 
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.04)' } 
                        }}>
                          {isAdmin && (
                            <IconButton 
                              size="small" 
                              onClick={(e) => handleMoreOpen(e, q.id)}
                              sx={{ position: 'absolute', top: 12, right: 10, color: 'text.secondary', p: 1 }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          )}

                          <Box sx={{ mr: 8, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontWeight: 700, fontSize: 14, mb: 0 }}>{q.title}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', opacity: 0.8 }}>ID: {q.id}</Typography>
                          </Box>
                          <Divider sx={{ opacity: 0.4 }} />
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Button 
                              size="small" 
                              variant="contained" 
                              disableElevation
                              onClick={() => navigate(`/admin/question-manager/${q.id}`)}
                              sx={{ textTransform: 'none', borderRadius: 100, bgcolor: 'primary.main', px: 2.5, fontWeight: 600 }}
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
                                <Tooltip title="Exporter">
                                  <IconButton size="small" onClick={(e) => handleExportOpen(e, q.id)}>
                                    <FileDownloadIcon fontSize="small" />
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

          {selectedMenu === 1 && <TeachersView />}

          {selectedMenu === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a1a1b' }}>Gestion des étudiants</Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowStudentAdd(true)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Ajouter un étudiant</Button>
                  <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleStudentExportCsv} sx={{ borderRadius: 100, textTransform: 'none' }}>Exporter la liste (CSV)</Button>
                </Stack>
              </Box>
              <StudentsView />
            </Box>
          )}

          {selectedMenu === 3 && isAdmin && (
            <>
              <Typography sx={{ fontSize: 28, fontWeight: 800, mb: 2, color: '#1a1a1b', letterSpacing: '-0.02em' }}>Exporter les données</Typography>
              <Stack spacing={3}>
                <Paper elevation={0} sx={{ p: 3, borderRadius: 6, border: '1px solid rgba(0,0,0,0.06)', bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Sauvegarde complète (JSON)</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                    Générez une sauvegarde complète du site au format JSON (questionnaires, étudiants, enseignants et résultats).
                  </Typography>
                  <Button 
                    variant="contained" 
                    disableElevation
                    startIcon={<DownloadIcon />} 
                    onClick={handleGlobalExport}
                    disabled={exporting}
                    sx={{ borderRadius: 100, px: 4, bgcolor: '#37398f', textTransform: 'none' }}
                  >
                    {exporting ? 'Génération...' : 'Télécharger la sauvegarde'}
                  </Button>
                </Paper>

                <Paper elevation={0} sx={{ p: 3, borderRadius: 6, border: '1px solid rgba(0,0,0,0.06)', bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Notes et résultats (CSV)</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                    Téléchargez un fichier CSV contenant toutes les notes finales de tous les étudiants pour l'ensemble des questionnaires.
                  </Typography>
                  <Button 
                    variant="outlined" 
                    startIcon={<ListAltIcon />} 
                    onClick={handleAllResultsExport}
                    sx={{ borderRadius: 100, px: 4, textTransform: 'none' }}
                  >
                    Exporter tous les résultats
                  </Button>
                </Paper>

        
              </Stack>
            </>
          )}

          {selectedMenu === 4 && isAdmin && (
            <>
              <Typography sx={{ fontSize: 28, fontWeight: 800, mb: 2, color: '#1a1a1b', letterSpacing: '-0.02em' }}>Importation</Typography>
              <AdminImport />
            </>
          )}
        </Box>
      </Box>

      {/* Card Menus */}
      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={handleMenuClose}
        MenuListProps={{ sx: { py: 0.5 } }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: { 
              borderRadius: '24px', 
              mt: 1, 
              minWidth: 220,
              p: 0.4,
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              bgcolor: 'background.paper'
            }
          }
        }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary', fontWeight: 600 }}>Exporter le questionnaire</Typography>
        <MenuItem 
          onClick={() => { handleExportJson(activeQId); handleMenuClose(); }} 
          sx={{ borderRadius: '100px', py: 1, px: 2, mb: 0.5, mx: 0.5, '&:hover': { bgcolor: 'rgba(55, 57, 143, 0.08)' } }}
        >
          <ListItemIcon sx={{ color: 'text.primary', minWidth: '36px !important' }}><CodeIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Questionnaire entier (JSON)" primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
        </MenuItem>
        <MenuItem 
          onClick={() => { handleExportCsv(activeQId); handleMenuClose(); }} 
          sx={{ borderRadius: '100px', py: 1, px: 2, mx: 0.5, '&:hover': { bgcolor: 'rgba(55, 57, 143, 0.08)' } }}
        >
          <ListItemIcon sx={{ color: 'text.primary', minWidth: '36px !important' }}><ListAltIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Questions et catégories (CSV)" primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={moreAnchor}
        open={Boolean(moreAnchor)}
        onClose={handleMenuClose}
        MenuListProps={{ sx: { py: 0.5 } }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              borderRadius: '24px', 
              mt: 1, 
              minWidth: 190,
              p: 0.4,
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              bgcolor: 'background.paper'
            }
          }
        }}
      >
        <MenuItem 
          onClick={() => { handleDuplicateQuestionnaire(activeQId); handleMenuClose(); }} 
          sx={{ borderRadius: '100px', py: 1, px: 2, mb: 0.5, mx: 0.5, '&:hover': { bgcolor: 'rgba(55, 57, 143, 0.08)' } }}
        >
          <ListItemIcon sx={{ color: 'text.primary', minWidth: '36px !important' }}><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Dupliquer" primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
        </MenuItem>
        <Divider sx={{ my: 1, mx: 3, opacity: 0.6 }} />
        <MenuItem 
          onClick={() => { deleteQuestionnaire(activeQId); handleMenuClose(); }} 
          sx={{ borderRadius: '100px', py: 1, px: 2, mx: 0.5, color: 'error.main', '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.08)' } }}
        >
          <ListItemIcon sx={{ color: 'error.main', minWidth: '36px !important' }}><DeleteIcon fontSize="small" color="inherit" /></ListItemIcon>
          <ListItemText primary="Supprimer" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
        </MenuItem>
      </Menu>

      <Dialog open={showStudentAdd} onClose={() => setShowStudentAdd(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Ajouter un étudiant</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nom" value={newStudent.nom} onChange={e => setNewStudent({...newStudent, nom: e.target.value})} fullWidth />
            <TextField label="Prénom" value={newStudent.prenom} onChange={e => setNewStudent({...newStudent, prenom: e.target.value})} fullWidth />
            <TextField label="Année" value={newStudent.year} onChange={e => setNewStudent({...newStudent, year: e.target.value})} fullWidth />
            <TextField label="Groupe" value={newStudent.group} onChange={e => setNewStudent({...newStudent, group: e.target.value})} fullWidth />
            <TextField label="Email (optionnel)" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setShowStudentAdd(false)} sx={{ borderRadius: 100, textTransform: 'none' }}>Annuler</Button>
          <Button variant="contained" onClick={handleQuickAddStudent} disabled={isAddingStudent} disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>
            {isAddingStudent ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)} PaperProps={{ sx: { borderRadius: 7, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: '#1a1a1b' }}>Déconnexion</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Êtes-vous sûr de vouloir vous déconnecter ?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Note : Ce logiciel est en BETA, assurez-vous d'avoir sauvegardé vos modifications importantes.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setLogoutDialogOpen(false)} sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Rester</Button>
          <Button variant="contained" color="error" onClick={logout} disableElevation sx={{ borderRadius: 100, textTransform: 'none', px: 3 }}>Se déconnecter</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
