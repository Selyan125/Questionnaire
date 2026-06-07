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

const app = express()

app.use(cors({
  origin: ['http://localhost:5173', 'https://questionnaire.jrcan.dev'],
  credentials: true
}))

app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api', teachersRouter)
app.use('/api/students', studentsRouter)
app.use('/api/questionnaires', questionnaireRouter)
app.use('/api', sessionsRouter)
app.use('/api', submissionsRouter)
app.use('/api', adminRouter)
app.use('/api', apiRouter)

app.get('/api/status', (req, res) => res.json({ status: "OK" }))

const PORT = 4000

;(async () => {
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))
})()
