import express from 'express'
import argon2 from 'argon2'
import { prisma, normalizeEmail, requireTeacher, requireAdmin, generatePassword } from '../utils.js'

const router = express.Router()

router.get('/teachers', requireAdmin, async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        admin: true,
        juryId: true,
      }
    })
    res.json(teachers.map(t => ({
      ...t,
      email: (t.email && t.email.includes('_')) ? '' : t.email
    })))
  } catch (error) {
    console.error("Détails de l'erreur /api/teachers :", error);
    res.status(500).json({ error: 'Erreur lors de la récupération des enseignants', details: error.message });
  }
})

router.post('/teachers', requireAdmin, async (req, res) => {
  try {
    const { email, password, name, lastName, nom, prenom, admin = false } = req.body

    let finalEmail;
    if (typeof email === 'string' && email.trim() !== "") {
      finalEmail = normalizeEmail(email);
    } else {
      finalEmail = `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    if (typeof finalEmail !== 'string') {
      console.warn(`normalizeEmail returned non-string value for email: ${email}. Falling back to generated email.`);
      finalEmail = `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}_fallback`;
    }
    const plain = typeof password === 'string' && password.trim() ? password : generatePassword(12)
    const hashed = await argon2.hash(plain)

    const created = await prisma.teacher.create({
      data: {
        email: finalEmail,
        password: hashed,
        name: prenom || name || "",
        lastName: nom || lastName || "",
        admin: false
      }
    })

    const { password: _p, ...rest } = created
    return res.status(201).json({ ...rest, password: plain })
  } catch (error) {
    console.error("Teacher Creation Error:", error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Un enseignant avec cet email existe déjà.' });
    }
    res.status(500).json({ error: 'Could not create teacher', details: error.message });
  }
})

router.put('/teachers/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { nom, prenom, email, admin } = req.body // Destructure only expected fields from frontend
    const data = {}
    if (prenom !== undefined) data.name = prenom // Explicitly map prenom to DB.name
    if (nom !== undefined) data.lastName = nom   // Explicitly map nom to DB.lastName
    if (email !== undefined) data.email = normalizeEmail(email)
    if (admin !== undefined) data.admin = Boolean(admin)

    if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' })

    const updated = await prisma.teacher.update({ where: { id }, data })
    res.json(updated)
  } catch (error) { res.status(500).json({ error: 'Could not update teacher', details: error.message }) }
})

router.post('/teachers/:id/password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body
    const id = Number(req.params.id)
    const plain = typeof password === 'string' && password.trim() ? password : generatePassword()
    const hashed = await argon2.hash(plain)
    await prisma.teacher.update({ where: { id }, data: { password: hashed } })
    res.json({ password: plain })
  } catch (error) { res.status(500).json({ error: 'Could not reset teacher password', details: error.message }) }
})

router.patch('/teachers/:id/jury', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { jury } = req.body
  try {
    const updated = await prisma.teacher.update({ where: { id }, data: { juryId: Number(jury) || null } })
    res.json(updated)
  } catch (error) { res.status(500).json({ error: 'Internal error', details: error.message }) }
})

router.post('/teachers/:id/jury', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { juryName } = req.body
    await prisma.teacher.update({ where: { id }, data: { jury: juryName || null } })
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'Could not assign jury to teacher' }) }
})

router.delete('/teachers/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (req.user.id === id) return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." })
  
  try {
    await prisma.$transaction(async (tx) => {
      await tx.questionnaireJuryMember.deleteMany({ where: { teacherId: id } })
      await tx.sessionJury.deleteMany({ where: { teacherId: id } })
      await tx.submission.deleteMany({ where: { teacherId: id } })
      await tx.teacher.delete({ where: { id } })
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'enseignant', details: error.message })
  }
})

router.delete('/teachers', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Une liste d\'IDs est requise.' })
    
    const numericIds = ids.map(Number).filter(Boolean)
    if (numericIds.includes(Number(req.user.id))) {
      return res.status(400).json({ error: "L'opération a été annulée car votre compte figure dans la sélection." })
    }

    await prisma.$transaction(async (tx) => {
      await tx.questionnaireJuryMember.deleteMany({ where: { teacherId: { in: numericIds } } })
      await tx.sessionJury.deleteMany({ where: { teacherId: { in: numericIds } } })
      await tx.submission.deleteMany({ where: { teacherId: { in: numericIds } } })
      await tx.teacher.deleteMany({ where: { id: { in: numericIds } } })
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression groupée', details: error.message })
  }
})

router.get('/juries', requireTeacher, async (req, res) => {
  try {
    const juries = await prisma.jury.findMany({ 
      orderBy: { name: 'asc' }, 
      include: { 
        teachers: { select: { id: true, email: true } }, 
        students: { select: { id: true, email: true } } 
      } 
    })
    res.json(juries.map(jury => ({ 
      id: jury.id, name: jury.name, 
      teachers: jury.teachers.map(t => ({ ...t, email: (t.email && t.email.includes('_')) ? '' : t.email })), 
      students: jury.students.map(s => ({ ...s, email: (s.email && s.email.includes('_')) ? '' : s.email })) 
    })))
  } catch { res.status(500).json({ error: 'Could not fetch juries' }) }
})

router.post('/juries', requireAdmin, async (req, res) => {
  try { const { name } = req.body; if (!name) return res.status(400).json({ error: 'name required' }); try { await prisma.jury.create({ data: { name } }) } catch (e) { if (!(e && e.code === 'P2002')) throw e }; res.status(201).json({ name }) } catch { res.status(500).json({ error: 'Could not create jury' }) }
})

router.delete('/juries/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.$transaction([
      prisma.teacher.updateMany({ where: { juryId: id }, data: { juryId: null } }),
      prisma.student.updateMany({ where: { juryId: id }, data: { juryId: null } }),
      prisma.sessionJury.deleteMany({ where: { juryId: id } }),
      prisma.sessionStudent.deleteMany({ where: { juryId: id } }),
      prisma.jury.delete({ where: { id } })
    ])
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression du jury', details: error.message })
  }
})

export default router