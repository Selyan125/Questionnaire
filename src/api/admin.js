import { apiJson } from './http.js'

export function importUsers({ targetRole, users }) {
  return apiJson('/api/admin/import', {
    method: 'POST',
    json: { targetRole, users },
  })
}
