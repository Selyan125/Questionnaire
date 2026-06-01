import { apiJson } from './http.js'

export function listStudents() {
  return apiJson('/api/students')
}

export function listJuries() {
  return apiJson('/api/juries')
}

export function listTeachers() {
  return apiJson('/api/teachers')
}

export function getStudentResults(studentId) {
  return apiJson(`/api/students/${studentId}/results`)
}

export function assignStudentJury(studentId, juryName) {
  return apiJson(`/api/students/${studentId}/jury`, {
    method: 'POST',
    json: { juryName },
  }).catch(async (err) => {
    if (err && err.status === 404) {
      try {
        return apiJson(`/api/students/${studentId}`, { method: 'PUT', json: { jury: juryName } })
      } catch (e) { throw e }
    }
    throw err
  })
}

export function assignStudentTeacher(studentId, teacherId) {
  return apiJson(`/api/students/${studentId}/teacher`, {
    method: 'POST',
    json: { teacherId },
  })
}

export async function createStudent({ email, jury, teacherId, isTest } = {}) {
  try {
    const data = await apiJson('/api/admin/import', {
      method: 'POST',
      json: { targetRole: 'student', users: [{ email }], isTest },
    })
    const results = data && data.results ? data.results : []
    if (jury && Array.isArray(results)) {
      for (const r of results) {
        if (r && r.status === 'created' && r.id) {
          try { await assignStudentJury(r.id, jury) } catch (e) { /* ignore */ }
        }
      }
    }
    if (teacherId && Array.isArray(results)) {
      for (const r of results) {
        if (r && r.status === 'created' && r.id) {
          try { await assignStudentTeacher(r.id, teacherId) } catch (e) { /* ignore */ }
        }
      }
    }
    return data
  } catch (err) {
    if (err && err.status === 404) {
      try {
        const fallback = await apiJson('/api/students', { method: 'POST', json: { email, isTest } })
        if (jury && fallback && (fallback.id || fallback._id)) {
          const id = fallback.id || fallback._id
          try { await assignStudentJury(id, jury) } catch (e) { /* ignore */ }
        }
        if (teacherId && fallback && (fallback.id || fallback._id)) {
          const id = fallback.id || fallback._id
          try { await assignStudentTeacher(id, teacherId) } catch (e) { /* ignore */ }
        }
        return fallback
      } catch (e) {
        throw e
      }
    }
    throw err
  }
}

export function updateStudent(studentId, data) {
  return apiJson(`/api/students/${studentId}`, {
    method: 'PUT',
    json: data,
  })
}
