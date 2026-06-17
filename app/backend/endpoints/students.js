import express from 'express'
import argon2 from 'argon2'
import { prisma, requireTeacher, requireAdmin, generatePassword } from '../utils.js'

const router = express.Router()

const sanitizeStudent = (s) => {
  if (!s) return s
  return { ...s, email: (s.email && s.email.includes('_')) ? '' : s.email }
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const students = await prisma.student.findMany({ select: { id: true, email: true, nom: true, prenom: true, year: true, group: true, assignedJury: true } })
    return res.json((students || []).map(sanitizeStudent))
  } catch (error) {
    console.error("Erreur lors de la récupération des étudiants:", error);
    res.status(500).json({ error: 'Could not fetch students', details: error.message });
  }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nom, prenom, year, group, email } = req.body;
    const finalEmail = (email && email.trim()) ? email.trim() : `student_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const student = await prisma.student.create({
      data: { nom: nom || '', prenom: prenom || '', year: year || '', group: group || '', email: finalEmail }
    });
    res.status(201).json(sanitizeStudent(student));
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création de l\'étudiant', details: err.message });
  }
});

router.get('/:id/results', requireTeacher, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, email: true, nom: true, prenom: true, year: true, group: true }
    })
    if (!student) return res.status(404).json({ error: 'Student not found' })

    const submissions = await prisma.submission.findMany({
      where: { studentId: id },
      include: {
        questionnaire: { select: { id: true, title: true } },
        teacher: { select: { name: true, lastName: true } },
        session: { select: { id: true, name: true } }
      }
    })
    res.json({ student: sanitizeStudent(student), results: submissions })
  } catch (error) { res.status(500).json({ error: 'Could not fetch student results', details: error.message }) }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { nom, prenom, email, year, group, assignedJury } = req.body
    const existing = await prisma.student.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Student not found' })
    const data = {}
    if (nom !== undefined) data.nom = nom
    if (prenom !== undefined) data.prenom = prenom
    if (email !== undefined) data.email = (email && email.trim()) ? email.trim() : `student_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (year !== undefined) data.year = year
    if (group !== undefined) data.group = group
    if (assignedJury !== undefined) data.assignedJury = assignedJury
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' })
    const updated = await prisma.student.update({ where: { id }, data })
    res.json(sanitizeStudent(updated))
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

router.delete('/', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs array required' })
    await prisma.student.deleteMany({ where: { id: { in: ids.map(Number) } } })
    res.json({ success: true })
  } catch (error) { 
    res.status(500).json({ error: 'Could not delete students', details: error.message }) 
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch (error) { res.status(500).json({ error: 'Could not delete student', details: error.message }) }
})

export default router