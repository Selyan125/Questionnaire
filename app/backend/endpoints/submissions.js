import express from 'express'
import { prisma, requireTeacher, parseSubmissionDate, formatSubmissionDate, safeParseJSON } from '../utils.js'

const router = express.Router()

router.post('/submissions', requireTeacher, async (req, res) => {
  try {
    const { questionnaireId, answers, submittedAt, studentId: sid } = req.body
    if (!questionnaireId || !sid) return res.status(400).json({ error: 'Missing fields' })
    if (await prisma.submission.findFirst({ where: { questionnaireId: Number(questionnaireId), studentId: Number(sid) } })) return res.status(409).json({ error: 'Submission exists' })
    const d = parseSubmissionDate(submittedAt) || new Date()
    await prisma.submission.create({ data: { questionnaireId: Number(questionnaireId), studentId: Number(sid), answers: JSON.stringify(answers || []), submittedAt: d } })
    res.status(201).json({ success: true })
  } catch { res.status(500).json({ error: 'Failed to save' }) }
})

router.get('/submissions/:id', requireTeacher, async (req, res) => {
  const s = await prisma.submission.findUnique({ where: { id: Number(req.params.id) }, include: { student: true, questionnaire: true } })
  if (!s) return res.status(404).json({ error: 'Not found' })
  res.json({ id: s.id, questionnaireId: s.questionnaireId, questionnaire: s.questionnaire ? { id: s.questionnaire.id, title: s.questionnaire.title } : null, studentId: s.studentId, student: s.student ? { id: s.student.id, email: s.student.email, nom: s.student.nom, prenom: s.student.prenom } : null, answers: safeParseJSON(s.answers) || [], submittedAt: formatSubmissionDate(s.submittedAt) })
})

router.get('/results/:id', requireTeacher, async (req, res) => { res.redirect(301, `/api/submissions/${req.params.id}`) })

export default router