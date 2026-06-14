import express from 'express'
import argon2 from 'argon2'
import { prisma, normalizeEmail, requireTeacher, requireAdmin, generatePassword } from '../utils.js'

const router = express.Router()

router.get('/teachers', requireAdmin, async (req, res) => {
  try {
    // On simplifie le select pour éviter de crash si une relation est mal définie
    const teachers = await prisma.teacher.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        admin: true,
        juryId: true,
        // Si jury est une relation, on ne peut pas faire jury: true
      }
    })
    res.json(teachers)
  } catch (error) {
    console.error("Détails de l'erreur /api/teachers :", error);
    res.status(500).json({ error: 'Erreur lors de la récupération des enseignants', details: error.message });
  }
})

router.post('/teachers', requireAdmin, async (req, res) => {
  try {
    // Supporte name/lastName ET nom/prenom pour éviter les erreurs de mapping
    const { email, password, name, lastName, nom, prenom, admin = false } = req.body
    if (!email) return res.status(400).json({ error: 'email is required' })

    const normalizedEmail = normalizeEmail(email) // Use normalizeEmail from utils
    const plain = typeof password === 'string' && password.trim() ? password : generatePassword(12)
    const hashed = await argon2.hash(plain)

    const created = await prisma.teacher.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        name: prenom || name || "",
        lastName: nom || lastName || "",
        admin: !!admin
      }
    })

    const { password: _p, ...rest } = created
    return res.status(201).json({ ...rest, password: plain })
  } catch (error) {
    console.error("Teacher Creation Error:", error);
    // Gestion de l'erreur Prisma P2002 (Violation de contrainte unique)
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
    // Attention : si jury est une relation, il faut utiliser juryId ou connect
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
      // Nettoyage des références dans les tables de jointure pour éviter les erreurs de clé étrangère (P2003)
      await tx.questionnaireJuryMember.deleteMany({ where: { teacherId: id } })
      await tx.sessionJury.deleteMany({ where: { teacherId: id } })
      await tx.submission.deleteMany({ where: { teacherId: id } })
      // Suppression de l'enseignant une fois les dépendances nettoyées
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
    // Sécurité : on empêche l'admin de se supprimer lui-même via la suppression groupée
    if (numericIds.includes(Number(req.user.id))) {
      return res.status(400).json({ error: "L'opération a été annulée car votre compte figure dans la sélection." })
    }

    await prisma.$transaction(async (tx) => {
      // Suppression des dépendances pour tous les IDs sélectionnés
      await tx.questionnaireJuryMember.deleteMany({ where: { teacherId: { in: numericIds } } })
      await tx.sessionJury.deleteMany({ where: { teacherId: { in: numericIds } } })
      await tx.submission.deleteMany({ where: { teacherId: { in: numericIds } } })
      // Suppression effective des enseignants
      await tx.teacher.deleteMany({ where: { id: { in: numericIds } } })
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression groupée', details: error.message })
  }
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