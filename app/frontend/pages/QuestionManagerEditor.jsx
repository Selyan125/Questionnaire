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
  Snackbar,
  Alert,
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
  Avatar,
  Radio,
  Checkbox,
  Chip,
  Collapse,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SettingsIcon from '@mui/icons-material/Settings'
import CloseIcon from '@mui/icons-material/Close'
import SchoolIcon from '@mui/icons-material/School'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useNavigate, useParams } from 'react-router-dom'
import TopAppBar from '../components/TopAppBar.jsx'
import QuestionComponent from '../components/QuestionComponent.jsx'
import SessionsManagementDialog from '../components/SessionsManagementDialog.jsx'
import { getQuestionnaire, updateQuestionnaire, deleteQuestionnaire as deleteQuestionnaireApi, addCategory as addCategoryApi } from '../api/questionnaires.js'
import { getStudentResults } from '../api/students.js'
import { addQuestionToCategory as addQuestionToCategoryApi, deleteCategory as deleteCategoryApi, updateCategory as updateCategoryApi } from '../api/categories.js'
import { listStudents } from '../api/students.js'
import { listTeachers, listJuries, createJuryMaster } from '../api/teachers.js'
import { createSession, getQuestionnaireSessions, updateSession, deleteSession, addJuryToSession, removeJuryFromSession, addStudentToSession, removeStudentFromSession, updateSessionStudentJury } from '../api/sessions.js'
import { moveQuestion, reorderQuestions as reorderQuestionsApi } from '../api/questions.js'
import { apiJson } from '../api/http.js'

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="left" ref={ref} {...props} />
})

export default function QuestionManagerEditor({ questionnaireId, readOnly = false, rightActions = undefined, showStudentsSidebar: propShowStudentsSidebar = false, viewerMode = 'teacher' } = {}) {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const effectiveQuestionnaireId = questionnaireId ?? idParam
  
  const authUser = JSON.parse(localStorage.getItem('authUser') || '{}')
  const isAdmin = authUser?.admin === true
  const effectiveReadOnly = readOnly || !isAdmin
  const canEdit = !effectiveReadOnly

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({}) // State for expanding/collapsing jury groups
  const [availableTeachers, setAvailableTeachers] = useState([]) // Keep this
  const [availableStudents, setAvailableStudents] = useState([])
  const [availableJuries, setAvailableJuries] = useState([])
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false)
  const [sessionDetails, setSessionDetails] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [dragOverTarget, setDragOverTarget] = useState(null)
  const [draggedQuestionId, setDraggedQuestionId] = useState(null)

  const [evaluatedStudentIds, setEvaluatedStudentIds] = useState(new Set())
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const pages = questionnaire?.categories ? questionnaire.categories.map(c => ({ name: c.title, id: c.id, maxPoints: c.currentNote })) : [{ name: 'Questions', id: null }]
  const [selectedPageIndex, setSelectedPageIndex] = useState(0)

  const flat = useMemo(() => {
    if (!questionnaire?.categories) return []
    return questionnaire.categories.flatMap(c =>
      (selectedCategoryId && c.id !== selectedCategoryId)
        ? []
        : [...(c.questions || [])]
            .sort((a, b) => (Number(a.priority || 0) - Number(b.priority || 0)))
            .map(q => ({ category: c, question: q }))
    )
  }, [questionnaire, selectedCategoryId])

  const selectedCategory = useMemo(() => {
    const cats = questionnaire && Array.isArray(questionnaire.categories) ? questionnaire.categories : []
    const cat = cats.find(c => c.id === selectedCategoryId) || null
    if (!cat) return null
    return {
      ...cat,
      questions: [...(cat.questions || [])].sort((a, b) => (Number(a.priority || 0) - Number(b.priority || 0)))
    }
  }, [questionnaire, selectedCategoryId])

  const currentSession = useMemo(() => {
    return sessionDetails.find(s => s.id === selectedSessionId);
  }, [sessionDetails, selectedSessionId]);

  const visibleStudents = useMemo(() => {
    if (!currentSession) return []
    if (isAdmin) return currentSession.students || []
    const isTeacherInSession = currentSession.juries?.some(j => j.teacherId === authUser.id)
    return isTeacherInSession ? (currentSession.students || []) : []
  }, [currentSession, isAdmin, authUser.id])

  function safeParseJSON(value) {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  // students sidebar state: controlled by parent via propShowStudentsSidebar
  const [selectedStudentId, setSelectedStudentId] = useState(null)

  useEffect(() => {
    if (!selectedSessionId && sessionDetails.length) {
      setSelectedSessionId(sessionDetails[0].id)
    }
  }, [sessionDetails, selectedSessionId])

  const toggleGroup = (name) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const loadMembershipOptions = useCallback(async () => {
    if (!isAdmin) return
    try {
      const results = await Promise.allSettled([listTeachers(), listStudents(), listJuries()])
      
      const teachersJson = results[0].status === 'fulfilled' ? results[0].value : []
      const studentsJson = results[1].status === 'fulfilled' ? results[1].value : []
      const juriesJson = results[2].status === 'fulfilled' ? results[2].value : []

      setAvailableTeachers(teachersJson)
      setAvailableStudents(studentsJson)
      setAvailableJuries(juriesJson)
    } catch (e) {
      console.error('Failed to load questionnaire membership options', e)
    }
  }, [viewerMode, isAdmin])

  const loadSessionsFromAPI = useCallback(async () => {
    try {
      const loadedSessions = await getQuestionnaireSessions(effectiveQuestionnaireId)
      setSessionDetails(loadedSessions || [])
    } catch (err) {
      console.error('Could not load sessions:', err)
      setSessionDetails([])
    }
  }, [effectiveQuestionnaireId])

  const loadEvaluatedStatus = useCallback(async () => {
    if (!effectiveQuestionnaireId) return
    try {
      const results = await apiJson(`/api/questionnaires/${effectiveQuestionnaireId}/results`)
      const ids = new Set(results.map(r => r.studentId))
      setEvaluatedStudentIds(ids)
    } catch (e) { console.error(e) }
  }, [effectiveQuestionnaireId])

  useEffect(() => {
    if (settingsOpen) {
      loadMembershipOptions()
    }
  }, [settingsOpen, loadMembershipOptions])

  useEffect(() => {
    if (!effectiveQuestionnaireId) return
    loadMembershipOptions()
    loadSessionsFromAPI()
    loadEvaluatedStatus()
  }, [effectiveQuestionnaireId, loadMembershipOptions, loadSessionsFromAPI])

  // when selected student changes, load their answers for this questionnaire
  const loadForStudent = useCallback(async (studentId) => {
    if (!studentId || !effectiveQuestionnaireId) return
    try {
      // On cherche les soumissions existantes pour cet étudiant et ce questionnaire
      const res = await getStudentResults(studentId)
      const submissions = Array.isArray(res) ? res : (res?.results || [])
      
      // On filtre pour trouver la soumission correspondant à la session actuelle ou la plus récente
      const submission = submissions.find(s => 
        Number(s.questionnaireId) === Number(effectiveQuestionnaireId) && 
        (selectedSessionId ? Number(s.sessionId) === Number(selectedSessionId) : true)
      )

      if (submission && submission.answers) {
        const answers = typeof submission.answers === 'string' ? JSON.parse(submission.answers) : submission.answers
        setCollectedAnswers(answers)
      } else {
        setCollectedAnswers({})
      }
    } catch (e) {
      console.error('Failed to load student results', e)
      setCollectedAnswers({})
    }
  }, [effectiveQuestionnaireId, selectedSessionId])

  useEffect(() => {
    if (selectedStudentId) loadForStudent(selectedStudentId)
  }, [selectedStudentId, loadForStudent])

  const saveSubmission = async () => {
    if (!selectedStudentId || !selectedSessionId || !effectiveQuestionnaireId) {
      setError("Veuillez sélectionner un étudiant et une session.")
      return
    }
    try {
      setLoading(true)
      await apiJson('/api/submissions', {
        method: 'POST',
        json: {
          studentId: selectedStudentId,
          questionnaireId: Number(effectiveQuestionnaireId),
          sessionId: Number(selectedSessionId),
          evaluatorId: authUser.id, // On enregistre qui a noté
          answers: collectedAnswers,
          score: studentScore
        }
      })
      setSnackbar({ open: true, message: "Évaluation enregistrée avec succès !", severity: 'success' })
      setSelectedStudentId(null) // On déselectionne pour passer au suivant
      setCollectedAnswers({})
      await loadEvaluatedStatus()
    } catch (e) {
      setSnackbar({ open: true, message: "Erreur lors de la sauvegarde : " + e.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }


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
      questionnaire?.categories || []
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
    const cats = questionnaire?.categories || []
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
    if (selectedStudentId) return // Don't use localStorage if a student is selected
    try {
      const raw = localStorage.getItem(`answers_${effectiveQuestionnaireId}`)
      setCollectedAnswers(raw ? JSON.parse(raw) : {})
    } catch {
      setCollectedAnswers({})
    }
  }, [effectiveQuestionnaireId, selectedStudentId])

  useEffect(() => {
    if (selectedStudentId) return // Don't sync to localStorage if a student is selected
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
    if (!catId) {
      setError("Créez une catégorie avant d'ajouter une question.")
      return
    }
    const limit = questionnaire?.questionsLimit || 6 // Default limit
    const targetCat = questionnaire?.categories?.find(c => c.id === catId)
    const count = targetCat?.questions?.length || 0

    if (count >= limit) { console.warn(`Limite de ${limit} questions atteinte pour cette catégorie`); return }
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

  function formatSessionDate(value) {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('fr-FR')
  }

  async function openSessionsDialog() {
    await loadMembershipOptions()
    await loadSessionsFromAPI() // Ensure sessions are up-to-date
    setSessionsDialogOpen(true)
  }

  async function addJuryMasterUI(name) {
    try {
      await createJuryMaster(name)
      await loadMembershipOptions()
    } catch (err) {
      console.error('Could not create master jury:', err)
    }
  }

  async function addSession() {
    try {
      await createSession(effectiveQuestionnaireId, { name: `Session ${sessionDetails.length + 1}`, date: null })
      await loadSessionsFromAPI()
    } catch (err) {
      console.error('Could not create session:', err)
    }
  }

  async function updateSessionDetails(sessionId, name, date, active) {
    try {
      const current = sessionDetails.find(s => String(s.id) === String(sessionId));
      if (active !== undefined) {
        setSessionDetails(prev => prev.map(s =>
          String(s.id) === String(sessionId) ? { ...s, active: active } : s
        ));
      }

      const payload = { 
        name: name !== undefined ? name : current?.name,
        date: date !== undefined ? date : current?.date,
        active: active !== undefined ? active : current?.active
      };
      const updated = await updateSession(sessionId, payload)
      
      if (updated) {
        setSessionDetails(prev => prev.map(s => 
          String(s.id) === String(sessionId) ? { ...s, ...updated } : s
        ));
      }
    } catch (err) {
      console.error('Could not update session:', err)
      await loadSessionsFromAPI()
    }
  }

  async function removeSessionDetails(sessionId) {
    try {
      await deleteSession(sessionId)
      await loadSessionsFromAPI()
    } catch (err) {
      console.error('Could not delete session:', err)
    }
  }

  async function addJuryToSessionUI(sessionId, juryId, teacherId) {
    try {
      await addJuryToSession(sessionId, { juryId, teacherId }) // API call
      await loadSessionsFromAPI()
    } catch (err) {
      setError(err.message || "Erreur lors de l'ajout du membre du jury")
      console.error('Could not add jury:', err)
    }
  }

  async function removeJuryFromSessionUI(sessionJuryId) {
    try {
      await removeJuryFromSession(sessionJuryId) // API call
      await loadSessionsFromAPI()
    } catch (err) {
      console.error('Could not remove jury:', err)
    }
  }

  async function addStudentToSessionUI(sessionId, studentId, juryId) {
    try {
      await addStudentToSession(sessionId, { studentId, juryId }) // API call
      await loadSessionsFromAPI()
    } catch (err) {
      setError(err.message || "Erreur lors de l'ajout de l'étudiant")
      console.error('Could not add student:', err)
    }
  }

  async function removeStudentFromSessionUI(sessionStudentId) {
    try {
      await removeStudentFromSession(sessionStudentId) // API call
      await loadSessionsFromAPI()
    } catch (err) {
      console.error('Could not remove student:', err)
    }
  }

  const groupedJuryData = useMemo(() => {
    const session = sessionDetails.find(s => s.id === selectedSessionId)
    if (!session) return []
    const groups = {}
    session.juries?.forEach(j => {
      const name = j.juryName || 'Sans nom'
      if (!groups[name]) groups[name] = { name, teachers: [], students: [] }
      groups[name].teachers.push(j)
    })
    session.students?.forEach(s => {
      const name = s.juryName || 'Sans nom'
      if (!groups[name]) groups[name] = { name, teachers: [], students: [] }
      groups[name].students.push(s)
    })
    return Object.values(groups)
  }, [sessionDetails, selectedSessionId])

  const handleQuestionDrop = useCallback(async (qId, targetCategoryId, targetPriority) => {
    const numericQId = Number(qId)
    if (effectiveReadOnly || isNaN(numericQId)) return

    try {
      if (Number(targetCategoryId) === Number(selectedCategoryId)) {
        const questions = selectedCategory?.questions || []
        const currentIdx = questions.findIndex(q => Number(q.id) === numericQId)
        if (currentIdx === -1 || currentIdx === targetPriority) return
        
        const newOrder = [...questions]
        const [moved] = newOrder.splice(currentIdx, 1)
        newOrder.splice(targetPriority, 0, moved)
        
        await reorderQuestionsApi(selectedCategoryId, newOrder.map(q => q.id))
      } else {
        await moveQuestion(numericQId, { newCategoryId: targetCategoryId, newPriority: targetPriority })
      }
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDraggedQuestionId(null)
      setDragOverTarget(null)
    }
  }, [effectiveReadOnly, selectedCategoryId, selectedCategory, load])


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

  const questionsLimit = questionnaire?.questionsLimit || 6
  const gridCols = questionsLimit <= 4 ? questionsLimit : Math.ceil(questionsLimit / 2)
  const canAddQuestion = canEdit && flat.length < questionsLimit
  const addSlotIndex = Math.min(flat.length, questionsLimit - 1)
  
  const slots = useMemo(() => {
    const out = []
    for (let i = 0; i < questionsLimit; i++) out.push(flat[i] || null)
    return out
  }, [flat, questionsLimit])

  // Calculate score for teacher view
  const studentScore = useMemo(() => {
    if (!questionnaire || !Array.isArray(questionnaire.categories)) {
      return null
    }
    let total = 0
    for (const cat of questionnaire.categories) {
      let catScore = 0
      let catCeilings = []
      
      // On trie les questions par priorité car l'ordre influe sur le calcul (ex: coefficients)
      const sortedQuestions = [...(cat.questions || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0))
      
      for (const q of sortedQuestions) {
        const answer = collectedAnswers[q.id]
        if (answer === undefined || answer === null) continue
        
        // Gestion des réponses uniques ou multiples
        const selectedIds = Array.isArray(answer) ? answer.map(String) : [String(answer)]
        
        // On trie aussi les éléments par priorité au sein de la question
        const sortedElements = [...(q.elements || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0))
        
        for (const el of sortedElements) {
          if (selectedIds.includes(String(el.id))) {
            const type = Number(el.evaluatingType || 0)
            const val = Number(el.evaluatingValue || 0)
            
            if (type === 1) catScore += val // Ajoute
            else if (type === 2) catScore -= val // Enlève
            else if (type === 3) catScore *= val // Coefficient
            else if (type === 5) catCeilings.push(val) // Plafond
          }
        }
      }
      
      if (cat.currentNote && Number(cat.currentNote) > 0) {
        catCeilings.push(Number(cat.currentNote))
      }

      // Application du plafond le plus restrictif si activé
      if (catCeilings.length > 0) {
        catScore = Math.min(catScore, Math.min(...catCeilings))
      }
      
      total += catScore
    }
    return total
  }, [collectedAnswers, questionnaire])

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

  const renderStudentsSidebar = () => (
    <Box sx={{ 
      width: 280, 
      bgcolor: 'background.paper', 
      borderRight: '1px solid rgba(0,0,0,0.06)', 
      display: 'flex', 
      flexDirection: 'column',
      p: 2,
      gap: 2
    }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
        Étudiants de la session
      </Typography>
      
      <Box sx={{ 
        flex: 1, 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.05)', borderRadius: '10px' }
      }}>
        {visibleStudents.length > 0 ? visibleStudents.map((s) => (
          <Button
            key={s.studentId}
            onClick={() => setSelectedStudentId(s.studentId)}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              borderRadius: '100px',
              py: 1.5,
              px: 2,
              textAlign: 'left',
              bgcolor: selectedStudentId === s.studentId ? 'rgba(97, 103, 189, 0.12)' : 'transparent',
              color: selectedStudentId === s.studentId ? 'primary.main' : 'text.primary',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
              position: 'relative'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Avatar sx={{ 
                width: 32, 
                height: 32, 
                fontSize: 14, 
                bgcolor: selectedStudentId === s.studentId ? 'primary.main' : 'rgba(0,0,0,0.08)',
                color: selectedStudentId === s.studentId ? 'white' : 'text.secondary'
              }}>
                {(s.studentNom?.[0] || '') + (s.studentPrenom?.[0] || '')}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14, fontWeight: selectedStudentId === s.studentId ? 700 : 500 }}>
                  {s.studentNom} {s.studentPrenom}
                </Typography>
                <Typography noWrap sx={{ fontSize: 11, opacity: 0.7 }}>
                  {s.juryName}
                </Typography>
              </Box>
                    {evaluatedStudentIds.has(s.studentId) && (
                      <CheckCircleIcon sx={{ ml: 'auto', fontSize: 18, color: 'success.main', opacity: 0.8 }} />
                    )}
            </Box>
          </Button>
        )) : (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center', mt: 4, fontStyle: 'italic' }}>
            Aucun étudiant à évaluer dans cette session.
          </Typography>
        )}
      </Box>
    </Box>
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
          centerActions={(canEdit || studentScore !== null) ? (
              <Paper 
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  p: 0.75,
                  px: (studentScore !== null) ? 2 : 0.75,
                  borderRadius: 4,
                  bgcolor: 'background.paper',
                  border: '1px solid rgba(0,0,0,0.10)',
                  boxShadow: 'none',
                }}
              >
                {studentScore !== null && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.25, 
                    mr: canEdit ? 1 : 0, 
                    pr: canEdit ? 1 : 0, 
                    borderRight: canEdit ? '1px solid rgba(0,0,0,0.1)' : 'none' 
                  }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Note</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{`${studentScore} / ${questionnaire?.maxScore ?? 20}`}</Typography>
                  </Box>
                )}
            {!canEdit && selectedStudentId && (
              <Button 
                variant="contained" 
                startIcon={<SaveIcon />} 
                onClick={saveSubmission} 
                disableElevation
                sx={{ borderRadius: 100, textTransform: 'none', px: 3, ml: 1, fontWeight: 700 }}
              >
                Terminer
              </Button>
            )}
                {canEdit && (
                  <Tooltip title="Aperçu enseignant">
                    <IconButton size="small" disabled={!selectedCategoryId} onClick={() => openPreview('teacher')} sx={{ width: 36, height: 36 }}>
                      <CoPresentIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
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
                  borderRadius: 3,
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
          hideDashboardLink={effectiveReadOnly || !!rightActions}
        />
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0, flex: 1, pt: '76px', minHeight: 0, position: 'relative' }}>
          {/* Left Sidebar - Students List (MD3 Style) */}
          {!canEdit && (viewerMode === 'teacher' || propShowStudentsSidebar) && renderStudentsSidebar()}

          {/* Center - questions grid */}
          <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Overlay de blocage si aucun étudiant n'est sélectionné en mode évaluation */}
            {(previewMode === 'teacher' || (!canEdit && viewerMode === 'teacher')) && !selectedStudentId && (
              <Box sx={{ 
                position: 'absolute', 
                inset: 0, 
                bgcolor: 'rgba(252, 252, 253, 0.8)', 
                backdropFilter: 'blur(4px)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4
              }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 4, 
                    borderRadius: '28px', 
                    textAlign: 'center', 
                    maxWidth: 400, 
                    border: '1px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.05)'
                  }}
                >
                  <SchoolIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Prêt pour l'évaluation ?</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                    Veuillez sélectionner un étudiant dans la liste de gauche pour commencer à remplir le questionnaire.
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Navigation Arrows - Fixed and Centered in margins */}
            <Tooltip title="Catégorie précédente">
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
                onDragOver={(e) => { 
                  if (canEdit && e.dataTransfer.types.includes('text/question-id')) e.preventDefault(); 
                }}
                onDrop={(e) => {
                  const targetCatId = pages[Math.max(0, selectedPageIndex - 1)]?.id;
                  const qId = e.dataTransfer.getData('text/question-id');
                  if (targetCatId && qId) handleQuestionDrop(qId, targetCatId);
                }}
                sx={{
                  position: 'fixed',
                  left: '20px',
                  top: '55%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'background.paper',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: 'none',
                  zIndex: 10, // Très bas pour passer sous les paramètres
                  p: 2.5,
                  '&:hover': { bgcolor: '#fff', transform: 'translateY(-50%) scale(1.1)' },
                  '&.Mui-disabled': { opacity: 0.1 }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Catégorie suivante">
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
                onDragOver={(e) => { 
                  if (canEdit && e.dataTransfer.types.includes('text/question-id')) e.preventDefault(); 
                }}
                onDrop={(e) => {
                  const targetCatId = pages[Math.min(pages.length - 1, selectedPageIndex + 1)]?.id;
                  const qId = e.dataTransfer.getData('text/question-id');
                  if (targetCatId && qId) handleQuestionDrop(qId, targetCatId);
                }}
                sx={{
                  position: 'fixed',
                  right: '20px',
                  top: '55%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'background.paper',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: 'none',
                  zIndex: 10, // Très bas pour passer sous les paramètres
                  p: 2.5,
                  '&:hover': { bgcolor: '#fff', transform: 'translateY(-50%) scale(1.1)' },
                  '&.Mui-disabled': { opacity: 0.1 }
                }}
              >
                <ArrowForwardIcon />
              </IconButton>
            </Tooltip>

            {error && (
              <Box sx={{ px: 2, pt: 1 }}>
                <Typography color="error" sx={{ fontSize: 13 }}>{error}</Typography>
              </Box>
            )}

            {/* 2 lignes x 3 colonnes (6 slots) */}
            <Box
              sx={{
                p: 0.75,
                px: { xs: 2, sm: 15 }, // Marge de 120px pour laisser respirer les flèches
                width: '100%',
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: `repeat(${gridCols}, 1fr)` },
                justifyContent: 'center',
                alignItems: 'stretch',
                position: 'relative',
              }}
            >
              {slots.map((p, i) => (
                <Box 
                  key={p ? p.question.id : `slot-${i}`} 
                  draggable={canEdit && !!p}
                  onDragStart={(e) => {
                    if (canEdit && p) {
                      setDraggedQuestionId(p.question.id);
                      e.dataTransfer.setData('text/question-id', p.question.id.toString());
                      e.dataTransfer.effectAllowed = 'move';
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedQuestionId(null);
                    setDragOverTarget(null);
                  }}
                  onDragOver={(e) => {
                    if (canEdit && e.dataTransfer.types.includes('text/question-id')) { e.preventDefault(); setDragOverTarget(i); }
                  }}
                  onDragLeave={() => setDragOverTarget(null)}
                  onDrop={(e) => {
                    const qId = e.dataTransfer.getData('text/question-id');
                    handleQuestionDrop(qId, selectedCategoryId, i);
                  }}
                  sx={{ minHeight: 210, height: '100%', '& .MuiCard-root': { height: '100%', outline: (dragOverTarget === i && draggedQuestionId) ? '2px dashed #6167bd' : 'none' } }}
                >
                  {p ? (
                    <QuestionComponent data={p.question} category={p.category} questionnaireId={effectiveQuestionnaireId} index={i + 1} onRefresh={load} readOnly={!canEdit} onAnswerChange={handleAnswerChange} externalAnswer={collectedAnswers && (collectedAnswers[p.question.id] || collectedAnswers[`ans_q${p.question.id}`])} />
                  ) : (canAddQuestion && i === addSlotIndex) ? (
                    <Box
                      onClick={() => addQuestionToCategory(selectedCategoryId)}
                      sx={{
                        border: '1px dashed rgba(0,0,0,0.12)',
                        borderRadius: 3,
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
                borderRadius: 50, // Use 50 for a perfect circle with width/height 52
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
              borderRadius: 50, // Use 50 for a perfect circle with width/height 52
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
            borderRadius: '28px 0 0 28px', // Material 3 Standard
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
            {/* Session Selector */}
            <FormControl fullWidth size="small">
              <InputLabel id="session-select-label">Session sélectionnée</InputLabel>
              <Select
                labelId="session-select-label"
                label="Session sélectionnée"
                value={selectedSessionId || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
              >
                {sessionDetails.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name} {s.active ? '• Ouverte' : '• Fermée'}</MenuItem>
                ))}
                {sessionDetails.length === 0 && <MenuItem disabled>Aucune session disponible</MenuItem>}
              </Select>
            </FormControl>

            <Divider />

            {/* Manage Sessions Button */}
            {isAdmin && (
              <Button
                variant="outlined"
                fullWidth
                onClick={openSessionsDialog}
                startIcon={<SettingsIcon />}
                sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600, py: 1.2 }}
              >
                Gérer les participants & sessions
              </Button>
            )}

            <Divider />

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
              inputProps={{ min: 0, step: "any" }}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />

            <FormControl fullWidth size="small">
              <InputLabel id="questionnaire-grading-mode-label">Type de note global</InputLabel>
              <Select
                labelId="questionnaire-grading-mode-label"
                label="Type de note global"
                value={questionnaire?.gradingMode || 'points'}
                onChange={(event) => updateQuestionnaireSettings({ gradingMode: event.target.value })}
                MenuProps={{
                  slotProps: {
                    paper: {
                      sx: {
                        borderRadius: '20px',
                        mt: 1,
                        p: 0.4,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                      }
                    }
                  },
                  MenuListProps: { sx: { py: 0.5 } }
                }}
              >
                <MenuItem value="points" sx={{ borderRadius: '100px', mx: 0.5, mb: 0.4, py: 0.8, px: 1.5 }}>Points</MenuItem>
                <MenuItem value="coefficient" sx={{ borderRadius: '100px', mx: 0.5, mb: 0.4, py: 0.8, px: 1.5 }}>Coefficients</MenuItem>
                <MenuItem value="percentage" sx={{ borderRadius: '100px', mx: 0.5, py: 0.8, px: 1.5 }}>Pourcentage</MenuItem>
              </Select>
            </FormControl>

            {isAdmin && selectedCategory && (
              <>
                <Divider sx={{ my: 1 }} />
                {(() => {
                  const otherCeilingsSum = (questionnaire?.categories || [])
                    .filter(c => c.id !== selectedCategoryId)
                    .reduce((sum, cat) => sum + Number(cat.currentNote || 0), 0);
                  const maxScoreValue = Number(questionnaire?.maxScore || 20);
                  const maxAllowed = Math.max(0, maxScoreValue - otherCeilingsSum);
                  const currentVal = Number(selectedCategory.currentNote || 0);

                  return (
                    <>
                      <Typography sx={{ px: 2, mb: 1.5, fontSize: 10, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                        Plafond de points ({selectedCategory.title})
                      </Typography>
                      <Box sx={{ px: 2, pb: 1 }}>
                        <TextField
                          label="Limite pour cette catégorie"
                          type="number"
                          size="small"
                          value={selectedCategory.currentNote ?? 0}
                          onChange={(e) => {
                            const raw = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const val = Math.min(raw, maxAllowed);
                            setQuestionnaire(prev => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                categories: prev.categories.map(c => 
                                  c.id === selectedCategoryId ? { ...c, currentNote: val } : c
                                )
                              };
                            });
                          }}
                          onBlur={(e) => {
                            const raw = parseFloat(e.target.value) || 0;
                            const val = Math.min(raw, maxAllowed);
                            updateCategoryApi(selectedCategoryId, { currentNote: val });
                          }}
                          inputProps={{ step: "any", min: 0, max: maxAllowed }}
                          fullWidth
                          helperText={
                            maxAllowed === 0 
                            ? "Budget épuisé par les autres catégories."
                            : currentVal >= maxAllowed && maxScoreValue > 0 && questionnaire?.categories?.length > 1
                              ? `Limite de budget atteinte (${maxAllowed} pts restants)`
                              : `Budget max pour cette catégorie : ${maxAllowed}`
                          }
                          error={maxAllowed === 0}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                        />
                      </Box>
                    </>
                  );
                })()}
              </>
            )}

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
          </Stack>
        </Box>
      </Drawer>
      <SessionsManagementDialog
        open={sessionsDialogOpen}
        onClose={() => setSessionsDialogOpen(false)}
        sessions={sessionDetails}
        availableTeachers={availableTeachers}
        availableStudents={availableStudents}
        availableJuries={availableJuries}
        onAddSession={addSession}
        onUpdateSession={updateSessionDetails}
        onDeleteSession={removeSessionDetails}
        onAddJury={addJuryToSessionUI}
        onRemoveJury={removeJuryFromSessionUI}
        onAddStudent={addStudentToSessionUI}
        onRemoveStudent={removeStudentFromSessionUI}
        onAddJuryMaster={addJuryMasterUI}
      />
      <Dialog
        fullScreen
        open={!!previewMode}
        onClose={() => setPreviewMode(null)}
        TransitionComponent={Transition}
        PaperProps={{ sx: { bgcolor: 'background.default', borderRadius: 7 } }}
      >

        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box>
            <TopAppBar
              pages={pages}
              selectedPage={selectedPageIndex}
              onSelectPage={selectPage}
              title={questionnaire?.title}
              onTitleChange={undefined}
              onAddCategory={undefined}
              date={questionnaire?.date}
              onDateChange={undefined}
              centerActions={previewMode === 'teacher' ? (
                  <Paper 
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 0.75,
                      px: 2,
                      borderRadius: 4,
                      bgcolor: 'background.paper',
                      border: '1px solid rgba(0,0,0,0.10)',
                      boxShadow: 'none',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Note</Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{`${studentScore ?? '—'} / ${questionnaire?.maxScore ?? 20}`}</Typography>
                    </Box>
                    {selectedStudentId && (
                      <Tooltip title="Enregistrer la note">
                        <IconButton onClick={saveSubmission} color="primary" sx={{ width: 36, height: 36 }}><SaveIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Paper>
                ) : null}
              rightActions={<IconButton size="small" onClick={() => setPreviewMode(null)}><CloseIcon fontSize="small" /></IconButton>}
              hideDashboardLink={true}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0, flex: 1, pt: '76px', minHeight: 0, position: 'relative' }}>
            {previewMode === 'teacher' && renderStudentsSidebar()}
            
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
                  gridTemplateColumns: { xs: '1fr', sm: `repeat(${gridCols}, minmax(0, 1fr))` },
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
                    border: '1px solid rgba(0,0,0,0.08)', // Keep as is
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
                    border: '1px solid rgba(0,0,0,0.08)', // Keep as is
                    zIndex: 1200,
                    p: 2
                  }}
                >
                  <ArrowForwardIcon />
                </IconButton>

                {slots.map((p, i) => (
                  <Box key={p ? p.question.id : `slot-${i}`} sx={{ minHeight: 210, height: '100%' }}>
                    {p ? (
                      <QuestionComponent data={p.question} category={p.category} questionnaireId={effectiveQuestionnaireId} index={i + 1} onRefresh={load} readOnly={true} onAnswerChange={handleAnswerChange} /> // QuestionComponent handles its own style
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

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '12px', fontWeight: 600 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )

}
