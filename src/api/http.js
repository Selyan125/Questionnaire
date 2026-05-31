// Centralized frontend API client
// - attaches Bearer token when present
// - optionally JSON-encodes request bodies
// - auto-logout + redirect on 401/403 (default)

export function getAuthToken() {
  try {
    return localStorage.getItem('authToken')
  } catch {
    return null
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
  } catch {
    // ignore
  }
}

/**
 * @param {RequestInfo | URL} input
 * @param {RequestInit & { json?: any, skipAuth?: boolean, skipAuthRedirect?: boolean }} init
 */
export async function apiFetch(input, init = {}) {
  const { json, skipAuth, skipAuthRedirect, ...rest } = init

  const nextInit = { ...rest }
  const headers = new Headers(nextInit.headers || {})

  if (json !== undefined) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    nextInit.body = JSON.stringify(json)
  }

  if (!skipAuth) {
    const hasAuth = headers.has('Authorization') || headers.has('authorization')
    if (!hasAuth) {
      const token = getAuthToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }
  }

  nextInit.headers = headers

  const resp = await fetch(input, nextInit)

  if (!skipAuthRedirect && (resp.status === 401 || resp.status === 403)) {
    clearAuth()
    if (typeof window !== 'undefined') window.location.href = '/login'
  }

  return resp
}

export async function apiJson(input, init = {}) {
  const resp = await apiFetch(input, init)
  let data = null
  try {
    data = await resp.json()
  } catch {
    data = null
  }

  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || `Erreur serveur (${resp.status})`
    const err = new Error(msg)
    err.status = resp.status
    err.data = data
    throw err
  }

  return data
}
