import { apiJson } from './http.js'

export function updateQuestionTitle(questionId, { title }) {
  return apiJson(`/api/questions/${questionId}`, {
    method: 'PUT',
    json: { title },
  })
}

export function deleteQuestion(questionId) {
  return apiJson(`/api/questions/${questionId}`, { method: 'DELETE' })
}

export function addElement(questionId, payload) {
  return apiJson(`/api/questions/${questionId}/elements`, {
    method: 'POST',
    json: payload,
  })
}

export function updateElement(elementId, payload) {
  return apiJson(`/api/elements/${elementId}`, {
    method: 'PUT',
    json: payload,
  })
}

export function deleteElement(elementId) {
  return apiJson(`/api/elements/${elementId}`, { method: 'DELETE' })
}
