import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// eslint-disable-next-line no-undef
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })
const app = express()
app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set; using generated ephemeral secret (set JWT_SECRET env for stable sessions)')
}

// Initialize database schema
async function initializeDatabase() {
  try {
    console.log('Checking database schema...')
    await ensureQuestionnaireMemberTables()
    await ensureQuestionnaireDateColumn()
    await ensureQuestionnaireJuryGroupsColumn()
    await ensureQuestionnaireSessionsColumn()
    await ensureStudentColumns()
    console.log('✓ Database schema initialized')
  } catch (err) {
    console.error('Database initialization error:', err.message)
  }
}

async function ensureQuestionnaireMemberTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS QuestionnaireJuryMember (
      questionnaireId INTEGER NOT NULL,
      teacherId INTEGER NOT NULL,
      PRIMARY KEY (questionnaireId, teacherId),
      FOREIGN KEY (questionnaireId) REFERENCES Questionnaire(id) ON DELETE CASCADE,
      FOREIGN KEY (teacherId) REFERENCES Teacher(id) ON DELETE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS QuestionnaireStudentMember (
      questionnaireId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      PRIMARY KEY (questionnaireId, studentId),
      FOREIGN KEY (questionnaireId) REFERENCES Questionnaire(id) ON DELETE CASCADE,
      FOREIGN KEY (studentId) REFERENCES Student(id) ON DELETE CASCADE
    )
  `)
}

async function ensureQuestionnaireDateColumn() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Questionnaire)`)
  const hasDate = Array.isArray(columns) && columns.some(col => col.name === 'date')
  if (!hasDate) {
    await prisma.$executeRawUnsafe(`ALTER TABLE Questionnaire ADD COLUMN date DATETIME`)
    await prisma.$executeRawUnsafe(`UPDATE Questionnaire SET date = datetime('now') WHERE date IS NULL`)
    console.log('✓ Added Questionnaire.date column')
  }
}

async function ensureQuestionnaireJuryGroupsColumn() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Questionnaire)`)
  const hasJuryGroups = Array.isArray(columns) && columns.some(col => col.name === 'juryGroups')
  if (!hasJuryGroups) {
    await prisma.$executeRawUnsafe(`ALTER TABLE Questionnaire ADD COLUMN juryGroups TEXT`)
    console.log('✓ Added Questionnaire.juryGroups column')
  }
}

async function ensureQuestionnaireSessionsColumn() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Questionnaire)`)
  const hasSessions = Array.isArray(columns) && columns.some(col => col.name === 'sessions')
  if (!hasSessions) {
    await prisma.$executeRawUnsafe(`ALTER TABLE Questionnaire ADD COLUMN sessions TEXT`)
    console.log('✓ Added Questionnaire.sessions column')
  }
}

async function ensureStudentColumns() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Student)`)
  if (!Array.isArray(columns)) return
  const hasAssignedJury = columns.some(col => col.name === 'assignedJury')
  const hasIsTest = columns.some(col => col.name === 'isTest')
  if (!hasAssignedJury) {
    await prisma.$executeRawUnsafe(`ALTER TABLE Student ADD COLUMN assignedJury TEXT`)
    console.log('✓ Added Student.assignedJury column')
  }
  if (!hasIsTest) {
    await prisma.$executeRawUnsafe(`ALTER TABLE Student ADD COLUMN isTest BOOLEAN DEFAULT 0`)
    console.log('✓ Added Student.isTest column')
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

async function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const teacher = await prisma.teacher.findUnique({ where: { id: Number(req.user.id) } })
  if (!teacher || !teacher.admin) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

app.get('/api/status', async (req, res) => {
  const response = {
    status: "OK",
    questionsInProgress: "false"
  }
  res.json(response)
})

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizeMemberEmail(member) {
  if (!member) return ''
  return normalizeEmail(member.email || member.emailAddress || member.login || '')
}

function safeParseJSON(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseSubmissionDate(value) {
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string') {
    const numeric = Number(value)
    if (!Number.isNaN(numeric) && String(numeric) === value.trim()) {
      const date = new Date(numeric)
      if (!Number.isNaN(date.getTime())) return date
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function formatSubmissionDate(value) {
  const date = parseSubmissionDate(value)
  return date ? date.toISOString() : null
}

async function mergeQuestionnaireSettings(questionnaires) {
  const list = Array.isArray(questionnaires) ? questionnaires : [questionnaires]
  const ids = list.filter(Boolean).map(q => Number(q.id)).filter(Boolean)
  if (!ids.length) return questionnaires

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, gradingMode, maxScore, audience, showResults, shuffleQuestions, juryGroups, sessions FROM Questionnaire WHERE id IN (${ids.join(',')})`
  )
  const byId = new Map(rows.map(row => [Number(row.id), row]))
  const merged = list.map(q => {
    const row = byId.get(Number(q.id)) || {}
    return {
      ...q,
      gradingMode: row.gradingMode || q.gradingMode,
      maxScore: row.maxScore === null || row.maxScore === undefined ? q.maxScore : Number(row.maxScore),
      audience: row.audience || q.audience,
      showResults: row.showResults === null || row.showResults === undefined ? q.showResults : Boolean(row.showResults),
      shuffleQuestions: row.shuffleQuestions === null || row.shuffleQuestions === undefined ? q.shuffleQuestions : Boolean(row.shuffleQuestions),
      juryGroups: safeParseJSON(row.juryGroups) || q.juryGroups,
      sessions: safeParseJSON(row.sessions) || q.sessions,
    }
  })
  return Array.isArray(questionnaires) ? merged : merged[0]
}

async function updateQuestionnaireSettings(id, settings) {
  const allowed = ['gradingMode', 'maxScore', 'audience', 'showResults', 'shuffleQuestions', 'juryGroups', 'sessions']
  const entries = allowed
    .filter(key => settings[key] !== undefined)
    .map(key => {
      let value = settings[key]
      if (key === 'maxScore') value = Number(value)
      if (key === 'showResults' || key === 'shuffleQuestions') value = value ? 1 : 0
      if (key === 'juryGroups' || key === 'sessions') {
        value = typeof value === 'string' ? value : JSON.stringify(value || [])
      }
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

async function getQuestionnaireMembers(questionnaireId) {
  await ensureQuestionnaireMemberTables()
  const teachers = await prisma.$queryRawUnsafe(
    `SELECT t.id, t.email, t.jury, t.admin
     FROM QuestionnaireJuryMember qjm
     JOIN Teacher t ON t.id = qjm.teacherId
     WHERE qjm.questionnaireId = ?
     ORDER BY t.email`,
    Number(questionnaireId)
  )
  const students = await prisma.$queryRawUnsafe(
    `SELECT s.id, s.email, s.nom, s.prenom, s.assignedJury
     FROM QuestionnaireStudentMember qsm
     JOIN Student s ON s.id = qsm.studentId
     WHERE qsm.questionnaireId = ?
     ORDER BY s.nom, s.prenom, s.email`,
    Number(questionnaireId)
  )
  return { teachers: teachers || [], students: students || [] }
}

async function replaceQuestionnaireMembers(questionnaireId, teacherIds = [], studentIds = []) {
  await ensureQuestionnaireMemberTables()
  const qid = Number(questionnaireId)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM QuestionnaireJuryMember WHERE questionnaireId = ?`, qid)
    await tx.$executeRawUnsafe(`DELETE FROM QuestionnaireStudentMember WHERE questionnaireId = ?`, qid)
    for (const teacherId of [...new Set((teacherIds || []).map(Number).filter(Boolean))]) {
      await tx.$executeRawUnsafe(
        `INSERT OR IGNORE INTO QuestionnaireJuryMember (questionnaireId, teacherId) VALUES (?, ?)`,
        qid,
        teacherId
      ) 
    }
    for (const studentId of [...new Set((studentIds || []).map(Number).filter(Boolean))]) {
      await tx.$executeRawUnsafe(
        `INSERT OR IGNORE INTO QuestionnaireStudentMember (questionnaireId, studentId) VALUES (?, ?)`,
        qid,
        studentId
      )
    }
  })
}

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  const normalizedEmail = normalizeEmail(email)
  const hashed = await argon2.hash(password)
  try {
    const created = await prisma.student.create({ data: { email: normalizedEmail, password: hashed } })
    const { password: _p, ...rest } = created
    return res.status(201).json(rest)
  } catch (err) {
    return res.status(400).json({ error: 'Could not create user', details: err.message })
  }
})

app.post('/api/admin/teachers', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, admin = false } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  const normalizedEmail = normalizeEmail(email)
  const hashed = await argon2.hash(password)
  try {
    const created = await prisma.teacher.create({ data: { email: normalizedEmail, password: hashed, admin: !!admin } })
    const { password: _p, ...rest } = created
    return res.status(201).json(rest)
  } catch (err) {
    return res.status(400).json({ error: 'Could not create teacher', details: err.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password and role are required' })
  try {
    const normalizedEmail = normalizeEmail(email)
    let user
    if (role === 'teacher') user = await prisma.teacher.findUnique({ where: { email: normalizedEmail } })
    else user = await prisma.student.findUnique({ where: { email: normalizedEmail } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await argon2.verify(user.password, password)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const payload = { id: user.id, role, email: user.email, admin: Boolean(user.admin) }
    if (role === 'student') {
      const assigned = await prisma.questionnaireStudentMember.findFirst({ where: { studentId: user.id } })
      if (assigned) payload.assignedQuestionnaireId = assigned.questionnaireId
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, user: payload })
  } catch (err) {
    console.error('Login error:', err)
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

app.get('/api/questionnaires/:id', authenticateToken, async (req, res) => {
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
  const withSettings = await mergeQuestionnaireSettings(questionnaire)

  const { role, id: meId } = req.user || {}
  if (role === 'teacher') {
    const members = await getQuestionnaireMembers(id)
    return res.json({ ...withSettings, juryMembers: members.teachers, assignedStudents: members.students })
  }

  if (role === 'student') {
    const allowed = withSettings.openForStudents || await prisma.questionnaireStudentMember.findFirst({
      where: { questionnaireId: id, studentId: Number(meId) }
    })
    if (!allowed) return res.status(403).json({ error: 'Not authorized to access this questionnaire' })
    return res.json(withSettings)
  }

  res.status(403).json({ error: 'Forbidden' })
})

app.post('/api/questionnaires', authenticateToken, async (req, res) => {
  const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions } = req.body
  const created = await prisma.questionnaire.create({
    data: {
      title,
      openForStudents: !!openForStudents,
      date: new Date()
    }
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
  const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions, date, juryGroups, sessions } = req.body
  try {
    const data = {}
    if (title !== undefined) data.title = title
    if (openForStudents !== undefined) data.openForStudents = !!openForStudents
    if (date !== undefined) {
      const parsedDate = new Date(date)
      if (!Number.isNaN(parsedDate.getTime())) data.date = parsedDate
    }
    if (juryGroups !== undefined) {
      data.juryGroups = typeof juryGroups === 'string' ? juryGroups : JSON.stringify(juryGroups)
    }
    if (sessions !== undefined) {
      data.sessions = typeof sessions === 'string' ? sessions : JSON.stringify(sessions)
    }

    const updated = Object.keys(data).length
      ? await prisma.questionnaire.update({ where: { id }, data })
      : await prisma.questionnaire.findUnique({ where: { id } })
    await updateQuestionnaireSettings(id, { gradingMode, maxScore, audience, showResults, shuffleQuestions })
    res.json(await mergeQuestionnaireSettings(updated))
  } catch (err) {
    res.status(404).json({ error: 'Not found' })
  }
})

app.get('/api/questionnaires/:id/jury', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const questionnaire = await prisma.questionnaire.findUnique({ where: { id }, select: { id: true } })
    if (!questionnaire) return res.status(404).json({ error: 'Not found' })
    res.json(await getQuestionnaireMembers(id))
  } catch (err) {
    console.error('Could not fetch questionnaire jury:', err.message)
    res.status(500).json({ error: 'Could not fetch questionnaire jury' })
  }
})

app.put('/api/questionnaires/:id/jury', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const id = Number(req.params.id)
    const { teacherIds, studentIds } = req.body
    const questionnaire = await prisma.questionnaire.findUnique({ where: { id }, select: { id: true } })
    if (!questionnaire) return res.status(404).json({ error: 'Not found' })
    await replaceQuestionnaireMembers(id, teacherIds || [], studentIds || [])
    res.json(await getQuestionnaireMembers(id))
  } catch (err) {
    console.error('Could not update questionnaire jury:', err.message)
    res.status(500).json({ error: 'Could not update questionnaire jury' })
  }
})

app.get('/api/questionnaires/:id/export', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
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

    const withSettings = await mergeQuestionnaireSettings(questionnaire)
    const members = await getQuestionnaireMembers(id)
    let submissions = []

    try {
      submissions = await prisma.submission.findMany({
        where: { questionnaireId: id },
        include: { student: true }
      })
    } catch (fallbackError) {
      console.warn('Failed to load submissions via Prisma, falling back to raw query:', fallbackError.message)
      const rows = await prisma.$queryRaw`
        SELECT s.id, s.studentId, s.answers, s.submittedAt, st.email AS studentEmail
        FROM Submission s
        LEFT JOIN Student st ON s.studentId = st.id
        WHERE s.questionnaireId = ${id}
      `
      submissions = rows.map(row => ({
        id: Number(row.id),
        questionnaireId: id,
        studentId: row.studentId === null ? null : Number(row.studentId),
        student: row.studentEmail ? { email: row.studentEmail } : null,
        answers: row.answers,
        submittedAt: row.submittedAt,
      }))
    }

    const juryGroups = Array.isArray(withSettings.juryGroups) ? withSettings.juryGroups : []
    const sessions = Array.isArray(withSettings.sessions) ? withSettings.sessions : []
    const exportJuryGroups = juryGroups.map(group => ({
      ...group,
      teacherEmails: Array.isArray(group.teacherIds)
        ? group.teacherIds.map(tid => members.teachers.find(t => Number(t.id) === Number(tid))?.email).filter(Boolean)
        : [],
      studentEmails: Array.isArray(group.studentIds)
        ? group.studentIds.map(sid => members.students.find(s => Number(s.id) === Number(sid))?.email).filter(Boolean)
        : []
    }))
    const exportSessions = sessions.map(session => ({
      ...session,
      studentEmails: Array.isArray(session.studentIds)
        ? session.studentIds.map(sid => members.students.find(s => Number(s.id) === Number(sid))?.email).filter(Boolean)
        : []
    }))
    const payload = {
      format: 'softwarenotes-questionnaire',
      version: 1,
      exportedAt: new Date().toISOString(),
      questionnaire: {
        ...withSettings,
        juryGroups: exportJuryGroups,
        sessions: exportSessions,
        juryMembers: members.teachers,
        assignedStudents: members.students,
        submissions: (submissions || []).map(s => ({
          id: s.id,
          studentEmail: s.student?.email || null,
          answers: safeParseJSON(s.answers) || [],
          submittedAt: formatSubmissionDate(s.submittedAt)
        }))
      }
    }
    res.setHeader('Content-Disposition', `attachment; filename="questionnaire-${id}.json"`)
    res.json(payload)
  } catch (err) {
    console.error('Could not export questionnaire:', err.message)
    res.status(500).json({ error: 'Could not export questionnaire' })
  }
})

app.post('/api/questionnaires/import', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const source = req.body && (req.body.questionnaire || req.body)
    if (!source || !source.title) return res.status(400).json({ error: 'questionnaire export is required' })

    const created = await prisma.$transaction(async (tx) => {
      const questionnaire = await tx.questionnaire.create({
        data: {
          title: `${source.title} (import)`,
          openForStudents: !!source.openForStudents,
          date: source.date ? new Date(source.date) : new Date()
        }
      })

      const categories = Array.isArray(source.categories) ? source.categories : []
      for (const category of categories) {
        const createdCategory = await tx.questionCategory.create({
          data: {
            title: category.title || 'Catégorie importée',
            currentNote: Number(category.currentNote || 0),
            questionnaireId: questionnaire.id
          }
        })

        for (const question of (category.questions || [])) {
          const createdQuestion = await tx.question.create({
            data: {
              title: question.title || 'Question importée',
              questionCategoryId: createdCategory.id
            }
          })

          for (const element of (question.elements || [])) {
            await tx.questionElement.create({
              data: {
                type: element.type || 'radio',
                title: element.title || 'Élément importé',
                priority: Number(element.priority || 0),
                evaluatingType: Number(element.evaluatingType || 0),
                evaluatingValue: Number(element.evaluatingValue || 0),
                questionId: createdQuestion.id
              }
            })
          }
        }
      }

      return questionnaire
    })

    const allTeacherEmails = new Set((source.juryMembers || []).map(t => normalizeEmail(t.email)).filter(Boolean))
    const allStudentEmails = new Set((source.assignedStudents || []).map(s => normalizeEmail(s.email)).filter(Boolean))

    if (Array.isArray(source.juryGroups)) {
      for (const group of source.juryGroups) {
        if (Array.isArray(group.teacherEmails)) {
          group.teacherEmails.forEach(email => {
            const normalized = normalizeEmail(email)
            if (normalized) allTeacherEmails.add(normalized)
          })
        }
        if (Array.isArray(group.studentEmails)) {
          group.studentEmails.forEach(email => {
            const normalized = normalizeEmail(email)
            if (normalized) allStudentEmails.add(normalized)
          })
        }
      }
    }

    if (Array.isArray(source.sessions)) {
      for (const session of source.sessions) {
        if (Array.isArray(session.studentEmails)) {
          session.studentEmails.forEach(email => {
            const normalized = normalizeEmail(email)
            if (normalized) allStudentEmails.add(normalized)
          })
        }
      }
    }

    const teacherEmails = Array.from(allTeacherEmails)
    const studentEmails = Array.from(allStudentEmails)

    const teachers = teacherEmails.length
      ? await prisma.teacher.findMany({ where: { email: { in: teacherEmails } }, select: { id: true, email: true, jury: true } })
      : []
    const students = studentEmails.length
      ? await prisma.student.findMany({ where: { email: { in: studentEmails } }, select: { id: true, email: true, nom: true, prenom: true, assignedJury: true } })
      : []

    const teacherByEmail = new Map(teachers.map(t => [normalizeEmail(t.email), t]))
    const studentByEmail = new Map(students.map(s => [normalizeEmail(s.email), s]))

    const createdTeachers = []
    const createdStudents = []

    for (const email of teacherEmails) {
      if (!teacherByEmail.has(email)) {
        const sourceTeacher = (source.juryMembers || []).find(t => normalizeEmail(t.email) === email) || { email }
        const password = crypto.randomBytes(9).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').slice(0, 12)
        const hashed = await argon2.hash(password)
        const teacherData = { email, password: hashed }
        if (sourceTeacher.jury) teacherData.jury = sourceTeacher.jury
        const createdTeacher = await prisma.teacher.create({ data: teacherData })
        teacherByEmail.set(email, createdTeacher)
        createdTeachers.push({ id: createdTeacher.id, email, password })
      }
    }

    for (const email of studentEmails) {
      if (!studentByEmail.has(email)) {
        const sourceStudent = (source.assignedStudents || []).find(s => normalizeEmail(s.email) === email) || { email }
        const password = crypto.randomBytes(9).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').slice(0, 12)
        const hashed = await argon2.hash(password)
        const studentData = { email, password: hashed }
        if (sourceStudent.nom) studentData.nom = sourceStudent.nom
        if (sourceStudent.prenom) studentData.prenom = sourceStudent.prenom
        if (sourceStudent.firstName) studentData.prenom = sourceStudent.firstName
        if (sourceStudent.lastName) studentData.nom = sourceStudent.lastName
        if (sourceStudent.assignedJury) studentData.assignedJury = sourceStudent.assignedJury
        const createdStudent = await prisma.student.create({ data: studentData })
        studentByEmail.set(email, createdStudent)
        createdStudents.push({ id: createdStudent.id, email, password })
      }
    }

    const sourceTeacherById = new Map((source.juryMembers || [])
      .filter(t => t.id !== undefined)
      .map(t => [Number(t.id), normalizeEmail(t.email)]))
    const sourceStudentById = new Map((source.assignedStudents || [])
      .filter(s => s.id !== undefined)
      .map(s => [Number(s.id), normalizeEmail(s.email)]))

    const resolveTeacherIds = (group) => {
      const ids = []
      if (Array.isArray(group.teacherIds)) {
        ids.push(...group.teacherIds.map(sourceId => {
          const email = sourceTeacherById.get(Number(sourceId))
          return email ? teacherByEmail.get(email)?.id : undefined
        }))
      }
      if (Array.isArray(group.teacherEmails)) {
        ids.push(...group.teacherEmails.map(email => teacherByEmail.get(normalizeEmail(email))?.id))
      }
      return Array.from(new Set(ids.filter(Boolean)))
    }

    const resolveStudentIds = (group) => {
      const ids = []
      if (Array.isArray(group.studentIds)) {
        ids.push(...group.studentIds.map(sourceId => {
          const email = sourceStudentById.get(Number(sourceId))
          return email ? studentByEmail.get(email)?.id : undefined
        }))
      }
      if (Array.isArray(group.studentEmails)) {
        ids.push(...group.studentEmails.map(email => studentByEmail.get(normalizeEmail(email))?.id))
      }
      return Array.from(new Set(ids.filter(Boolean)))
    }

    const remappedJuryGroups = Array.isArray(source.juryGroups)
      ? source.juryGroups.map(group => ({
          ...group,
          teacherIds: resolveTeacherIds(group),
          studentIds: resolveStudentIds(group),
        }))
      : []

    const remappedSessions = Array.isArray(source.sessions)
      ? source.sessions.map(session => ({
          ...session,
          studentIds: resolveStudentIds(session),
        }))
      : []

    await updateQuestionnaireSettings(created.id, {
      gradingMode: source.gradingMode || 'points',
      maxScore: source.maxScore === undefined ? 20 : Number(source.maxScore),
      audience: source.audience || 'teachers',
      showResults: !!source.showResults,
      shuffleQuestions: !!source.shuffleQuestions,
      juryGroups: remappedJuryGroups,
      sessions: remappedSessions
    })

    await replaceQuestionnaireMembers(
      created.id,
      Array.from(teacherByEmail.values()).map(t => t.id),
      Array.from(studentByEmail.values()).map(s => s.id)
    )

    res.status(201).json({
      id: created.id,
      questionnaireId: created.id,
      missingTeachers: [],
      missingStudents: [],
      createdTeachers,
      createdStudents,
    })
  } catch (err) {
    console.error('Could not import questionnaire:', err.message)
    res.status(500).json({ error: 'Could not import questionnaire' })
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
    try {
      const students = await prisma.$queryRawUnsafe(`
        SELECT id, email, nom, prenom, assignedJury, isTest
        FROM Student
      `)
      return res.json(students || [])
    } catch (fallbackErr) {
      console.warn('Student list fallback query:', fallbackErr.message)
      const students = await prisma.$queryRawUnsafe(`
        SELECT id, email, nom, prenom
        FROM Student
      `)
      return res.json((students || []).map((s) => ({ ...s, assignedJury: null, isTest: false })))
    }
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
    const { nom, prenom, assignedJury, isTest } = req.body

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
    if (typeof isTest !== 'undefined') {
      updates.push('isTest = ?')
      values.push(isTest ? 1 : 0)
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

async function generateRandomPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').slice(0, 12)
}

app.post('/api/teachers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, admin = false } = req.body
    if (!email) return res.status(400).json({ error: 'email is required' })
    const normalizedEmail = normalizeEmail(email)
    const plain = typeof password === 'string' && password.trim() ? password : await generateRandomPassword()
    const hashed = await argon2.hash(plain)
    const created = await prisma.teacher.create({ data: { email: normalizedEmail, password: hashed, admin: !!admin } })
    const { password: _p, ...rest } = created
    return res.status(201).json({ ...rest, password: plain })
  } catch (err) {
    console.error('Could not create teacher:', err.message)
    res.status(500).json({ error: 'Could not create teacher' })
  }
})

app.post('/api/teachers/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body
    const id = Number(req.params.id)
    const plain = typeof password === 'string' && password.trim() ? password : await generateRandomPassword()
    const hashed = await argon2.hash(plain)
    await prisma.teacher.update({ where: { id }, data: { password: hashed } })
    res.json({ password: plain })
  } catch (err) {
    console.error('Could not reset teacher password:', err.message)
    res.status(500).json({ error: 'Could not reset teacher password' })
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

// Admin: generate/reset student password and return plaintext once
app.post('/api/students/:id/password', authenticateToken, async (req, res) => {
  try {
    const { id: meId, role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const me = await prisma.teacher.findUnique({ where: { id: meId } })
    if (!me || !me.admin) return res.status(403).json({ error: 'Admin required' })

    const id = Number(req.params.id)
    // generate secure password (12 chars, base64-derived)
    const plain = crypto.randomBytes(9).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').slice(0, 12)
    const hashed = await argon2.hash(plain)
    await prisma.student.update({ where: { id }, data: { password: hashed } })
    res.json({ password: plain })
  } catch (err) {
    console.error('Could not generate password for student:', err)
    res.status(500).json({ error: 'Could not generate password' })
  }
})

// Ensure admin user exists (email and password can be overridden with env vars ADMIN_EMAIL and ADMIN_PASSWORD)
;(async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@softwarenotes.local'
  const adminPassword = process.env.ADMIN_PASSWORD || '2yYB1YTZ3XVCg745Uj4up7413lqtyI5huX136Q'
  try {
    const existing = await prisma.teacher.findUnique({ where: { email: adminEmail } })
    if (!existing) {
      const hashed = await argon2.hash(adminPassword)
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

    const { targetRole, users, isTest } = req.body
    if (!targetRole || !Array.isArray(users)) return res.status(400).json({ error: 'targetRole and users required' })

    const results = []
    for (const u of users) {
      const email = normalizeEmail(u.email)
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
      const hashed = await argon2.hash(plain)
      if (targetRole === 'teacher') {
        const created = await prisma.teacher.create({ data: { email, password: hashed } })
        results.push({ status: 'created', id: created.id, email, password: plain })
      } else {
        const studentData = { email, password: hashed }
        if (u.nom) studentData.nom = u.nom
        if (u.prenom) studentData.prenom = u.prenom
        if (u.firstName) studentData.prenom = u.firstName
        if (u.lastName) studentData.nom = u.lastName
        // honor isTest flag either per-user or global
        if (u.isTest || isTest) studentData.isTest = true
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
app.post('/api/submissions', authenticateToken, async (req, res) => {
  try {
    const { questionnaireId, answers, submittedAt, studentId: bodyStudentId } = req.body
    if (!questionnaireId) return res.status(400).json({ error: 'questionnaireId is required' })

    let studentId = null
    if (req.user && req.user.role === 'student') {
      studentId = Number(req.user.id)
      if (bodyStudentId && Number(bodyStudentId) !== studentId) {
        return res.status(400).json({ error: 'Student ID does not match authenticated user' })
      }
    } else if (req.user && req.user.role === 'teacher') {
      studentId = bodyStudentId ? Number(bodyStudentId) : null
      if (!studentId) {
        return res.status(400).json({ error: 'studentId is required when saving a student submission as teacher' })
      }
      const student = await prisma.student.findUnique({ where: { id: studentId } })
      if (!student) return res.status(400).json({ error: 'Invalid studentId' })
    }

    console.log('Submission attempt:', {
      questionnaireId,
      studentId,
      userRole: req.user?.role,
      userId: req.user?.id,
      answersCount: Array.isArray(answers) ? answers.length : 'not array',
      submittedAt
    })
    
    if (!studentId) {
      console.warn('No valid student ID:', { role: req.user?.role, id: req.user?.id, bodyStudentId })
      return res.status(400).json({ error: 'Not authenticated as student' })
    }

    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: Number(questionnaireId) },
      select: { openForStudents: true }
    })
    if (!questionnaire) return res.status(404).json({ error: 'Questionnaire not found' })

    if (req.user.role === 'student') {
      const allowed = questionnaire.openForStudents || await prisma.questionnaireStudentMember.findFirst({
        where: { questionnaireId: Number(questionnaireId), studentId }
      })
      if (!allowed) return res.status(403).json({ error: 'Not authorized to submit this questionnaire' })
    }

    const parsedSubmittedAt = parseSubmissionDate(submittedAt)
    let submissionTime = parsedSubmittedAt instanceof Date ? parsedSubmittedAt : new Date()
    if (Number.isNaN(submissionTime.getTime())) {
      submissionTime = new Date()
    }
    const submission = await prisma.submission.create({
      data: {
        questionnaireId: Number(questionnaireId),
        studentId,
        answers: JSON.stringify(answers || []),
        submittedAt: submissionTime.toISOString()
      }
    })

    console.log('Submission created successfully:', { submissionId: submission.id, studentId, submittedAt: submission.submittedAt })
    res.status(201).json({ success: true, id: submission.id })
  } catch (err) {
    console.error('Submission error:', err.message, err)
    res.status(500).json({ error: 'Failed to save submission' })
  }
})

app.get('/api/submissions/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const id = Number(req.params.id)
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { student: true, questionnaire: true }
    })
    if (!submission) return res.status(404).json({ error: 'Not found' })
    res.json({
      id: submission.id,
      questionnaireId: submission.questionnaireId,
      questionnaire: submission.questionnaire ? { id: submission.questionnaire.id, title: submission.questionnaire.title } : null,
      studentId: submission.studentId,
      student: submission.student ? {
        id: submission.student.id,
        email: submission.student.email,
        nom: submission.student.nom,
        prenom: submission.student.prenom,
      } : null,
      answers: safeParseJSON(submission.answers) || [],
      submittedAt: formatSubmissionDate(submission.submittedAt),
    })
  } catch (err) {
    console.error('Could not fetch submission:', err.message)
    res.status(500).json({ error: 'Could not fetch submission' })
  }
})

app.get('/api/results/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user || {}
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const id = Number(req.params.id)
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { student: true, questionnaire: true }
    })
    if (!submission) return res.status(404).json({ error: 'Not found' })
    res.json({
      id: submission.id,
      questionnaireId: submission.questionnaireId,
      questionnaire: submission.questionnaire ? { id: submission.questionnaire.id, title: submission.questionnaire.title } : null,
      studentId: submission.studentId,
      student: submission.student ? {
        id: submission.student.id,
        email: submission.student.email,
        nom: submission.student.nom,
        prenom: submission.student.prenom,
      } : null,
      answers: safeParseJSON(submission.answers) || [],
      submittedAt: formatSubmissionDate(submission.submittedAt),
    })
  } catch (err) {
    console.error('Could not fetch result:', err.message)
    res.status(500).json({ error: 'Could not fetch result' })
  }
})

// Get results for a questionnaire
app.get('/api/questionnaires/:id/results', authenticateToken, async (req, res) => {
  try {
    const questionnaireId = Number(req.params.id)
    const { role } = req.user || {}
    
    // Only teachers may view results
    if (role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })

    let submissions = []
    try {
      submissions = await prisma.submission.findMany({
        where: { questionnaireId },
        include: { student: true },
        orderBy: { submittedAt: 'desc' }
      })
    } catch (fallbackError) {
      console.warn('Failed to load questionnaire results via Prisma, falling back to raw query:', fallbackError.message)
      const rows = await prisma.$queryRaw`
        SELECT s.id, s.questionnaireId, s.studentId, s.answers, s.submittedAt, st.id AS studentId, st.email AS studentEmail, st.nom AS studentNom, st.prenom AS studentPrenom
        FROM Submission s
        LEFT JOIN Student st ON s.studentId = st.id
        WHERE s.questionnaireId = ${questionnaireId}
        ORDER BY s.submittedAt DESC
      `
      submissions = rows.map(row => ({
        id: Number(row.id),
        questionnaireId: Number(row.questionnaireId),
        studentId: row.studentId === null ? null : Number(row.studentId),
        student: row.studentEmail ? {
          id: Number(row.studentId),
          email: row.studentEmail,
          nom: row.studentNom,
          prenom: row.studentPrenom,
        } : null,
        answers: row.answers,
        submittedAt: row.submittedAt,
      }))
    }
    
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
      submittedAt: formatSubmissionDate(s.submittedAt),
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
