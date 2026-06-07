import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

const JWT_SECRET = process.env.JWT_SECRET

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(403).json({ error: 'Invalid token' })
  }
}

export function requireTeacher(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only' })
    next()
  })
}

export async function requireAdmin(req, res, next) {
  authenticateToken(req, res, async () => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const teacher = await prisma.teacher.findUnique({ where: { id: Number(req.user.id) } })
    if (!teacher?.admin) return res.status(403).json({ error: 'Admin required' })
    next()
  })
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function safeParseJSON(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return null }
}

export function parseSubmissionDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatSubmissionDate(value) {
  const date = parseSubmissionDate(value)
  return date ? date.toISOString() : null
}

export async function mergeQuestionnaireSettings(questionnaires) {
  const list = Array.isArray(questionnaires) ? questionnaires : [questionnaires]
  const ids = list.filter(Boolean).map(q => Number(q.id)).filter(Boolean)
  if (!ids.length) return questionnaires
  const rows = await prisma.questionnaire.findMany({
    where: { id: { in: ids } },
    select: { id: true, gradingMode: true, maxScore: true, audience: true, showResults: true, shuffleQuestions: true, juryGroups: true, sessions: true }
  })
  const byId = new Map(rows.map(row => [Number(row.id), row]))
  const merged = list.map(q => {
    const row = byId.get(Number(q.id)) || {}
    return { ...q, gradingMode: row.gradingMode || q.gradingMode, maxScore: row.maxScore ?? q.maxScore, audience: row.audience || q.audience, showResults: row.showResults ?? q.showResults, shuffleQuestions: row.shuffleQuestions ?? q.shuffleQuestions, juryGroups: q.juryGroups || safeParseJSON(row.juryGroups), sessions: q.sessions || safeParseJSON(row.sessions) }
  })
  return Array.isArray(questionnaires) ? merged : merged[0]
}

export async function getQuestionnaireMembers(questionnaireId) {
  const qid = Number(questionnaireId)
  const juryRows = await prisma.questionnaireJuryMember.findMany({ where: { questionnaireId: qid }, include: { teacher: true }, orderBy: { teacher: { email: 'asc' } } })
  const studentRows = await prisma.questionnaireStudentMember.findMany({ where: { questionnaireId: qid }, include: { student: true }, orderBy: [{ student: { nom: 'asc' } }, { student: { prenom: 'asc' } }, { student: { email: 'asc' } }] })
  return { teachers: juryRows.map(row => ({ id: row.teacher.id, email: row.teacher.email, jury: row.teacher.jury, admin: row.teacher.admin })), students: studentRows.map(row => ({ id: row.student.id, email: row.student.email, nom: row.student.nom, prenom: row.student.prenom, assignedJury: row.student.assignedJury })) }
}