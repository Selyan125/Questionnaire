import { apiJson } from './http.js'

export function addQuestionToCategory(categoryId, { title }) {
  return apiJson(`/api/categories/${categoryId}/questions`, {
    method: 'POST',
    json: { title },
  })
}

export function deleteCategory(categoryId) {
  return apiJson(`/api/categories/${categoryId}`, { method: 'DELETE' })
}

export function updateCategory(categoryId, { title }) {
  return apiJson(`/api/categories/${categoryId}`, {
    method: 'PUT',
    json: { title },
  })
}
