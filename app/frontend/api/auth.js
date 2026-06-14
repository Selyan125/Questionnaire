import { apiJson } from './http.js'

export function login({ email, password }) {
  return apiJson('/api/auth/login', {
    method: 'POST',
    json: { email, password },
    skipAuth: true,
    skipAuthRedirect: true,
  })
}
