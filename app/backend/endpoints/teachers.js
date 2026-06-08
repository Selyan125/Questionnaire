import express from 'express'
import argon2 from 'argon2'
import { prisma, normalizeEmail, requireTeacher, requireAdmin, generatePassword } from '../utils.js'

const router = express.Router()

router.get('/teachers', requireAdmin, async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({ select: { id: true, email: true, jury: true, juryId: true, admin: true } })
    res.json(teachers)
  } catch { res.status(500).json({ error: 'Could not fetch teachers' }) }
})

router.post('/teachers', requireAdmin, async (req, res) => {
  try {
    const { email, password, admin = false } = req.body
    if (!email) return res.status(400).json({ error: 'email is required' })
    const normalizedEmail = normalizeEmail(email) // Use normalizeEmail from utils
    const plain = typeof password === 'string' && password.trim() ? password : generatePassword()
    const hashed = await argon2.hash(plain)
    const created = await prisma.teacher.create({ data: { email: normalizedEmail, password: hashed, admin: !!admin } })
    const { password: _p, ...rest } = created
    return res.status(201).json({ ...rest, password: plain })
  } catch { res.status(500).json({ error: 'Could not create teacher' }) }
})

router.post('/teachers/:id/password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body
    const id = Number(req.params.id)
    const plain = typeof password === 'string' && password.trim() ? password : generatePassword()
    const hashed = await argon2.hash(plain)
    await prisma.teacher.update({ where: { id }, data: { password: hashed } })
    res.json({ password: plain })
  } catch { res.status(500).json({ error: 'Could not reset teacher password' }) }
})

router.patch('/teachers/:id/jury', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { jury } = req.body
  try {
    const updated = await prisma.teacher.update({ where: { id }, data: { jury } })
    res.json(updated)
  } catch { res.status(500).json({ error: 'Internal error' }) }
})

router.post('/teachers/:id/jury', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { juryName } = req.body
    await prisma.teacher.update({ where: { id }, data: { jury: juryName || null } })
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'Could not assign jury to teacher' }) }
})

router.get('/juries', requireTeacher, async (req, res) => {
  try {
    const juries = await prisma.jury.findMany({ orderBy: { name: 'asc' }, include: { teachers: { select: { id: true, email: true } }, students: { select: { id: true, email: true } } } })
    res.json(juries.map(jury => ({ id: jury.id, name: jury.name, teachers: jury.teachers, students: jury.students })))
  } catch { res.status(500).json({ error: 'Could not fetch juries' }) }
})

router.post('/juries', requireAdmin, async (req, res) => {
  try { const { name } = req.body; if (!name) return res.status(400).json({ error: 'name required' }); try { await prisma.jury.create({ data: { name } }) } catch (e) { if (!(e && e.code === 'P2002')) throw e }; res.status(201).json({ name }) } catch { res.status(500).json({ error: 'Could not create jury' }) }
})

export default router