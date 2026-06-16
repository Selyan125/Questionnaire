import { apiJson } from './http.js'

export function listTeachers() {
  return apiJson('/api/teachers')
}

export function listJuries() {
  return apiJson('/api/juries')
}

export function createJuryMaster(name) {
  return apiJson('/api/juries', { method: 'POST', json: { name } })
}

export function deleteJuryMaster(id) {
  return apiJson(`/api/juries/${id}`, { method: 'DELETE' })
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

export function resetTeacherPassword(teacherId, password) {
  return apiJson(`/api/teachers/${teacherId}/password`, {
    method: 'POST',
    json: { password },
  })
}

export async function createTeacher({ email, password, nom, prenom, jury } = {}) {
  const payload = { email, nom, prenom }
  if (password) payload.password = password
  const data = await apiJson('/api/teachers', { method: 'POST', json: payload })
  if (jury && data && data.id) {
    try {
      await assignTeacherJury(data.id, jury)
    } catch (e) {
      // ignore jury assignment failures
    }
  }
  return data
}

export function updateTeacher(id, data) {
  return apiJson(`/api/teachers/${id}`, { method: 'PUT', json: data })
}

export function deleteTeachers(ids) {
  return apiJson('/api/teachers', { method: 'DELETE', json: { ids } })
}
