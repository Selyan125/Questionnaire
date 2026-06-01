import { apiJson } from './http.js'

export function getStats() {
  return apiJson('/api/stats')
}
