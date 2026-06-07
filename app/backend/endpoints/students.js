import express from 'express'
import argon2 from 'argon2'
import crypto from 'crypto'
import { prisma, requireTeacher, requireAdmin } from '../utils.js'

const router = express.Router()

router.get('/', requireAdmin, async (req, res) => {
  try {
    const students = await prisma.student.findMany({ select: { id: true, email: true, nom: true, prenom: true, assignedJury: true, isTest: true } })
    return res.json(students || [])
  } catch { res.status(500).json({ error: 'Could not fetch students' }) }
})

router.get('/:id/results', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const student = await prisma.student.findUnique({ where: { id }, select: { id: true, email: true, nom: true, prenom: true } })
    if (!student) return res.status(404).json({ error: 'Student not found' })
    res.json({ student, results: [] })
  } catch { res.status(500).json({ error: 'Could not fetch student results' }) }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { nom, prenom, assignedJury, isTest } = req.body
    const existing = await prisma.student.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Student not found' })
    const data = {}
    if (nom !== undefined) data.nom = nom
    if (prenom !== undefined) data.prenom = prenom
    if (assignedJury !== undefined) data.assignedJury = assignedJury
    if (isTest !== undefined) data.isTest = Boolean(isTest)
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' })
    const updated = await prisma.student.update({ where: { id }, data })
    res.json(updated)
  } catch { res.status(500).json({ error: 'Could not update student' }) }
})

router.patch('/:id/jury', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { assignedJury } = req.body
  try {
    const updated = await prisma.student.update({ where: { id }, data: { assignedJury } })
    res.json(updated)
  } catch { res.status(500).json({ error: 'Internal error' }) }
})

router.post('/:id/password', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const plain = crypto.randomBytes(9).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').slice(0, 12)
    const hashed = await argon2.hash(plain)
    await prisma.student.update({ where: { id }, data: { password: hashed } })
    res.json({ password: plain })
  } catch { res.status(500).json({ error: 'Could not generate password' }) }
})

export default router