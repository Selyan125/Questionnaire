import express from 'express'
import { prisma, requireTeacher, requireAdmin } from '../utils.js'

const router = express.Router()

async function getSD(id) {
  const s = await prisma.session.findUnique({ where: { id: Number(id) }, include: { juries: { include: { jury: true, teacher: true } }, students: { include: { student: true, jury: true } } } })
  if (!s) return null
  return { ...s, juries: s.juries.map(sj => ({ id: sj.id, juryId: sj.juryId, juryName: sj.jury.name, teacherId: sj.teacherId, teacherEmail: sj.teacher.email })), students: s.students.map(ss => ({ id: ss.id, studentId: ss.studentId, studentEmail: ss.student.email, studentNom: ss.student.nom, studentPrenom: ss.student.prenom, juryId: ss.juryId, juryName: ss.jury.name })) }
}

async function getQSD(qid, filter = {}) {
  const ss = await prisma.session.findMany({ where: { questionnaireId: Number(qid), ...filter }, include: { juries: { include: { jury: true, teacher: true } }, students: { include: { student: true, jury: true } } }, orderBy: { id: 'asc' } })
  return ss.map(s => ({ ...s, juries: s.juries.map(sj => ({ id: sj.id, juryId: sj.juryId, juryName: sj.jury.name, teacherId: sj.teacherId, teacherEmail: sj.teacher.email })), students: s.students.map(ss => ({ id: ss.id, studentId: ss.studentId, studentEmail: ss.student.email, studentNom: ss.student.nom, studentPrenom: ss.student.prenom, juryId: ss.juryId, juryName: ss.jury.name })) }))
}

router.post('/questionnaires/:questionnaireId/sessions', requireAdmin, async (req, res) => {
  res.status(201).json(await prisma.session.create({ data: { name: req.body.name, date: req.body.date ? new Date(req.body.date) : null, questionnaireId: Number(req.params.questionnaireId) } }))
})

router.get('/questionnaires/:questionnaireId/sessions', requireTeacher, async (req, res) => {
  res.json(await getQSD(req.params.questionnaireId, req.user.admin ? {} : { active: true, juries: { some: { teacherId: Number(req.user.id) } } }))
})

router.get('/sessions/:sessionId', requireTeacher, async (req, res) => {
  const s = await getSD(req.params.sessionId); if (!s) return res.status(404).json({ error: 'Not found' }); if (!req.user.admin && (!s.active || !s.juries.some(j => j.teacherId === Number(req.user.id)))) return res.status(403).json({ error: 'Access denied' }); res.json(s)
})

router.put('/sessions/:sessionId', requireAdmin, async (req, res) => {
  const d = { name: req.body.name }; if (req.body.date) { const dt = new Date(req.body.date); if (!isNaN(dt.getTime())) d.date = dt }; if (req.body.active !== undefined) d.active = !!req.body.active; res.json(await prisma.session.update({ where: { id: Number(req.params.sessionId) }, data: d }))
})

router.delete('/sessions/:sessionId', requireAdmin, async (req, res) => { await prisma.session.delete({ where: { id: Number(req.params.sessionId) } }); res.json({ ok: true }) })
router.post('/sessions/:sessionId/juries', requireAdmin, async (req, res) => { res.status(201).json(await prisma.sessionJury.create({ data: { sessionId: Number(req.params.sessionId), juryId: Number(req.body.juryId), teacherId: Number(req.body.teacherId) } })) })
router.delete('/session-juries/:id', requireAdmin, async (req, res) => { await prisma.sessionJury.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }) })
router.post('/sessions/:sessionId/students', requireAdmin, async (req, res) => { const sid = Number(req.params.sessionId); const stid = Number(req.body.studentId); const jid = Number(req.body.juryId); res.status(201).json(await prisma.sessionStudent.upsert({ where: { sessionId_studentId: { sessionId: sid, studentId: stid } }, update: { juryId: jid }, create: { sessionId: sid, studentId: stid, juryId: jid } })) })
router.delete('/session-students/:id', requireAdmin, async (req, res) => { await prisma.sessionStudent.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }) })
router.patch('/session-students/:id', requireAdmin, async (req, res) => { res.json(await prisma.sessionStudent.update({ where: { id: Number(req.params.id) }, data: { juryId: Number(req.body.juryId) } })) })

export default router