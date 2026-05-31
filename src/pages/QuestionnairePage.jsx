import React, { useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import QuestionManagerEditor from './QuestionManagerEditor.jsx'

export default function QuestionnairePage({
  questionnaireId,
  readOnly = true,
  rightActions,
  viewerMode: propViewerMode,
  showStudentsSidebar: propShowStudentsSidebar,
} = {}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Determine viewer mode based on route:
  // - If on /questionnaire/:id/take, it's always student view (explicit prop takes precedence)
  // - If on /questionnaire/:id directly, it's teacher view for teachers
  // - Otherwise, use the passed viewerMode prop or default to student
  const effectiveViewerMode = useMemo(() => {
    // If viewerMode is explicitly passed (e.g., from QuestionnaireTake), always use it
    if (propViewerMode) return propViewerMode
    
    // Check route: if it contains /take, it's student view
    if (location.pathname.includes('/take')) {
      return 'student'
    }
    
    // For /questionnaire/:id (without /take), check if user is a teacher
    try {
      const authUser = localStorage.getItem('authUser')
      if (authUser) {
        const user = JSON.parse(authUser)
        if (user && user.role === 'teacher') {
          return 'teacher'
        }
      }
    } catch (e) {
      // Fallback to student mode if parsing fails
    }
    return 'student'
  }, [propViewerMode, location.pathname])

  // Never infer teacher features from the authenticated user for this wrapper.
  // The page owner (route) must decide which mode is rendered.
  const showStudentsSidebar = typeof propShowStudentsSidebar !== 'undefined'
    ? !!propShowStudentsSidebar
    : effectiveViewerMode === 'teacher'

  return (
    <QuestionManagerEditor
      questionnaireId={questionnaireId || id}
      readOnly={readOnly}
      viewerMode={effectiveViewerMode}
      rightActions={rightActions ?? (
        <IconButton size="small" onClick={() => navigate('/dashboard')} sx={{ width: 36, height: 36 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
      showStudentsSidebar={showStudentsSidebar}
    />
  )
}
