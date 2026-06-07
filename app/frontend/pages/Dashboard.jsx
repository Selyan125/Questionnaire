import React, { useEffect, useState } from 'react';
import { Box, Paper, Stack, Typography, Grid, IconButton, Avatar, Button, Divider, Skeleton } from '@mui/material';
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
  const navigate = useNavigate()
  const [questionnaires, setQuestionnaires] = useState([])
  const [importMessage, setImportMessage] = useState(null)


  useEffect(() => {
    const raw = localStorage.getItem('authUser')
    if (raw) {
      try { setUser(JSON.parse(raw)) } catch (e) { setUser(null) }
    }
  }, [])

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
        //setIsAdmin(!!(me && me.admin))
      } else {
        //setIsAdmin(false)
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

  async function exportQuestionnaire(id) {
    if (!id) return
    try {
      const resp = await apiFetch(`/api/questionnaires/${id}/export`)
      if (!resp.ok) throw new Error(`Erreur serveur (${resp.status})`)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `questionnaire-${id}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      setImportMessage(e.message || 'Export impossible')
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
  if (isAdmin) menuItems.push({ key: 'import', label: 'Importer', icon: <UploadFileIcon /> })

  function logout() {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    navigate('/login')
  }

  const roleLabel = user ? (
    user.role === 'teacher' ? 'Enseignant' :
    user.role === 'student' ? 'Étudiant' :
    user.role === 'admin' ? 'Administrateur' :
    user.role
  ) : ''

  return (
    <Box sx={{ p: 2, height: '100vh', boxSizing: 'border-box', overflow: 'hidden' }}>
      <Typography sx={{ fontSize: 24, fontWeight: 600, mb: 2 }}>Tableau de bord</Typography>

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'stretch', height: '100%', minHeight: 0 }}>
        {/* Left menu */}
        <Paper
          elevation={0}
          sx={{
            width: 240,
            borderRadius: 1,
            p: 2,
            border: '1px solid rgba(99,102,241,0.06)',
            backgroundColor: '#fff',
             boxShadow: 'none',
            flex: '0 0 240px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            alignSelf: 'stretch',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Avatar sx={{ bgcolor: '#5b53d6' }}>{user && user.email ? user.email.charAt(0).toUpperCase() : 'U'}</Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.1, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{user ? user.email : 'Utilisateur'}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{isAdmin ? 'Administrateur' : roleLabel}</Typography>
              <Box sx={{ mt: 1 }}>
                <Button size="small" onClick={logout} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', px: 1.5 }}>Déconnexion</Button>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1}>
            {menuItems.map((item, index) => {
              const selected = selectedMenu === index;
              return (
                <Box
                  key={item.key}
                  onClick={() => setSelectedMenu(index)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: selected ? 'rgba(88,91,216,0.08)' : 'transparent',
                    color: '#2f2f3f',
                    borderRadius: 2,
                    p: 0.9,
                    cursor: 'pointer',
                    transition: 'background .12s',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    {React.cloneElement(item.icon, { sx: { color: selected ? '#4050f0' : '#6b6b8f' } })}
                    <Typography sx={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</Typography>
                  </Stack>
                  <Box sx={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowForwardIosIcon fontSize="small" sx={{ color: selected ? '#4050f0' : '#bebebe' }} />
                  </Box>
                </Box>
              );
            })}
          </Stack>

        </Paper>

        {/* Main content */}
        <Box sx={{ flex: 1, overflow: 'auto', pr: 1, minHeight: 0 }}>
          {selectedMenu === 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 28, fontWeight: 600 }}>Statistiques & Informations</Typography>
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
                    <Button variant="text" component="label" startIcon={<UploadFileIcon />} sx={{ textTransform: 'none' }}>
                      Importer questionnaire
                      <input type="file" accept="application/json,.json" hidden onChange={handleQuestionnaireImport} />
                    </Button>


                  </Box>
                )}
              </Box>


              <Grid container spacing={3} sx={{ mb: 3 }}>
                {[{
                  title: 'Étudiants',
                  value: stats ? stats.students : '—',
                  icon: <SchoolIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'Enseignants',
                  value: stats ? stats.teachers : '—',
                  icon: <PersonIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'Questionnaires (sur étudiants)',
                  value: stats ? `${stats.questionnaires} / ${stats.students}` : '—',
                  icon: <BarChartIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'En cours',
                  value: stats ? (stats.inProgress ?? stats.openQuestionnaires) : '—',
                  icon: <ShowChartIcon sx={{ color: '#4050f0' }} />
                },{
                  title: 'Ouverts',
                  value: stats ? stats.openQuestionnaires : '—',
                  icon: <ShowChartIcon sx={{ color: '#4050f0' }} />
                }].map((card, i) => (
                  <Grid item xs={12} sm={6} md={3} key={i}>
                    <Paper sx={{ p: 2, borderRadius: 1, boxShadow: 'none', border: '1px solid rgba(64,80,240,0.06)', background: '#fff' }}>"
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{card.title}</Typography>
                          {loadingStats ? (
                            <Skeleton variant="text" width={120} height={36} sx={{ mt: 0.5 }} />
                          ) : (
                            <Typography sx={{ fontSize: 28, fontWeight: 800, mt: 0.5 }}>{card.value}</Typography>
                          )}
                        </Box>
                        <Box sx={{ fontSize: 36, color: 'rgba(64,80,240,0.85)' }}>
                          {loadingStats ? <Skeleton variant="circular" width={48} height={48} /> : card.icon}
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {errorStats && <Typography color="error">{errorStats}</Typography>}
              {importMessage && <Typography sx={{ color: 'text.secondary', mb: 1 }}>{importMessage}</Typography>}

              
              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 600, mb: 1 }}>Questionnaires</Typography>
                <Grid container spacing={2}>
                  {questionnaires && questionnaires.length ? (
                    questionnaires.map(q => (
                      <Grid item key={q.id} xs={12} sm={6} md={4}>
                        <Paper sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} elevation={0}>
                          <Box sx={{ mr: 2, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.title}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>ID: {q.id}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Button size="small" onClick={() => navigate(`/admin/question-manager/${q.id}`)}>Ouvrir</Button>
                            
                            {isAdmin && (
                              <>
                              
                                <Button size="small" variant="text" onClick={() => navigate(`/admin/questionnaire/${q.id}/results`)} sx={{ textTransform: 'none' }}>Voir résultats</Button>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    exportQuestionnaire(q.id)
                                  }}
                                  title="Exporter le questionnaire"
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteQuestionnaire(q.id)
                                  }}
                                >
                                  <DeleteIcon sx={{ color: 'error.main' }} fontSize="small" />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </Paper>
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
              <Typography sx={{ fontSize: 34, fontWeight: 600, mb: 2 }}>Import CSV</Typography>
              <AdminImport />
            </>
          )}

        </Box>
      </Box>
    </Box>
  );
}
