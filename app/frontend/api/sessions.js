import { apiJson } from './http.js'

export function createSession(questionnaireId, { name, date }) {
  return apiJson(`/api/questionnaires/${questionnaireId}/sessions`, {
    method: 'POST',
    json: { name, date }
  })
}

export function getQuestionnaireSessions(questionnaireId) {
  return apiJson(`/api/questionnaires/${questionnaireId}/sessions`)
}

export function getSessionDetails(sessionId) {
  return apiJson(`/api/sessions/${sessionId}`)
}

export function updateSession(sessionId, payload) {
  const { name, date, active } = payload
  return apiJson(`/api/sessions/${sessionId}`, {
    method: 'PUT',
    json: { 
      name: name !== undefined ? name : undefined,
      date: date !== undefined ? date : undefined,
      active: active !== undefined ? active : undefined
    }
  })
}

export function deleteSession(sessionId) {
  return apiJson(`/api/sessions/${sessionId}`, {
    method: 'DELETE'
  })
}

// Session jury management
export function addJuryToSession(sessionId, { juryId, teacherId }) {
  return apiJson(`/api/sessions/${sessionId}/juries`, {
    method: 'POST',
    json: { juryId, teacherId }
  })
}

export function removeJuryFromSession(sessionJuryId) {
  return apiJson(`/api/session-juries/${sessionJuryId}`, {
    method: 'DELETE'
  })
}

// Session student management
export function addStudentToSession(sessionId, { studentId, juryId }) {
  return apiJson(`/api/sessions/${sessionId}/students`, {
    method: 'POST',
    json: { studentId, juryId }
  })
}

export function removeStudentFromSession(sessionStudentId) {
  return apiJson(`/api/session-students/${sessionStudentId}`, {
    method: 'DELETE'
  })
}

export function updateSessionStudentJury(sessionStudentId, juryId) {
  return apiJson(`/api/session-students/${sessionStudentId}`, {
    method: 'PATCH',
    json: { juryId }
  })
}
