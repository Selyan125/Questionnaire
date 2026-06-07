import express from 'express'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { prisma, normalizeEmail, requireAdmin } from '../utils.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true })

router.post('/register', requireAdmin, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  const normalizedEmail = normalizeEmail(email)
  const hashed = await argon2.hash(password)
  try {
    const created = await prisma.student.create({ data: { email: normalizedEmail, password: hashed } })
    const { password: _p, ...rest } = created
    return res.status(201).json(rest)
  } catch { return res.status(400).json({ error: 'Could not create user' }) }
})

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password and role are required' })
  try {
    const normalizedEmail = normalizeEmail(email)
    const user = role === 'teacher' ? await prisma.teacher.findUnique({ where: { email: normalizedEmail } }) : await prisma.student.findUnique({ where: { email: normalizedEmail } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await argon2.verify(user.password, password)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const payload = { id: user.id, role, email: user.email, admin: Boolean(user.admin) }
    if (role === 'student') { const assigned = await prisma.questionnaireStudentMember.findFirst({ where: { studentId: user.id } }); if (assigned) payload.assignedQuestionnaireId = assigned.questionnaireId }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, user: payload })
  } catch { return res.status(500).json({ error: 'Login error' }) }
})

export default router