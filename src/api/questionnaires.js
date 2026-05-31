import { apiJson } from './http.js'

export function listQuestionnaires() {
  return apiJson('/api/questionnaires')
}

export function getQuestionnaire(id) {
  return apiJson(`/api/questionnaires/${id}`)
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

export function addCategory(questionnaireId, { title }) {
  return apiJson(`/api/questionnaires/${questionnaireId}/categories`, {
    method: 'POST',
    json: { title },
  })
}

export function submitQuestionnaire(questionnaireId, payload) {
  // single canonical submission endpoint (no fallbacks for security)
  return apiJson('/api/submissions', { method: 'POST', json: payload })
}

export function getQuestionnaireResults(questionnaireId) {
  return apiJson(`/api/questionnaires/${questionnaireId}/results`)
}
