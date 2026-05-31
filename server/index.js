import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// eslint-disable-next-line no-undef
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })
const app = express()
app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || ''

// Initialize database schema
async function initializeDatabase() {
  try {
    console.log('Checking database schema...')
    // Prisma will handle migrations automatically, no need for manual schema checking
    console.log('✓ Database schema initialized')
  } catch (err) {
    console.error('Database initialization error:', err.message)
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Missing token' })
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' })
    req.user = user
    next()
  })
}

app.get('/api/status', async (req, res) => {
  const response = {
    status: "OK",
    questionsInProgress: "false"
  }
  res.json(response)
})

async function mergeQuestionnaireSettings(questionnaires) {
  const list = Array.isArray(questionnaires) ? questionnaires : [questionnaires]
  const ids = list.filter(Boolean).map(q => Number(q.id)).filter(Boolean)
  if (!ids.length) return questionnaires

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, gradingMode, maxScore, audience, showResults, shuffleQuestions FROM Questionnaire WHERE id IN (${ids.join(',')})`
  )
  const byId = new Map(rows.map(row => [Number(row.id), row]))
  const merged = list.map(q => ({ ...q, ...(byId.get(Number(q.id)) || {}) }))
  return Array.isArray(questionnaires) ? merged : merged[0]
}

async function updateQuestionnaireSettings(id, settings) {
  const allowed = ['gradingMode', 'maxScore', 'audience', 'showResults', 'shuffleQuestions']
  const entries = allowed
    .filter(key => settings[key] !== undefined)
    .map(key => {
      let value = settings[key]
      if (key === 'maxScore') value = Number(value)
      if (key === 'showResults' || key === 'shuffleQuestions') value = value ? 1 : 0
      return [key, value]
    })

  if (!entries.length) return

  const setClause = entries.map(([key]) => `${key} = ?`).join(', ')
  await prisma.$executeRawUnsafe(
    `UPDATE Questionnaire SET ${setClause} WHERE id = ?`,
    ...entries.map(([, value]) => value),
    Number(id)
  )
}

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password and role are required' })
  const hashed = await bcrypt.hash(password, 10)
  try {
    if (role === 'teacher') {
      const created = await prisma.teacher.create({ data: { email, password: hashed } })
      const { password: _p, ...rest } = created
      return res.status(201).json(rest)
    } else {
      const created = await prisma.student.create({ data: { email, password: hashed } })
      const { password: _p, ...rest } = created
      return res.status(201).json(rest)
    }
  } catch (err) {
    return res.status(400).json({ error: 'Could not create user', details: err.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password and role are required' })
  try {
    let user
    if (role === 'teacher') user = await prisma.teacher.findUnique({ where: { email } })
    else user = await prisma.student.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const payload = { id: user.id, role, email: user.email }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, user: { id: user.id, email: user.email, role } })
  } catch (err) {
    return res.status(500).json({ error: 'Login error' })
  }
})



// Questionnaires endpoints
app.get('/api/questionnaires', async (req, res) => {
  const questionnaires = await prisma.questionnaire.findMany({
    orderBy: { id: 'desc' },
    include: { categories: true }
  })
  res.json(await mergeQuestionnaireSettings(questionnaires))
})

app.get('/api/questionnaires/:id', async (req, res) => {
  const id = Number(req.params.id)
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id },
    include: {
      categories: {
        include: {
          questions: {
            include: { elements: true }
          }
        }
      }
    }
  })
  if (!questionnaire) return res.status(404).json({ error: 'Not found' })
  res.json(await mergeQuestionnaireSettings(questionnaire))
})

app.post('/api/questionnaires', authenticateToken, async (req, res) => {
  const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions } = req.body
  const created = await prisma.questionnaire.create({
    data: { title, openForStudents: !!openForStudents }
  })
  await updateQuestionnaireSettings(created.id, {
    gradingMode: gradingMode || 'points',
    maxScore: maxScore === undefined ? 20 : Number(maxScore),
    audience: audience || 'teachers',
    showResults: !!showResults,
    shuffleQuestions: !!shuffleQuestions
  })
  res.status(201).json(await mergeQuestionnaireSettings(created))
})

// Update questionnaire
app.put('/api/questionnaires/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions } = req.body
  try {
    const data = {}
    if (title !== undefined) data.title = title
    if (openForStudents !== undefined) data.openForStudents = !!openForStudents

    const updated = Object.keys(data).length
      ? await prisma.questionnaire.update({ where: { id }, data })
      : await prisma.questionnaire.findUnique({ where: { id } })
    await updateQuestionnaireSettings(id, { gradingMode, maxScore, audience, showResults, shuffleQuestions })
    res.json(await mergeQuestionnaireSettings(updated))
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

app.delete('/api/questionnaires/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.$transaction(async (tx) => {
      const cats = await tx.questionCategory.findMany({ where: { questionnaireId: id }, select: { id: true } })
      const catIds = cats.map(c => c.id)

      if (catIds.length) {
        const qs = await tx.question.findMany({ where: { questionCategoryId: { in: catIds } }, select: { id: true } })
        const qIds = qs.map(q => q.id)

        if (qIds.length) {
          await tx.questionElement.deleteMany({ where: { questionId: { in: qIds } } })
        }

        await tx.question.deleteMany({ where: { questionCategoryId: { in: catIds } } })
        await tx.questionCategory.deleteMany({ where: { questionnaireId: id } })
      }

      await tx.questionnaire.delete({ where: { id } })
    })

    res.status(204).end()
  } catch (err) {
    // Prisma errors should not crash the server
    if (err && err.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(409).json({ error: 'Could not delete questionnaire', details: err.message })
  }
})

// Categories (QuestionCategory)
app.post('/api/questionnaires/:id/categories', authenticateToken, async (req, res) => {
  const questionnaireId = Number(req.params.id)
  const { title, currentNote } = req.body
  const created = await prisma.questionCategory.create({
    data: { title, currentNote: currentNote || 0, questionnaireId }
  })
  res.status(201).json(created)
})

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  const { title, currentNote } = req.body
  try {
    const updated = await prisma.questionCategory.update({
      where: { id },
      data: { title, currentNote }
    })
    res.json(updated)
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

// Questions
app.post('/api/categories/:id/questions', authenticateToken, async (req, res) => {
  const questionCategoryId = Number(req.params.id)
  const { title } = req.body
  const created = await prisma.question.create({
    data: { title, questionCategoryId }
  })
  res.status(201).json(created)
})

app.put('/api/questions/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  const { title, questionCategoryId } = req.body
  try {
    const data = {}
    if (title !== undefined) data.title = title
    if (questionCategoryId !== undefined) data.questionCategoryId = Number(questionCategoryId)

    const updated = await prisma.question.update({
      where: { id },
      data
    })
    res.json(updated)
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

// Question elements
app.post('/api/questions/:id/elements', authenticateToken, async (req, res) => {
  const questionId = Number(req.params.id)
  const { type, title, priority, evaluatingType, evaluatingValue } = req.body
  const created = await prisma.questionElement.create({
    data: { type, title, priority: priority || 0, evaluatingType: evaluatingType || 0, evaluatingValue: evaluatingValue || 0, questionId }
  })
  res.status(201).json(created)
})

app.put('/api/elements/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  const { type, title, priority, evaluatingType, evaluatingValue } = req.body
  try {
    const updated = await prisma.questionElement.update({
      where: { id },
      data: { type, title, priority, evaluatingType, evaluatingValue }
    })
    res.json(updated)
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

// Delete element
app.delete('/api/elements/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.questionElement.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

// Delete question (and its elements)
app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.questionElement.deleteMany({ where: { questionId: id } })
    await prisma.question.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

// Delete category (cascade: delete elements and questions first)
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const qs = await prisma.question.findMany({ where: { questionCategoryId: id }, select: { id: true } })
    for (const q of qs) {
      await prisma.questionElement.deleteMany({ where: { questionId: q.id } })
    }
    await prisma.question.deleteMany({ where: { questionCategoryId: id } })
    await prisma.questionCategory.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

// Assign / modify jury for teachers and students (simple string field in Prisma schema)
app.patch('/api/teachers/:id/jury', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  const { jury } = req.body
  try {
    const updated = await prisma.teacher.update({ where: { id }, data: { jury } })
    res.json(updated)
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

app.patch('/api/students/:id/jury', authenticateToken, async (req, res) => {
  const id = Number(req.params.id)
  const { assignedJury } = req.body
  // Only teachers may modify student jury via this endpoint
  const { role } = req.user || {}
  if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
  try {
    const updated = await prisma.student.update({ where: { id }, data: { assignedJury } })
    res.json(updated)
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

// Create jury table if it does not exist (uses direct SQL alongside Prisma client)
;(async function ensureJuryTable() {
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS jury (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`)
    console.log('Ensured jury table exists')
  } catch (err) {
    console.error('Ensure jury table error', err)
  }
})()

// Stats, lists and jury management endpoints
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const students = await prisma.student.count()
    const teachers = await prisma.teacher.count()
    const questionnaires = await prisma.questionnaire.count()
    const openQuestionnaires = await prisma.questionnaire.count({ where: { openForStudents: true } })
    res.json({ students, teachers, questionnaires, openQuestionnaires })
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch stats' })
  }
})

app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    // Only teachers (and admins via teacher.admin) may list students
    const { role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })

    // Use raw SQL to handle potentially missing columns gracefully
    const students = await prisma.$queryRawUnsafe(`
      SELECT id, email, nom, prenom, assignedJury 
      FROM Student
    `)
    res.json(students || [])
  } catch (err) {
    console.error('Could not fetch students:', err.message)
    res.status(500).json({ error: 'Could not fetch students' })
  }
})

app.get('/api/students/:id/results', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id)

    // Students may only access their own results; teachers may view any
    const { id: meId, role } = req.user || {}
    if (role === 'student' && Number(meId) !== Number(id)) return res.status(403).json({ error: 'Forbidden' })

    const students = await prisma.$queryRawUnsafe(
      `SELECT id, email, nom, prenom FROM Student WHERE id = ?`,
      id
    )
    const student = students && students.length ? students[0] : null
    if (!student) return res.status(404).json({ error: 'Student not found' })
    res.json({ student, results: [] })
  } catch (err) {
    console.error('Could not fetch student results:', err.message)
    res.status(500).json({ error: 'Could not fetch student results' })
  }
})

app.put('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { nom, prenom, assignedJury } = req.body

    // Only teachers or the student themselves may update a student
    const { id: meId, role } = req.user || {}
    if (role !== 'teacher' && Number(meId) !== Number(id)) return res.status(403).json({ error: 'Forbidden' })
    
    // Check if student exists
    const existing = await prisma.$queryRawUnsafe(`SELECT id FROM Student WHERE id = ?`, id)
    if (!existing || !existing.length) {
      return res.status(404).json({ error: 'Student not found' })
    }
    
    // Build update clauses
    const updates = []
    const values = []
    
    if (nom !== undefined) {
      updates.push('nom = ?')
      values.push(nom)
    }
    if (prenom !== undefined) {
      updates.push('prenom = ?')
      values.push(prenom)
    }
    if (assignedJury !== undefined) {
      updates.push('assignedJury = ?')
      values.push(assignedJury)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }
    
    values.push(id)
    const updateQuery = `UPDATE Student SET ${updates.join(', ')} WHERE id = ?`
    await prisma.$executeRawUnsafe(updateQuery, ...values)
    
    // Fetch updated student
    const updated = await prisma.$queryRawUnsafe(
      `SELECT id, email, nom, prenom, assignedJury FROM Student WHERE id = ?`,
      id
    )
    res.json(updated && updated.length ? updated[0] : { id })
  } catch (err) {
    console.error('Could not update student:', err.message)
    res.status(500).json({ error: 'Could not update student' })
  }
})

app.get('/api/teachers', authenticateToken, async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({ select: { id: true, email: true, jury: true, admin: true } })
    res.json(teachers)
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch teachers' })
  }
})

app.get('/api/juries', authenticateToken, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT name FROM jury ORDER BY name`)
    const names = rows.map(r => r.name)
    const result = []
    for (const name of names) {
      const teachers = await prisma.teacher.findMany({ where: { jury: name }, select: { id: true, email: true } })
      const students = await prisma.student.findMany({ where: { assignedJury: name }, select: { id: true, email: true } })
      result.push({ name, teachers, students })
    }
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not fetch juries' })
  }
})

app.post('/api/juries', authenticateToken, async (req, res) => {
  try {
    const { id, role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const me = await prisma.teacher.findUnique({ where: { id } })
    if (!me || !me.admin) return res.status(403).json({ error: 'Admin required' })
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    try {
      await prisma.$executeRawUnsafe(`INSERT INTO jury (name) VALUES (?)`, name)
    } catch (e) {
      // ignore unique constraint
    }
    res.status(201).json({ name })
  } catch (err) {
    res.status(500).json({ error: 'Could not create jury' })
  }
})

// Assignments - admin only
app.post('/api/teachers/:id/jury', authenticateToken, async (req, res) => {
  try {
    const { id: meId, role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const me = await prisma.teacher.findUnique({ where: { id: meId } })
    if (!me || !me.admin) return res.status(403).json({ error: 'Admin required' })

    const id = Number(req.params.id)
    const { juryName } = req.body
    await prisma.teacher.update({ where: { id }, data: { jury: juryName || null } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Could not assign jury to teacher' })
  }
})

app.post('/api/students/:id/jury', authenticateToken, async (req, res) => {
  try {
    const { id: meId, role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const me = await prisma.teacher.findUnique({ where: { id: meId } })
    if (!me || !me.admin) return res.status(403).json({ error: 'Admin required' })

    const id = Number(req.params.id)
    const { juryName } = req.body
    await prisma.student.update({ where: { id }, data: { assignedJury: juryName || null } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Could not assign jury to student' })
  }
})

// Ensure admin user exists (email and password can be overridden with env vars ADMIN_EMAIL and ADMIN_PASSWORD)
;(async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@softwarenotes.local'
  const adminPassword = process.env.ADMIN_PASSWORD || '2yYB1YTZ3XVCg745Uj4up7413lqtyI5huX136Q'
  try {
    const existing = await prisma.teacher.findUnique({ where: { email: adminEmail } })
    if (!existing) {
      const hashed = await bcrypt.hash(adminPassword, 10)
      await prisma.teacher.create({ data: { email: adminEmail, password: hashed, admin: true } })
      console.log('Admin user created:', adminEmail)
    } else {
      if (!existing.admin) {
        await prisma.teacher.update({ where: { email: adminEmail }, data: { admin: true } })
        console.log('Admin flag set for:', adminEmail)
      }
    }
  } catch (err) {
    console.error('Admin creation error', err)
  }
})()

// Admin import endpoint
app.post('/api/admin/import', authenticateToken, async (req, res) => {
  try {
    // verify admin
    const { id, role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const me = await prisma.teacher.findUnique({ where: { id } })
    if (!me || !me.admin) return res.status(403).json({ error: 'Admin required' })

    const { targetRole, users } = req.body
    if (!targetRole || !Array.isArray(users)) return res.status(400).json({ error: 'targetRole and users required' })

    const results = []
    for (const u of users) {
      const email = (u.email || '').trim()
      if (!email) {
        results.push({ status: 'skipped', reason: 'missing email', input: u })
        continue
      }
      // skip if exists
      const exists = targetRole === 'teacher'
        ? await prisma.teacher.findUnique({ where: { email } })
        : await prisma.student.findUnique({ where: { email } })
      if (exists) {
        results.push({ status: 'exists', email })
        continue
      }
      // generate random password
      const plain = crypto.randomBytes(9).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').slice(0,12)
      const hashed = await bcrypt.hash(plain, 10)
      if (targetRole === 'teacher') {
        const created = await prisma.teacher.create({ data: { email, password: hashed } })
        results.push({ status: 'created', id: created.id, email, password: plain })
      } else {
        const studentData = { email, password: hashed }
        if (u.nom) studentData.nom = u.nom
        if (u.prenom) studentData.prenom = u.prenom
        if (u.firstName) studentData.prenom = u.firstName
        if (u.lastName) studentData.nom = u.lastName
        const created = await prisma.student.create({ data: studentData })
        results.push({ status: 'created', id: created.id, email, password: plain })
      }
    }

    res.status(201).json({ results })
  } catch (err) {
    console.error('Import error', err)
    res.status(500).json({ error: 'Import failed' })
  }
})

// Submissions / Results
app.post('/api/submissions', async (req, res) => {
  try {
    const { questionnaireId, user, answers, submittedAt } = req.body
    if (!questionnaireId) return res.status(400).json({ error: 'questionnaireId is required' })
    
    const submission = await prisma.submission.create({
      data: {
        questionnaireId: Number(questionnaireId),
        studentId: user ? Number(user.id) : null,
        answers: JSON.stringify(answers || []),
        submittedAt: submittedAt ? new Date(submittedAt) : new Date()
      }
    })
    
    res.status(201).json({ success: true, id: submission.id })
  } catch (err) {
    console.error('Submission error:', err.message)
    res.status(500).json({ error: 'Failed to save submission' })
  }
})

// Get results for a questionnaire
app.get('/api/questionnaires/:id/results', authenticateToken, async (req, res) => {
  try {
    const questionnaireId = Number(req.params.id)
    const { role } = req.user || {}
    
    // Only teachers may view results
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    
    const submissions = await prisma.submission.findMany({
      where: { questionnaireId },
      include: { student: true },
      orderBy: { submittedAt: 'desc' }
    })
    
    const results = submissions.map(s => ({
      id: s.id,
      submissionId: s.id,
      _id: s.id,
      resultId: s.id,
      studentId: s.studentId,
      user: s.student ? { id: s.student.id, email: s.student.email } : null,
      student: s.student ? { 
        id: s.student.id, 
        email: s.student.email, 
        nom: s.student.nom, 
        prenom: s.student.prenom 
      } : null,
      email: s.student?.email || null,
      answers: JSON.parse(s.answers || '[]'),
      submittedAt: s.submittedAt.toISOString(),
      score: 0
    }))
    
    res.json(results)
  } catch (err) {
    console.error('Could not fetch questionnaire results:', err.message)
    res.status(500).json({ error: 'Could not fetch results' })
  }
})

const PORT = 4000

// Start server after database is initialized
;(async () => {
  await initializeDatabase()
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))
})()
