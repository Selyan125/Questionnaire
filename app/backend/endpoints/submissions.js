import express from 'express'
import { prisma, requireTeacher, parseSubmissionDate, formatSubmissionDate, safeParseJSON } from '../utils.js'

const router = express.Router()

router.post('/submissions', requireTeacher, async (req, res) => {
  try {
    const { questionnaireId, answers, submittedAt, studentId, evaluatorId, score, sessionId } = req.body
    if (!questionnaireId || !studentId) return res.status(400).json({ error: 'Missing fields' })
    
    const qid = Number(questionnaireId)
    const sid = Number(studentId)
    const tid = evaluatorId ? Number(evaluatorId) : Number(req.user.id)
    const sessId = sessionId ? Number(sessionId) : null
    const d = parseSubmissionDate(submittedAt) || new Date()

    // On cherche si une évaluation existe déjà pour ce duo étudiant/questionnaire
    const existing = await prisma.submission.findFirst({
      where: { questionnaireId: qid, studentId: sid }
    })

    const subData = {
      answers: JSON.stringify(answers || {}),
      submittedAt: d,
      teacherId: tid,
      score: score !== undefined ? Number(score) : undefined,
      sessionId: sessId
    }

    if (existing) {
      await prisma.submission.update({ where: { id: existing.id }, data: subData })
    } else {
      await prisma.submission.create({ data: { ...subData, questionnaireId: qid, studentId: sid } })
    }

    res.status(201).json({ success: true })
  } catch (error) { 
    console.error("Submission error:", error)
    res.status(500).json({ error: 'Failed to save evaluation' }) 
  }
})

router.get('/submissions/:id', requireTeacher, async (req, res) => {
  const s = await prisma.submission.findUnique({ where: { id: Number(req.params.id) }, include: { student: true, questionnaire: true } })
  if (!s) return res.status(404).json({ error: 'Not found' })
  res.json({ id: s.id, questionnaireId: s.questionnaireId, questionnaire: s.questionnaire ? { id: s.questionnaire.id, title: s.questionnaire.title } : null, studentId: s.studentId, student: s.student ? { id: s.student.id, email: s.student.email, nom: s.student.nom, prenom: s.student.prenom } : null, answers: safeParseJSON(s.answers) || [], submittedAt: formatSubmissionDate(s.submittedAt) })
})

router.get('/results/:id', requireTeacher, async (req, res) => { res.redirect(301, `/api/submissions/${req.params.id}`) })

export default router