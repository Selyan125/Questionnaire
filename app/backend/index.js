import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import authRouter from './endpoints/auth.js'
import teachersRouter from './endpoints/teachers.js'
import studentsRouter from './endpoints/students.js'
import questionnaireRouter, { apiRouter } from './endpoints/questionnaires.js'
import sessionsRouter from './endpoints/sessions.js'
import submissionsRouter from './endpoints/submissions.js'
import adminRouter from './endpoints/admin.js'
import { prisma } from './utils.js'

const app = express()

app.use(cors({
  origin: ['http://localhost:5173', 'https://questionnaire.jrcan.dev'],
  credentials: true
}))

app.use(express.json())

app.use((req, res, next) => {
  //console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

app.get('/api/status', (req, res) => res.json({ status: "OK" }))
app.get('/api/stats', async (req, res) => {
  try {
    const [teachers, students, questionnaires, sessions, submissions, openQuestionnaires, activeSessions] = await Promise.all([
      prisma.teacher.count(),
      prisma.student.count(),
      prisma.questionnaire.count(),
      prisma.session.count(),
      prisma.submission.count(),
      prisma.questionnaire.count({ where: { openForStudents: true } }),
      prisma.session.count({ where: { active: true } }),
    ])

    res.json({
      teachers, students, questionnaires, sessions, submissions,
      openQuestionnaires,
      activeSessions
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
})

app.use('/api/auth', authRouter)
app.use('/api', teachersRouter)
app.use('/api/students', studentsRouter)
app.use('/api/questionnaires', questionnaireRouter)
app.use('/api', apiRouter)
app.use('/api', sessionsRouter)
app.use('/api', submissionsRouter)
app.use('/api/admin', adminRouter) // Correction du chemin de montage pour le routeur admin
const PORT = 4000

;(async () => {
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))
})()
