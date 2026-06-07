import express from 'express'
import argon2 from 'argon2'
import crypto from 'crypto'
import { prisma, requireAdmin, normalizeEmail } from '../utils.js'

const router = express.Router()

router.get('/stats', requireAdmin, async (req, res) => {
  const s = await prisma.student.count(); const t = await prisma.teacher.count(); const q = await prisma.questionnaire.count(); const o = await prisma.questionnaire.count({ where: { openForStudents: true } })
  res.json({ students: s, teachers: t, questionnaires: q, openQuestionnaires: o })
})

router.post('/admin/import', requireAdmin, async (req, res) => {
  const { targetRole: tr, users, isTest } = req.body; if (!tr || !Array.isArray(users)) return res.status(400).json({ error: 'Missing data' })
  const results = []
  for (const u of users) {
    const email = normalizeEmail(u.email); if (!email) continue
    if (tr === 'teacher' ? await prisma.teacher.findUnique({ where: { email } }) : await prisma.student.findUnique({ where: { email } })) { results.push({ status: 'exists', email }); continue }
    const plain = crypto.randomBytes(9).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').slice(0, 12); const hashed = await argon2.hash(plain)
    if (tr === 'teacher') { const c = await prisma.teacher.create({ data: { email, password: hashed } }); results.push({ status: 'created', id: c.id, email, password: plain }) }
    else { const c = await prisma.student.create({ data: { email, password: hashed, nom: u.nom || u.lastName, prenom: u.prenom || u.firstName, isTest: !!(u.isTest || isTest) } }); results.push({ status: 'created', id: c.id, email, password: plain }) }
  }
  res.status(201).json({ results })
})

router.post('/admin/migrate-sessions', requireAdmin, async (req, res) => {
  const qs = await prisma.questionnaire.findMany({ select: { id: true, sessions: true, juryMembers: { include: { teacher: true } } } })
  for (const q of qs) {
    let list = []
    try { if (typeof q.sessions === 'string') list = JSON.parse(q.sessions); else if (Array.isArray(q.sessions)) list = q.sessions } catch { continue }
    const defJ = (await prisma.jury.findFirst())?.id
    for (const sd of list) {
      const s = await prisma.session.create({ data: { name: sd.name || 'Session', date: sd.date ? new Date(sd.date) : null, questionnaireId: q.id } })
      for (const m of q.juryMembers) if (m.teacher.juryId) try { await prisma.sessionJury.create({ data: { sessionId: s.id, juryId: m.teacher.juryId, teacherId: m.teacherId } }) } catch {}
    }
  }
  res.json({ status: 'success' })
})

export default router