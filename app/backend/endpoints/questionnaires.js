import express from 'express'
import { prisma, requireTeacher, requireAdmin, mergeQuestionnaireSettings, getQuestionnaireMembers, formatSubmissionDate, safeParseJSON } from '../utils.js'

const router = express.Router()

async function updateQuestionnaireSettings(id, settings) {
  const data = {}
  if (settings.gradingMode !== undefined) data.gradingMode = settings.gradingMode
  if (settings.maxScore !== undefined) data.maxScore = Number(settings.maxScore)
  if (settings.audience !== undefined) data.audience = settings.audience
  if (settings.showResults !== undefined) data.showResults = Boolean(settings.showResults)
  if (settings.shuffleQuestions !== undefined) data.shuffleQuestions = Boolean(settings.shuffleQuestions)
  if (settings.juryGroups !== undefined) data.juryGroups = typeof settings.juryGroups === 'string' ? settings.juryGroups : JSON.stringify(settings.juryGroups || [])
  if (settings.sessions !== undefined) data.sessions = typeof settings.sessions === 'string' ? settings.sessions : JSON.stringify(settings.sessions || [])
  if (Object.keys(data).length) await prisma.questionnaire.update({ where: { id: Number(id) }, data })
}

async function replaceQuestionnaireMembers(questionnaireId, teacherIds = [], studentIds = []) {
  const qid = Number(questionnaireId)
  await prisma.$transaction(async (tx) => {
    await tx.questionnaireJuryMember.deleteMany({ where: { questionnaireId: qid } })
    await tx.questionnaireStudentMember.deleteMany({ where: { questionnaireId: qid } })
    const tRecs = Array.from(new Set((teacherIds || []).map(Number).filter(Boolean))).map(teacherId => ({ questionnaireId: qid, teacherId }))
    if (tRecs.length) await tx.questionnaireJuryMember.createMany({ data: tRecs })
    const sRecs = Array.from(new Set((studentIds || []).map(Number).filter(Boolean))).map(studentId => ({ questionnaireId: qid, studentId }))
    if (sRecs.length) await tx.questionnaireStudentMember.createMany({ data: sRecs })
  })
}

router.get('/', requireTeacher, async (req, res) => {
  const teacherId = Number(req.user.id);
  const questionnaires = await prisma.questionnaire.findMany({ where: req.user.admin ? {} : { sessions: { some: { active: true, juries: { some: { teacherId } } } } }, orderBy: { id: 'desc' }, include: { categories: true, sessions: { where: req.user.admin ? {} : { active: true, juries: { some: { teacherId } } }, include: { juries: { include: { jury: true, teacher: true } }, students: { include: { student: true, jury: true } } } } } })
  const formatted = questionnaires.map(q => ({ ...q, sessions: (q.sessions || []).map(s => ({ ...s, juries: s.juries.map(sj => ({ id: sj.id, juryId: sj.juryId, juryName: sj.jury.name, teacherId: sj.teacherId, teacherEmail: sj.teacher.email })), students: s.students.map(ss => ({ id: ss.id, studentId: ss.studentId, studentEmail: ss.student.email, studentNom: ss.student.nom, studentPrenom: ss.student.prenom, juryId: ss.juryId, juryName: ss.jury.name })) })) }))
  res.json(await mergeQuestionnaireSettings(formatted))
})

router.get('/:id', requireTeacher, async (req, res) => {
  const id = Number(req.params.id)
  const q = await prisma.questionnaire.findUnique({ where: { id }, include: { categories: { include: { questions: { include: { elements: true } } } } } })
  if (!q) return res.status(404).json({ error: 'Not found' })
  if (!req.user.admin) { const hasS = await prisma.session.findFirst({ where: { questionnaireId: id, active: true, juries: { some: { teacherId: Number(req.user.id) } } } }); if (!hasS) return res.status(403).json({ error: 'Accès refusé' }) }
  const m = await getQuestionnaireMembers(id); res.json({ ...(await mergeQuestionnaireSettings(q)), juryMembers: m.teachers, assignedStudents: m.students })
})

router.post('/', requireAdmin, async (req, res) => {
  const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions } = req.body
  const q = await prisma.questionnaire.create({ data: { title, openForStudents: !!openForStudents, date: new Date() } })
  await updateQuestionnaireSettings(q.id, { gradingMode: gradingMode || 'points', maxScore: maxScore ?? 20, audience: audience || 'teachers', showResults: !!showResults, shuffleQuestions: !!shuffleQuestions })
  res.status(201).json(await mergeQuestionnaireSettings(q))
})

router.put('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id); const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions, date, juryGroups, sessions } = req.body; try { const data = {}; if (title !== undefined) data.title = title; if (openForStudents !== undefined) data.openForStudents = !!openForStudents; if (date) { const d = new Date(date); if (!isNaN(d.getTime())) data.date = d }; if (juryGroups !== undefined) data.juryGroups = typeof juryGroups === 'string' ? juryGroups : JSON.stringify(juryGroups); if (sessions !== undefined) data.sessions = typeof sessions === 'string' ? sessions : JSON.stringify(sessions); const u = Object.keys(data).length ? await prisma.questionnaire.update({ where: { id }, data }) : await prisma.questionnaire.findUnique({ where: { id } }); await updateQuestionnaireSettings(id, { gradingMode, maxScore, audience, showResults, shuffleQuestions }); res.json(await mergeQuestionnaireSettings(u)) } catch { res.status(500).json({ error: 'Internal error' }) }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id); try { await prisma.$transaction(async (tx) => { const cats = await tx.questionCategory.findMany({ where: { questionnaireId: id }, select: { id: true } }); const catIds = cats.map(c => c.id); if (catIds.length) { const qs = await tx.question.findMany({ where: { questionCategoryId: { in: catIds } }, select: { id: true } }); const qIds = qs.map(q => q.id); if (qIds.length) await tx.questionElement.deleteMany({ where: { questionId: { in: qIds } } }); await tx.question.deleteMany({ where: { questionCategoryId: { in: catIds } } }); await tx.questionCategory.deleteMany({ where: { questionnaireId: id } }) }; await tx.questionnaire.delete({ where: { id } }) }); res.status(204).end() } catch (err) { if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' }); res.status(409).json({ error: 'Could not delete' }) }
})

router.put('/:id/jury', requireAdmin, async (req, res) => {
  try { const id = Number(req.params.id); const { teacherIds, studentIds } = req.body; await replaceQuestionnaireMembers(id, teacherIds || [], studentIds || []); res.json(await getQuestionnaireMembers(id)) } catch { res.status(500).json({ error: 'Could not update jury' }) }
})

router.get('/:id/results', requireTeacher, async (req, res) => {
  try { const qid = Number(req.params.id); const assignments = await prisma.sessionStudent.findMany({ where: { session: { questionnaireId: qid } }, include: { session: true } }); const studentToSession = {}; assignments.forEach(sa => studentToSession[sa.studentId] = sa.session.name); const submissions = await prisma.submission.findMany({ where: { questionnaireId: qid }, include: { student: true }, orderBy: { submittedAt: 'desc' } }); res.json(submissions.map(s => ({ id: s.id, studentId: s.studentId, student: s.student ? { id: s.student.id, email: s.student.email, nom: s.student.nom, prenom: s.student.prenom } : null, email: s.student?.email || null, answers: safeParseJSON(s.answers) || [], submittedAt: formatSubmissionDate(s.submittedAt), sessionName: studentToSession[s.studentId] || 'Hors session', score: 0 }))) } catch { res.status(500).json({ error: 'Could not fetch results' }) }
})

export const apiRouter = express.Router()
apiRouter.post('/questionnaires/:id/categories', requireAdmin, async (req, res) => { res.status(201).json(await prisma.questionCategory.create({ data: { title: req.body.title, currentNote: req.body.currentNote || 0, questionnaireId: Number(req.params.id) } })) })
apiRouter.put('/categories/:id', requireAdmin, async (req, res) => { res.json(await prisma.questionCategory.update({ where: { id: Number(req.params.id) }, data: { title: req.body.title, currentNote: req.body.currentNote } })) })
apiRouter.delete('/categories/:id', requireAdmin, async (req, res) => { const id = Number(req.params.id); const qs = await prisma.question.findMany({ where: { questionCategoryId: id }, select: { id: true } }); for (const q of qs) await prisma.questionElement.deleteMany({ where: { questionId: q.id } }); await prisma.question.deleteMany({ where: { questionCategoryId: id } }); await prisma.questionCategory.delete({ where: { id } }); res.status(204).end() })
apiRouter.post('/categories/:id/questions', requireAdmin, async (req, res) => { res.status(201).json(await prisma.question.create({ data: { title: req.body.title, questionCategoryId: Number(req.params.id) } })) })
apiRouter.put('/questions/:id', requireAdmin, async (req, res) => { res.json(await prisma.question.update({ where: { id: Number(req.params.id) }, data: { title: req.body.title, questionCategoryId: Number(req.body.questionCategoryId) } })) })
apiRouter.delete('/questions/:id', requireAdmin, async (req, res) => { await prisma.questionElement.deleteMany({ where: { questionId: Number(req.params.id) } }); await prisma.question.delete({ where: { id: Number(req.params.id) } }); res.status(204).end() })
apiRouter.post('/questions/:id/elements', requireAdmin, async (req, res) => { res.status(201).json(await prisma.questionElement.create({ data: { type: req.body.type, title: req.body.title, priority: req.body.priority || 0, evaluatingType: req.body.evaluatingType || 0, evaluatingValue: req.body.evaluatingValue || 0, questionId: Number(req.params.id) } })) })
apiRouter.put('/elements/:id', requireAdmin, async (req, res) => { res.json(await prisma.questionElement.update({ where: { id: Number(req.params.id) }, data: { type: req.body.type, title: req.body.title, priority: req.body.priority, evaluatingType: req.body.evaluatingType, evaluatingValue: req.body.evaluatingValue } })) })
apiRouter.delete('/elements/:id', requireAdmin, async (req, res) => { await prisma.questionElement.delete({ where: { id: Number(req.params.id) } }); res.status(204).end() })

export default router