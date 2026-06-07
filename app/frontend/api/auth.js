import { apiJson } from './http.js'

export function login({ email, password, role }) {
  return apiJson('/api/auth/login', {
    method: 'POST',
    json: { email, password, role },
    skipAuth: true,
    skipAuthRedirect: true,
  })
}
