import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Stack,
  Box,
  Typography,
  IconButton,
  Button,
  Tooltip,
  Paper,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  FormControlLabel,
  Switch,
  Radio,
  Checkbox,
  Chip,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SettingsIcon from '@mui/icons-material/Settings'
import CloseIcon from '@mui/icons-material/Close'
import SchoolIcon from '@mui/icons-material/School'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { useNavigate, useParams } from 'react-router-dom'
import TopAppBar from '../components/TopAppBar.jsx'
import QuestionComponent from '../components/QuestionComponent.jsx'
import { getQuestionnaire, updateQuestionnaire, updateQuestionnaireJury, deleteQuestionnaire as deleteQuestionnaireApi, addCategory as addCategoryApi } from '../api/questionnaires.js'
import { getStudentResults } from '../api/students.js'
import { addQuestionToCategory as addQuestionToCategoryApi, deleteCategory as deleteCategoryApi, updateCategory as updateCategoryApi } from '../api/categories.js'
import { listStudents } from '../api/students.js'
import { listTeachers } from '../api/teachers.js'

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="left" ref={ref} {...props} />
})

export default function QuestionManagerEditor({ questionnaireId, readOnly = false, rightActions = undefined, showStudentsSidebar: propShowStudentsSidebar = false, viewerMode = 'teacher' } = {}) {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const effectiveQuestionnaireId = questionnaireId ?? idParam
  const canEdit = !readOnly

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState(null)
  const [availableTeachers, setAvailableTeachers] = useState([])
  const [availableStudents, setAvailableStudents] = useState([])
  const [juryDialogOpen, setJuryDialogOpen] = useState(false)
  const [juryGroups, setJuryGroups] = useState([])
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false)
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [dragOverTarget, setDragOverTarget] = useState(null)

  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const pages = questionnaire && questionnaire.categories ? questionnaire.categories.map(c => ({ name: c.title, id: c.id })) : [{ name: 'Questions', id: null }]
  const [selectedPageIndex, setSelectedPageIndex] = useState(0)

  function safeParseJSON(value) {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  function buildSessionsFromQuestionnaire() {
    const raw = questionnaire?.sessions
    const parsed = typeof raw === 'string' ? safeParseJSON(raw) : Array.isArray(raw) ? raw : []
    if (!Array.isArray(parsed)) return []
    return parsed.map((session, index) => ({
      id: session && session.id ? session.id : `session-${index + 1}`,
      name: session && session.name ? session.name : `Session ${index + 1}`,
      studentIds: Array.isArray(session && session.studentIds) ? session.studentIds : [],
    }))
  }

  // students sidebar state: controlled by parent via propShowStudentsSidebar
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const showStudentsSidebar = viewerMode === 'teacher' && !!propShowStudentsSidebar
  const sessionsList = buildSessionsFromQuestionnaire()
  const selectedSession = sessionsList.find(s => String(s.id) === String(selectedSessionId))
  const visibleStudents = selectedSession && selectedSession.studentIds && selectedSession.studentIds.length > 0
    ? (questionnaire?.assignedStudents || []).filter(s => selectedSession.studentIds.map(String).includes(String(s.id)))
    : (questionnaire?.assignedStudents || [])

  useEffect(() => {
    if (!selectedSessionId && sessionsList.length) {
      setSelectedSessionId(sessionsList[0].id)
    }
  }, [sessionsList, selectedSessionId])

  const loadStudents = useCallback(async () => {
    try {
      const s = await listStudents()
      setStudents(Array.isArray(s) ? s : [])
      if (s && s.length && !selectedStudentId) setSelectedStudentId(s[0].id || s[0]._id)
    } catch (e) {
      console.error('Failed to load students', e)
      // If the API forbids access (student user), hide the sidebar to avoid exposing UI
      if (e && (e.status === 401 || e.status === 403)) {
      
        setStudents([])
      }
    }
  }, [selectedStudentId])

  const loadMembershipOptions = useCallback(async () => {
    if (!canEdit) return
    try {
      const [teachersJson, studentsJson] = await Promise.all([listTeachers(), listStudents()])
      setAvailableTeachers(Array.isArray(teachersJson) ? teachersJson : [])
      setAvailableStudents(Array.isArray(studentsJson) ? studentsJson : [])
    } catch (e) {
      console.error('Failed to load questionnaire membership options', e)
    }
  }, [canEdit])

    useEffect(() => {
    if (settingsOpen) {
      loadMembershipOptions()
    }
  }, [settingsOpen, loadMembershipOptions])

  useEffect(() => {
    if (viewerMode !== 'teacher') {
      setStudents([])
      return
    }

    if (readOnly && showStudentsSidebar) {
      loadStudents()
    }
  }, [
    readOnly,
    viewerMode,
    showStudentsSidebar,
    loadStudents,
  ])

  // when selected student changes, load their answers for this questionnaire
  useEffect(() => {
    async function loadForStudent() {
      // Never fetch other students results outside of teacher view
      if (viewerMode !== 'teacher') return
      if (!selectedStudentId) return

      try {
        const res = await getStudentResults(selectedStudentId)
        // res can be array of submissions or object
        let submission = null
        if (Array.isArray(res)) submission = res.find(r => String((r && r.questionnaireId) || (r && r.questionnaire) || '') === String(effectiveQuestionnaireId))
        else if (res && Array.isArray(res.results)) submission = res.results.find(r => String((r && r.questionnaireId) || (r && r.questionnaire) || '') === String(effectiveQuestionnaireId))
        else if (res && res.questionnaireId && String(res.questionnaireId) === String(effectiveQuestionnaireId)) submission = res

        if (submission && Array.isArray(submission.answers)) {
          const map = {}
          for (const a of submission.answers) {
            const qId = (a && a.questionId) || a.id || a.question || null
            if (!qId) continue
            map[qId] = a.answer
          }
          setCollectedAnswers(map)
        } else {
          setCollectedAnswers({})
        }
      } catch (e) {
        console.error('Failed to load student results', e)
        setCollectedAnswers({})
      }
    }
    loadForStudent()
  }, [selectedStudentId, effectiveQuestionnaireId, viewerMode])


  const load = useCallback(async () => {
    if (!effectiveQuestionnaireId) return
    setLoading(true)
    setError(null)
    try {
      const qJson = await getQuestionnaire(effectiveQuestionnaireId)
      setQuestionnaire(qJson)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [effectiveQuestionnaireId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const cats =
      questionnaire?.categories ?? []

    if (!cats.length) {
      setSelectedCategoryId(null)
      setSelectedPageIndex(0)
      return
    }

    const ids = cats.map(c => c.id)

    const nextId =
      ids.includes(selectedCategoryId)
        ? selectedCategoryId
        : cats[0].id

    setSelectedCategoryId(nextId)

    setSelectedPageIndex(
      Math.max(
        0,
        cats.findIndex(c => c.id === nextId)
      )
    )
  }, [questionnaire])

  useEffect(() => {
    const cats = (questionnaire && Array.isArray(questionnaire.categories)) ? questionnaire.categories : []
    if (!cats.length) {
      setSelectedCategoryId(null)
      setSelectedPageIndex(0)
      return
    }

    const ids = cats.map(c => c.id)
    const nextId = (selectedCategoryId && ids.includes(selectedCategoryId)) ? selectedCategoryId : cats[0].id
    const nextIdx = Math.max(0, cats.findIndex(c => c.id === nextId))

    setSelectedCategoryId(prev => (prev === nextId ? prev : nextId))
    setSelectedPageIndex(prev => (prev === nextIdx ? prev : nextIdx))
  }, [questionnaire, selectedCategoryId])


  // answers map collected from child QuestionComponent
  const [collectedAnswers, setCollectedAnswers] = useState({})

  const handleAnswerChange =
  useCallback((questionId, answer) => {
    setCollectedAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }))
  }, [])

  // try to restore saved answers from localStorage on mount
  useEffect(() => {
  try {
    const raw =
      localStorage.getItem(
        `answers_${effectiveQuestionnaireId}`
      )

    setCollectedAnswers(
      raw ? JSON.parse(raw) : {}
    )
  } catch {
    setCollectedAnswers({})
  }
  }, [effectiveQuestionnaireId])
  useEffect(() => {
    try {
      localStorage.setItem(
        `answers_${effectiveQuestionnaireId}`,
        JSON.stringify(
          collectedAnswers
        )
      )
    } catch {}
  }, [
    effectiveQuestionnaireId,
    collectedAnswers,
  ])


  function openPreview(mode) {
    setPreviewMode(mode)
  }

  async function addQuestionToCategory(catId) {
    if (!canEdit) return
    if (!catId) return
    const total = questionnaire && questionnaire.categories ? questionnaire.categories.reduce((s,c) => s + ((c.questions || []).length), 0) : 0
    if (total >= 6) { console.warn('Limite de 6 questions générales atteinte'); return }
    try {
      await addQuestionToCategoryApi(catId, { title: 'Nouvelle question' })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }



  async function saveQuestionnaireTitle(title) {
    if (!canEdit) return;
    if (!effectiveQuestionnaireId) return;
    try {
      await updateQuestionnaire(effectiveQuestionnaireId, { title })
      setQuestionnaire(q => ({ ...(q || {}), title }))
    } catch (e) {
      setError(e.message)
    }
  }

  async function updateQuestionnaireSettings(patch) {
    if (!canEdit) return
    if (!effectiveQuestionnaireId) return
    const nextPatch = { ...patch }
    setQuestionnaire(q => ({ ...(q || {}), ...nextPatch }))
    try {
      await updateQuestionnaire(effectiveQuestionnaireId, nextPatch)
    } catch (e) {
      setError(e.message)
      await load()
    }
  }

  async function updateMembership(patch) {
    if (!canEdit || !effectiveQuestionnaireId) return
    const teacherIds = patch.teacherIds ?? (questionnaire?.juryMembers || []).map(t => t.id)
    const studentIds = patch.studentIds ?? (questionnaire?.assignedStudents || []).map(s => s.id)
    setQuestionnaire(q => ({
      ...(q || {}),
      juryMembers: availableTeachers.filter(t => teacherIds.map(String).includes(String(t.id))),
      assignedStudents: availableStudents.filter(s => studentIds.map(String).includes(String(s.id))),
    }))
    try {
      const updated = await updateQuestionnaireJury(effectiveQuestionnaireId, { teacherIds, studentIds })
      setQuestionnaire(q => ({
        ...(q || {}),
        juryMembers: updated.teachers || [],
        assignedStudents: updated.students || [],
      }))
    } catch (e) {
      setError(e.message)
      await load()
    }
  }

  function buildJuryGroupsFromQuestionnaire() {
    const rawGroups = questionnaire?.juryGroups
    let groups = []

    if (Array.isArray(rawGroups)) {
      groups = rawGroups
    } else if (typeof rawGroups === 'string' && rawGroups.trim()) {
      try {
        groups = JSON.parse(rawGroups)
      } catch {
        groups = []
      }
    }

    if (Array.isArray(groups) && groups.length) {
      return groups.map((group, index) => ({
        id: group.id || `group-${Date.now()}-${index}`,
        name: group.name || `Groupe ${index + 1}`,
        teacherIds: Array.isArray(group.teacherIds) ? group.teacherIds : [],
        studentIds: Array.isArray(group.studentIds) ? group.studentIds : [],
      }))
    }

    return [
      {
        id: `group-${Date.now()}`,
        name: 'Jury principal',
        teacherIds: (questionnaire?.juryMembers || []).map(t => t.id),
        studentIds: (questionnaire?.assignedStudents || []).map(s => s.id),
      },
    ]
  }

  async function saveJuryGroups() {
    if (!canEdit || !effectiveQuestionnaireId) return
    const teacherIds = Array.from(new Set(juryGroups.flatMap(g => g.teacherIds))).filter(Boolean)
    const studentIds = Array.from(new Set(juryGroups.flatMap(g => g.studentIds))).filter(Boolean)
    const groupsPayload = juryGroups.map(({ id, name, teacherIds, studentIds }) => ({
      id,
      name: name || 'Groupe',
      teacherIds: Array.isArray(teacherIds) ? teacherIds : [],
      studentIds: Array.isArray(studentIds) ? studentIds : [],
    }))

    try {
      await Promise.all([
        updateQuestionnaire(effectiveQuestionnaireId, { juryGroups: groupsPayload }),
        updateQuestionnaireJury(effectiveQuestionnaireId, { teacherIds, studentIds }),
      ])
      setQuestionnaire(q => ({
        ...(q || {}),
        juryGroups: groupsPayload,
        juryMembers: availableTeachers.filter(t => teacherIds.map(String).includes(String(t.id))),
        assignedStudents: availableStudents.filter(s => studentIds.map(String).includes(String(s.id))),
      }))
      setJuryDialogOpen(false)
    } catch (e) {
      setError(e.message)
    }
  }

  function openJuryDialog() {
    setJuryGroups(buildJuryGroupsFromQuestionnaire())
    setJuryDialogOpen(true)
  }

  function openSessionsDialog() {
    setSessions(buildSessionsFromQuestionnaire())
    setSessionsDialogOpen(true)
  }

  async function saveSessions() {
    const sessionsPayload = sessions.map(session => ({
      id: session.id,
      name: session.name,
      studentIds: Array.isArray(session.studentIds) ? session.studentIds : [],
    }))
    try {
      const updated = await updateQuestionnaire(effectiveQuestionnaireId, { sessions: sessionsPayload })
      setQuestionnaire(updated)
      setSessionsDialogOpen(false)
    } catch (err) {
      console.error('Could not save sessions', err)
    }
  }

  function addJuryGroup() {
    setJuryGroups(prev => [
      ...prev,
      {
        id: `group-${Date.now()}-${prev.length + 1}`,
        name: `Groupe ${prev.length + 1}`,
        teacherIds: [],
        studentIds: [],
      },
    ])
  }

  function updateJuryGroup(groupId, patch) {
    setJuryGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...patch } : g))
  }

  function removeJuryGroup(groupId) {
    setJuryGroups(prev => prev.filter(g => g.id !== groupId))
  }

  function addParticipantToGroup(groupId, type, id) {
    setJuryGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g
      const key = type === 'teacher' ? 'teacherIds' : 'studentIds'
      const ids = g[key] || []
      if (ids.map(String).includes(String(id))) return g
      return { ...g, [key]: [...ids, id] }
    }))
  }

  function removeParticipantFromGroup(groupId, type, id) {
    const key = type === 'teacher' ? 'teacherIds' : 'studentIds'
    setJuryGroups(prev => prev.map(g => g.id === groupId ? { ...g, [key]: g[key].filter(item => String(item) !== String(id)) } : g))
  }

  async function deleteCurrentCategory() {
    if (!canEdit) return
    if (!selectedCategoryId) return
    if (!confirm('Supprimer la catégorie en cours ?')) return
    try {
      await deleteCategoryApi(selectedCategoryId)
      setSelectedCategoryId(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function addCategory() {
    if (!canEdit) return
    const title = prompt('Titre de la nouvelle catégorie')
    if (!title) return
    try {
      await addCategoryApi(effectiveQuestionnaireId, { title })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function renameCategory(index, newTitle) {
    if (!canEdit) return
    if (!questionnaire || !Array.isArray(questionnaire.categories)) return
    const cat = questionnaire.categories[index]
    if (!cat) return
    try {
      await updateCategoryApi(cat.id, { title: newTitle })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }


  async function deleteQuestionnaire() {
    if (!canEdit) return
    if (!effectiveQuestionnaireId) return
    if (!confirm('Supprimer ce questionnaire ? Cette action est définitive.')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteQuestionnaireApi(effectiveQuestionnaireId)
      navigate('/dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const flat = useMemo(() => {
  if (!questionnaire?.categories)
    return []

  return questionnaire.categories.flatMap(c =>
    selectedCategoryId &&
    c.id !== selectedCategoryId
      ? []
      : (c.questions || []).map(q => ({
          category: c,
          question: q,
        }))
  )
}, [
  questionnaire,
  selectedCategoryId,
])
  const selectedCategory = useMemo(() => {
    const cats = questionnaire && Array.isArray(questionnaire.categories) ? questionnaire.categories : []
    return cats.find(c => c.id === selectedCategoryId) || null
  }, [questionnaire, selectedCategoryId])

  const totalQuestions = useMemo(() => {
    return (questionnaire && Array.isArray(questionnaire.categories))
      ? questionnaire.categories.reduce((s, c) => s + ((c && c.questions) ? c.questions.length : 0), 0)
      : 0
  }, [questionnaire])

  const canAddQuestion = canEdit && totalQuestions < 6
  const addSlotIndex = Math.min(flat.length, 5)

  const slots = useMemo(() => {
    const out = []
    for (let i = 0; i < 6; i++) out.push(flat[i] || null)
    return out
  }, [flat])

  // Calculate score for teacher view
  const studentScore = useMemo(() => {
    if (!readOnly || viewerMode !== 'teacher' || !questionnaire || !Array.isArray(questionnaire.categories)) {
      return null
    }
    let total = 0
    for (const cat of questionnaire.categories) {
      if (!Array.isArray(cat.questions)) continue
      for (const q of cat.questions) {
        const answer = collectedAnswers && collectedAnswers[q.id]
        if (!Array.isArray(q.elements)) continue
        for (const el of q.elements) {
          if (!el || !el.evaluatingType) continue
          const type = Number(el.evaluatingType)
          if (type === 1 && answer === el.id) total += Number(el.evaluatingValue || 0)
          if (type === 2 && answer !== el.id && answer !== null && answer !== undefined) total += Number(el.evaluatingValue || 0)
        }
      }
    }
    return total
  }, [collectedAnswers, questionnaire, readOnly, viewerMode])

  function evaluationLabel(element) {
    const type = Number(element?.evaluatingType || 0)
    const value = Number(element?.evaluatingValue || 0)
    if (type === 1) return `+${value} pt`
    if (type === 2) return `-${value} pt`
    if (type === 3) return `coef. ${value}`
    if (type === 5) return 'plafond catégorie'
    return 'non noté'
  }

  useEffect(() => {
    if (!effectiveQuestionnaireId) {
      navigate('/dashboard')
    }
  }, [
    effectiveQuestionnaireId,
    navigate,
  ])

  const selectPage = useCallback(
  (idx) => {
    setSelectedPageIndex(idx)

    const p = pages[idx]
    setSelectedCategoryId(
      p?.id ?? null
    )
  },
  [pages]
)

  return (
    <>
      <Stack sx={{ height: '100vh', overflow: 'hidden', p: 0, pt: 0, mt: 0, m: 0 }}>
        <TopAppBar
          pages={pages}
          selectedPage={selectedPageIndex}
          onSelectPage={selectPage}
          onAddCategory={canEdit ? addCategory : undefined}
          onRenamePage={canEdit ? renameCategory : undefined}
          title={questionnaire && questionnaire.title}
          onTitleChange={canEdit ? saveQuestionnaireTitle : undefined}
          date={questionnaire?.date}
          onDateChange={canEdit ? (newDate) => updateQuestionnaireSettings({ date: newDate }) : undefined}
          centerActions={canEdit ? (
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                p: 1,
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid rgba(0,0,0,0.10)',
                boxShadow: 'none',
              }}
            >
              <Tooltip title="Aperçu enseignant">
                <span>
                  <IconButton
                    size="small"
                    disabled={!selectedCategoryId}
                    onClick={() => openPreview('teacher')}
                    sx={{ width: 36, height: 36 }}
                  >
                    <CoPresentIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Aperçu étudiant">
                <span>
                  <IconButton
                    size="small"
                    disabled={!selectedCategoryId}
                    onClick={() => openPreview('student')}
                    sx={{ width: 36, height: 36 }}
                  >
                    <SchoolIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Paper>
          ) : (readOnly && viewerMode === 'teacher' && studentScore !== null) ? (
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                bgcolor: 'background.paper',
                border: '1px solid rgba(0,0,0,0.12)',
                px: 2,
                py: 0.75,
                borderRadius: 2,
              }}
            >
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Note</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{`${studentScore} / ${questionnaire?.maxScore ?? 20}`}</Typography>
            </Paper>
          ) : null}
          rightActions={rightActions ?? (canEdit ? (
            <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  p: 1,
                  borderRadius: 4,
                  bgcolor: 'background.paper',
                  border: '1px solid rgba(0,0,0,0.10)',
                  boxShadow: 'none',
                }}
            >
              <Tooltip title="Paramètres du questionnaire">
                <span>
                  <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Paper>
          ) : null)}
          hideDashboardLink={readOnly || !!rightActions}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: readOnly && viewerMode === 'teacher' && showStudentsSidebar ? 2 : 1, flex: 1, pt: '76px', minHeight: 0 }}>
          {/* When readOnly, show students list on the left like the design */}
          {readOnly && viewerMode === 'teacher' && showStudentsSidebar && (
            <Box sx={{ width: { xs: 80, sm: 240 }, flex: '0 0 auto', px: 1, pr: 2 }}>
              <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.06)', height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Sessions</Typography>
                  <Button size="small" variant="outlined" onClick={openSessionsDialog}>
                    Gérer
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2, maxHeight: 220, overflowY: 'auto' }}>
                  {sessionsList && sessionsList.length ? sessionsList.map(session => (
                    <Button
                      key={session.id}
                      fullWidth
                      variant={String(selectedSessionId) === String(session.id) ? 'contained' : 'outlined'}
                      onClick={() => setSelectedSessionId(session.id)}
                      sx={{ textTransform: 'none', justifyContent: 'flex-start', borderRadius: 4.5, p: 1.5, fontSize: 13 }}
                    >
                      {session.name}
                    </Button>
                  )) : (
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Aucune session</Typography>
                  )}
                </Box>
                <Typography sx={{ fontWeight: 700, mb: 1, fontSize: 14 }}>Étudiants</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                  {visibleStudents && visibleStudents.length ? visibleStudents.map(s => (
                    <Box key={s.id || s._id} sx={{ px: 0.5 }}>
                      <Button
                        fullWidth
                        variant={selectedStudentId && String(selectedStudentId) === String(s.id || s._id) ? 'contained' : 'outlined'}
                        onClick={() => setSelectedStudentId(s.id || s._id)}
                        sx={{
                          textTransform: 'none',
                          justifyContent: 'flex-start',
                          borderRadius: 4.5,
                          p: 1.75,
                          fontSize: 13,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {(() => {
                          const last = s.nom || s.lastName || s.name || '';
                          const first = s.prenom || s.firstName || '';
                          const fullname = [last, first].filter(Boolean).join(' ').trim();
                          if (fullname) return fullname;
                          if (s.email) return s.email;
                          return 'Étudiant';
                        })()}
                      </Button>
                    </Box>
                  )) : (
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Aucun étudiant</Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          )}

          {/* Center - questions grid, full width */}
          <Box sx={{ flex: 1, overflow: 'hidden', pr: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {error && (
              <Box sx={{ px: 2, pt: 1 }}>
                <Typography color="error" sx={{ fontSize: 13 }}>{error}</Typography>
              </Box>
            )}

            {/* 2 lignes x 3 colonnes (6 slots) */}
            <Box
              sx={{
                p: 0.75,
                px: { xs: 2, sm: 12 },
                width: '100%',
                maxWidth: 1400,
                mx: 'auto',
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gridTemplateRows: { sm: 'repeat(2, minmax(0, 1fr))' },
                alignItems: 'stretch',
                position: 'relative',
              }}
            >
              {/* Side arrows centered in the outer margins */}
              <IconButton
                size="small"
                disabled={selectedPageIndex <= 0}
                onClick={() => {
                  setSelectedPageIndex(idx => {
                    const next = Math.max(0, idx - 1);
                    const p = pages[next];
                    setSelectedCategoryId(p && p.id ? p.id : null);
                    return next;
                  });
                }}
                sx={{
                  position: 'fixed',
                  left: '32px',
                  top: 'calc(76px + (100vh - 76px) / 2)',
                  transform: 'translate(0, -50%)',
                  bgcolor: 'background.paper',
                  border: '1px solid rgba(0,0,0,0.08)',
                  zIndex: 1200,
                  p: 2
                }}
              >
                <ArrowBackIcon />
              </IconButton>

              <IconButton
                size="small"
                disabled={selectedPageIndex >= ((pages && pages.length ? pages.length : 1) - 1)}
                onClick={() => {
                  setSelectedPageIndex(idx => {
                    const next = Math.min((pages && pages.length ? pages.length : 1) - 1, idx + 1);
                    const p = pages[next];
                    setSelectedCategoryId(p && p.id ? p.id : null);
                    return next;
                  });
                }}
                sx={{
                  position: 'fixed',
                  right: '32px',
                  top: 'calc(76px + (100vh - 76px) / 2)',
                  transform: 'translate(0, -50%)',
                  bgcolor: 'background.paper',
                  border: '1px solid rgba(0,0,0,0.08)',
                  zIndex: 1200,
                  p: 2
                }}
              >
                <ArrowForwardIcon />
              </IconButton>
              {slots.map((p, i) => (
                <Box key={p ? p.question.id : `slot-${i}`} sx={{ minHeight: 210, height: '100%', '& .MuiCard-root': { height: '100%' } }}>
                  {p ? (
                    <QuestionComponent data={p.question} category={p.category} questionnaireId={effectiveQuestionnaireId} index={i + 1} onRefresh={load} readOnly={!canEdit} onAnswerChange={handleAnswerChange} externalAnswer={collectedAnswers && collectedAnswers[p.question.id ? p.question.id : (i+1)]} />
                  ) : (canAddQuestion && i === addSlotIndex) ? (
                    <Box
                      onClick={() => addQuestionToCategory(selectedCategoryId)}
                      sx={{
                        border: '1px dashed rgba(0,0,0,0.12)',
                        borderRadius: 2,
                        height: '100%',
                        minHeight: 210,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'text.secondary',
                        bgcolor: 'transparent',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                        <AddIcon />
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ borderRadius: 2, height: '100%', minHeight: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', bgcolor: 'transparent' }} />
                  )}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Bottom-right category actions (add question + delete category) */}
          {canEdit && (
            <Paper
              elevation={0}
              sx={{
                position: 'fixed',
                right: { xs: 16, sm: 20 },
                bottom: { xs: 16, sm: 20 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                p: 0.2,
                pr: 0.2,
                pb: 0.4,
                borderRadius: 999,
                bgcolor: 'background.paper',
                border: '1px solid rgba(0,0,0,0.10)',
                boxShadow: 'none',
                zIndex: 1200,
              }}
            >
              <Tooltip title="Ajouter une catégorie">
                <span>
                  <IconButton
                    size="large"
                    onClick={addCategory}
                    sx={{ width: 52, height: 52 }}
                  >
                    <AddIcon />
                  </IconButton>
                </span>
              </Tooltip>

              <Divider sx={{ width: '28px' }} />

              <Tooltip title="Supprimer la catégorie">
                <span>
                  <IconButton
                    size="large"
                    disabled={!selectedCategoryId}
                    onClick={deleteCurrentCategory}
                    sx={{ width: 52, height: 52 }}
                  >
                    <DeleteIcon sx={{ color: 'error.main' }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Paper>
          )}

          <Paper
            elevation={0}
            sx={{
              position: 'fixed',
              right: { xs: 88, sm: 96 },
              visibility: 'hidden',
              bottom: { xs: 16, sm: 20 },
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              p: 1,
              borderRadius: 999,
              bgcolor: 'background.paper',
              border: '1px solid rgba(0,0,0,0.10)',
              boxShadow: 'none',
              zIndex: 1200,
            }}
          >
            <Tooltip title="Aperçu enseignant">
              <span>
                <IconButton
                  size="large"
                  disabled={!selectedCategoryId}
                  onClick={() => openPreview('teacher')}
                  sx={{ width: 52, height: 52 }}
                >
                  <CoPresentIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Aperçu étudiant">
              <span>
                <IconButton
                  size="large"
                  disabled={!selectedCategoryId}
                  onClick={() => openPreview('student')}
                  sx={{ width: 52, height: 52 }}
                >
                  <SchoolIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Paper>

        </Box>
      </Stack>
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 380 },
            maxWidth: '100%',
            borderRadius: 0,
            boxShadow: 'none',
            borderLeft: '1px solid rgba(0,0,0,0.10)',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
          <Box sx={{ px: { xs: 2, sm: 4 }, py: 1.5, minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 600 }}>Paramètres</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Questionnaire</Typography>
            </Box>
            <IconButton size="small" onClick={() => setSettingsOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Divider />

          <Stack spacing={2.25} sx={{ p: 2 }}>
            <TextField
              label="Note maximale"
              type="number"
              size="small"
              value={questionnaire?.maxScore ?? 20}
              onChange={(event) => {
                const raw = event.target.value;
                setQuestionnaire(q => ({ ...(q || {}), maxScore: raw === '' ? '' : parseFloat(raw) }));
              }}
              onBlur={(event) => {
                const raw = event.target.value;
                const nextValue = raw === '' ? 0 : parseFloat(raw);
                updateQuestionnaireSettings({ maxScore: Number.isNaN(nextValue) ? 0 : nextValue });
              }}
              inputProps={{ min: 0, step: 0.1 }}
              fullWidth
            />

            <FormControl fullWidth size="small">
              <InputLabel id="questionnaire-grading-mode-label">Type de note global</InputLabel>
              <Select
                labelId="questionnaire-grading-mode-label"
                label="Type de note global"
                value={questionnaire?.gradingMode || 'points'}
                onChange={(event) => updateQuestionnaireSettings({ gradingMode: event.target.value })}
              >
                <MenuItem value="points">Points</MenuItem>
                <MenuItem value="coefficient">Coefficients</MenuItem>
                <MenuItem value="percentage">Pourcentage</MenuItem>
              </Select>
            </FormControl>

            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Groupes de jury</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>Gérez les enseignants et étudiants par groupe</Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={openJuryDialog} sx={{ borderRadius: 8, textTransform: 'none' }}>
                  Gérer les groupes de jury
                </Button>
              </Box>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>Enseignants</Typography>
              <Typography sx={{ fontSize: 14, mb: 1 }}>
                {questionnaire?.juryMembers?.length
                  ? questionnaire.juryMembers.map(t => t.email).join(', ')
                  : 'Aucun enseignant assigné'}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>Étudiants</Typography>
              <Typography sx={{ fontSize: 14 }}>
                {questionnaire?.assignedStudents?.length
                  ? questionnaire.assignedStudents.map(s => [s.nom, s.prenom].filter(Boolean).join(' ') || s.email).join(', ')
                  : 'Aucun étudiant associé'}
              </Typography>
            </Paper>

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={!!questionnaire?.openForStudents}
                  onChange={(event) => updateQuestionnaireSettings({ openForStudents: event.target.checked })}
                />
              }
              label="Questionnaire ouvert aux étudiants"
              sx={{ mx: 0, justifyContent: 'space-between', '& .MuiFormControlLabel-label': { fontSize: 14 } }}
              labelPlacement="start"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={!!questionnaire?.showResults}
                  onChange={(event) => updateQuestionnaireSettings({ showResults: event.target.checked })}
                />
              }
              label="Afficher le résultat après réponse"
              sx={{ mx: 0, justifyContent: 'space-between', '& .MuiFormControlLabel-label': { fontSize: 14 } }}
              labelPlacement="start"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={!!questionnaire?.shuffleQuestions}
                  onChange={(event) => updateQuestionnaireSettings({ shuffleQuestions: event.target.checked })}
                />
              }
              label="Mélanger les questions"
              sx={{ mx: 0, justifyContent: 'space-between', '& .MuiFormControlLabel-label': { fontSize: 14 } }}
              labelPlacement="start"
            />
          </Stack>
        </Box>
      </Drawer>
      <Dialog
        fullWidth
        maxWidth="lg"
        open={juryDialogOpen}
        onClose={() => setJuryDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 12, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ color: 'text.primary', bgcolor: 'background.default', borderBottom: '1px solid rgba(0,0,0,0.08)', py: 2 }}>
          Gérer les groupes de jury
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'background.default', p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, minHeight: 520, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320, maxHeight: 520, overflowY: 'auto' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>Liste des groupes</Typography>
                <Button size="small" variant="outlined" onClick={addJuryGroup} sx={{ borderRadius: 8, textTransform: 'none' }}>
                  Ajouter un groupe
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {juryGroups.map(group => (
                  <Paper key={group.id} elevation={0} sx={{ p: 2, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TextField
                        value={group.name}
                        onChange={(event) => updateJuryGroup(group.id, { name: event.target.value })}
                        label="Nom du groupe"
                        size="small"
                        fullWidth
                      />
                      <IconButton size="small" onClick={() => removeJuryGroup(group.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>Enseignants</Typography>
                    <Box
                      onDragOver={(e) => { e.preventDefault(); setDragOverTarget(`${group.id}-teacher`) }}
                      onDragLeave={() => setDragOverTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault(); setDragOverTarget(null)
                        try {
                          const payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}')
                          if (payload.type === 'teacher' && payload.id) addParticipantToGroup(group.id, 'teacher', payload.id)
                        } catch {}
                      }}
                      sx={{
                        minHeight: 64,
                        p: 1,
                        borderRadius: 1,
                        border: '1px dashed rgba(0,0,0,0.18)',
                        bgcolor: dragOverTarget === `${group.id}-teacher` ? 'rgba(0,0,0,0.04)' : 'transparent',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center',
                      }}
                    >
                      {group.teacherIds.length > 0 ? group.teacherIds.map((teacherId) => {
                        const teacher = availableTeachers.find(t => String(t.id) === String(teacherId))
                        if (!teacher) return null
                        return (
                          <Chip
                            key={`teacher-${group.id}-${teacher.id}`}
                            label={teacher.email}
                            size="small"
                            onDelete={() => removeParticipantFromGroup(group.id, 'teacher', teacher.id)}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'teacher', id: teacher.id }))}
                          />
                        )
                      }) : (
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Glissez des enseignants ici</Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1, mt: 2 }}>Étudiants</Typography>
                    <Box
                      onDragOver={(e) => { e.preventDefault(); setDragOverTarget(`${group.id}-student`) }}
                      onDragLeave={() => setDragOverTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault(); setDragOverTarget(null)
                        try {
                          const payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}')
                          if (payload.type === 'student' && payload.id) addParticipantToGroup(group.id, 'student', payload.id)
                        } catch {}
                      }}
                      sx={{
                        minHeight: 64,
                        p: 1,
                        borderRadius: 1,
                        border: '1px dashed rgba(0,0,0,0.18)',
                        bgcolor: dragOverTarget === `${group.id}-student` ? 'rgba(0,0,0,0.04)' : 'transparent',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center',
                      }}
                    >
                      {group.studentIds.length > 0 ? group.studentIds.map((studentId) => {
                        const student = availableStudents.find(s => String(s.id) === String(studentId))
                        if (!student) return null
                        const name = [student.nom, student.prenom].filter(Boolean).join(' ') || student.email
                        return (
                          <Chip
                            key={`student-${group.id}-${student.id}`}
                            label={name}
                            size="small"
                            onDelete={() => removeParticipantFromGroup(group.id, 'student', student.id)}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'student', id: student.id }))}
                          />
                        )
                      }) : (
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Glissez des étudiants ici</Typography>
                      )}
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Box>
            <Box sx={{ flex: 0.9, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 280, maxHeight: 520, overflowY: 'auto' }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.12)' }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Enseignants</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {availableTeachers.map((teacher) => {
                    const assignedCount = juryGroups.filter(g => g.teacherIds.map(String).includes(String(teacher.id))).length
                    return (
                      <Box
                        key={teacher.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'teacher', id: teacher.id }))}
                        sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                      >
                        <Typography sx={{ fontSize: 14 }}>{teacher.email}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{assignedCount ? `${assignedCount} groupe${assignedCount > 1 ? 's' : ''}` : 'non assigné'}</Typography>
                      </Box>
                    )
                  })}
                </Box>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(0,0,0,0.12)' }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Étudiants</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {availableStudents.map((student) => {
                    const assignedCount = juryGroups.filter(g => g.studentIds.map(String).includes(String(student.id))).length
                    const name = [student.nom, student.prenom].filter(Boolean).join(' ') || student.email
                    return (
                      <Box
                        key={student.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'student', id: student.id }))}
                        sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
                      >
                        <Typography sx={{ fontSize: 14 }}>{name}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{assignedCount ? `${assignedCount} groupe${assignedCount > 1 ? 's' : ''}` : 'non assigné'}</Typography>
                      </Box>
                    )
                  })}
                </Box>
              </Paper>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, bgcolor: 'background.default', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Button variant="text" onClick={() => setJuryDialogOpen(false)} sx={{ borderRadius: 8, textTransform: 'none' }}>
            Annuler
          </Button>
          <Button variant="outlined" onClick={saveJuryGroups} sx={{ borderRadius: 8, textTransform: 'none' }}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        fullScreen
        open={!!previewMode}
        onClose={() => setPreviewMode(null)}
        TransitionComponent={Transition}
        PaperProps={{ sx: { bgcolor: 'background.default' } }}
      >

        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 2, py: 1.5 }}>
            <TopAppBar
              pages={pages}
              selectedPage={selectedPageIndex}
              onSelectPage={selectPage}
              title={questionnaire && questionnaire.title}
              onTitleChange={undefined}
              onAddCategory={undefined}
              date={questionnaire?.date}
              onDateChange={undefined}
              centerActions={previewMode === 'teacher' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, bgcolor: 'background.paper', border: '1px solid rgba(0,0,0,0.12)', px: 2, py: 0.75, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Note</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{`${'—'} / ${questionnaire?.maxScore ?? 20}`}</Typography>
                </Box>
              ) : null}
              rightActions={<IconButton size="small" onClick={() => setPreviewMode(null)}><CloseIcon fontSize="small" /></IconButton>}
              hideDashboardLink={true}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 1, flex: 1, pt: '76px', minHeight: 0 }}>
            <Box sx={{ flex: 1, overflow: 'hidden', pr: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {error && (
                <Box sx={{ px: 2, pt: 1 }}>
                  <Typography color="error" sx={{ fontSize: 13 }}>{error}</Typography>
                </Box>
              )}

              <Box
                sx={{
                  p: 0.75,
                  px: { xs: 2, sm: 12 },
                  width: '100%',
                  maxWidth: 1400,
                  mx: 'auto',
                  flex: 1,
                  minHeight: 0,
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gridTemplateRows: { sm: 'repeat(2, minmax(0, 1fr))' },
                  alignItems: 'stretch',
                  position: 'relative',
                }}
              >
                <IconButton
                  size="small"
                  disabled={selectedPageIndex <= 0}
                  onClick={() => {
                    setSelectedPageIndex(idx => {
                      const next = Math.max(0, idx - 1);
                      const p = pages[next];
                      setSelectedCategoryId(p && p.id ? p.id : null);
                      return next;
                    });
                  }}
                  sx={{
                    position: 'fixed',
                    left: 'calc((100vw - min(1400px, 100vw)) / 4 + 24px)',
                    top: 'calc(76px + (100vh - 76px) / 2)',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: 'background.paper',
                    border: '1px solid rgba(0,0,0,0.08)',
                    zIndex: 1200,
                    p: 2
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>

                <IconButton
                  size="small"
                  disabled={selectedPageIndex >= ((pages && pages.length ? pages.length : 1) - 1)}
                  onClick={() => {
                    setSelectedPageIndex(idx => {
                      const next = Math.min((pages && pages.length ? pages.length : 1) - 1, idx + 1);
                      const p = pages[next];
                      setSelectedCategoryId(p && p.id ? p.id : null);
                      return next;
                    });
                  }}
                  sx={{
                    position: 'fixed',
                    right: 'calc((100vw - min(1400px, 100vw)) / 4 + 24px)',
                    top: 'calc(76px + (100vh - 76px) / 2)',
                    transform: 'translate(50%, -50%)',
                    bgcolor: 'background.paper',
                    border: '1px solid rgba(0,0,0,0.08)',
                    zIndex: 1200,
                    p: 2
                  }}
                >
                  <ArrowForwardIcon />
                </IconButton>

                {slots.map((p, i) => (
                  <Box key={p ? p.question.id : `slot-${i}`} sx={{ minHeight: 210, height: '100%' }}>
                    {p ? (
                      <QuestionComponent data={p.question} category={p.category} questionnaireId={effectiveQuestionnaireId} index={i + 1} onRefresh={load} readOnly={true} onAnswerChange={handleAnswerChange} />
                    ) : (
                      <Box sx={{ border: '1px dashed rgba(0,0,0,0.06)', borderRadius: 2, height: '100%', minHeight: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', bgcolor: 'transparent' }} />
                    )}
                  </Box>
                ))}
              </Box>
            </Box>

          </Box>
        </Box>
      </Dialog>
    </>
  )

}
