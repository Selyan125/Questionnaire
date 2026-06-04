import { apiJson } from './http.js'

export function listQuestionnaires() {
  return apiJson('/api/questionnaires')
}

export function getQuestionnaire(id) {
  return apiJson(`/api/questionnaires/${id}`)
}

export function getQuestionnaireJury(id) {
  return apiJson(`/api/questionnaires/${id}/jury`)
}

export function createQuestionnaire({ title }) {
  return apiJson('/api/questionnaires', {
    method: 'POST',
    json: { title },
  })
}

export function deleteQuestionnaire(id) {
  return apiJson(`/api/questionnaires/${id}`, { method: 'DELETE' })
}

export function updateQuestionnaire(id, patch) {
  return apiJson(`/api/questionnaires/${id}`, {
    method: 'PUT',
    json: patch,
  })
}

export function updateQuestionnaireJury(id, { teacherIds, studentIds }) {
  return apiJson(`/api/questionnaires/${id}/jury`, {
    method: 'PUT',
    json: { teacherIds, studentIds },
  })
}

export function importQuestionnaire(payload) {
  return apiJson('/api/questionnaires/import', {
    method: 'POST',
    json: payload,
  })
}

export function addCategory(questionnaireId, { title }) {
  return apiJson(`/api/questionnaires/${questionnaireId}/categories`, {
    method: 'POST',
    json: { title },
  })
}

export function submitQuestionnaire(questionnaireId, payload) {
  // single canonical submission endpoint (no fallbacks for security)
  return apiJson('/api/submissions', {
    method: 'POST',
    json: payload,
    skipAuthRedirect: true,
  })
}

export function getQuestionnaireResults(questionnaireId) {
  return apiJson(`/api/questionnaires/${questionnaireId}/results`)
}
