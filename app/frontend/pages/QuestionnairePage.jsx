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
  // Always teacher mode now
  const effectiveViewerMode = useMemo(() => {
    return 'teacher'
  }, [propViewerMode, location.pathname])

  // Never infer teacher features from the authenticated user for this wrapper.
  // The page owner (route) must decide which mode is rendered.
  const showStudentsSidebar = typeof propShowStudentsSidebar !== 'undefined'
    ? !!propShowStudentsSidebar // If explicitly set, use it
    : true // Always show for teacher mode

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
