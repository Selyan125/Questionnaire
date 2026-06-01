import { apiJson } from './http.js'

export function listTeachers() {
  return apiJson('/api/teachers')
}

export function listJuries() {
  return apiJson('/api/juries')
}

export function assignTeacherJury(teacherId, juryName) {
  return apiJson(`/api/teachers/${teacherId}/jury`, {
    method: 'POST',
    json: { juryName },
  }).catch(async (err) => {
    // fallback: try updating teacher record directly if jury endpoint missing
    if (err && err.status === 404) {
      try {
        return apiJson(`/api/teachers/${teacherId}`, { method: 'PUT', json: { jury: juryName } })
      } catch (e) {
        throw e
      }
    }
    throw err
  })
}

export async function createTeacher({ email, jury } = {}) {
  // Try admin import first (creates user without password).
  try {
    const data = await apiJson('/api/admin/import', {
      method: 'POST',
      json: { targetRole: 'teacher', users: [{ email }] },
    })
    const results = data && data.results ? data.results : []
    if (jury && Array.isArray(results)) {
      for (const r of results) {
        if (r && r.status === 'created' && r.id) {
          try { await assignTeacherJury(r.id, jury) } catch (e) { /* ignore */ }
        }
      }
    }
    return data
  } catch (err) {
    // If admin import endpoint doesn't exist (404) fallback to legacy create
    if (err && err.status === 404) {
      try {
        const fallback = await apiJson('/api/teachers', { method: 'POST', json: { email } })
        // If jury provided, try assign (best effort)
        if (jury && fallback && (fallback.id || fallback._id)) {
          const id = fallback.id || fallback._id
          try { await assignTeacherJury(id, jury) } catch (e) { /* ignore */ }
        }
        return fallback
      } catch (e) {
        throw e
      }
    }
    throw err
  }
}
