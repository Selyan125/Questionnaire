import express from 'express'
import { prisma, requireTeacher, requireAdmin, mergeQuestionnaireSettings, getQuestionnaireMembers, formatSubmissionDate, safeParseJSON } from '../utils.js'

const router = express.Router()
export const apiRouter = express.Router()

async function updateQuestionnaireSettings(id, settings) {
  const data = {}
  if (settings.gradingMode !== undefined) data.gradingMode = settings.gradingMode
  if (settings.maxScore !== undefined) data.maxScore = Number(settings.maxScore)
  if (settings.audience !== undefined) data.audience = settings.audience
  if (settings.showResults !== undefined) data.showResults = Boolean(settings.showResults)
  const ms = Number(settings.maxScore); if (!isNaN(ms)) data.maxScore = ms
  if (settings.shuffleQuestions !== undefined) data.shuffleQuestions = Boolean(settings.shuffleQuestions)
  if (settings.juryGroups !== undefined) data.juryGroups = typeof settings.juryGroups === 'string' ? settings.juryGroups : JSON.stringify(settings.juryGroups || [])
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

router.get('/export-all', requireAdmin, async (req, res) => {
  try {
    const questionnaires = await prisma.questionnaire.findMany({
      include: {
        categories: {
          include: {
            questions: {
              include: {
                elements: true
              }
            }
          }
        }
      }
    });

    const students = await prisma.student.findMany({
      select: { id: true, email: true, nom: true, prenom: true, year: true, group: true }
    });

    const teachers = await prisma.teacher.findMany({
      select: { id: true, email: true, admin: true, jury: true }
    });

    res.json({
      questionnaires: await mergeQuestionnaireSettings(questionnaires),
      students,
      teachers,
      exportDate: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'exportation globale' });
  }
});

router.get('/results/all-csv', requireAdmin, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      include: {
        student: true,
        questionnaire: true,
        teacher: { select: { name: true, lastName: true } },
        session: { include: { students: { include: { jury: true } } } }
      },
      orderBy: { submittedAt: 'desc' }
    });

    const cols = ['Nom', 'Prénom', 'Année', 'Email', 'Jury', 'Questionnaire', 'Session', 'Évaluateur', 'Note', 'Note Max', 'Date'];
    const lines = [cols.join(',')];

    submissions.forEach(s => {
      const jury = s.session?.students?.find(ss => ss.studentId === s.studentId)?.jury?.name || 'N/A';
      const evaluator = s.teacher ? `${s.teacher.name} ${s.teacher.lastName}` : 'N/A';
      lines.push([
        `"${(s.student?.nom || '').replace(/"/g, '""')}"`,
        `"${(s.student?.prenom || '').replace(/"/g, '""')}"`,
        `"${(s.student?.year || '').replace(/"/g, '""')}"`,
        `"${s.student?.email || ''}"`,
        `"${jury.replace(/"/g, '""')}"`,
        `"${(s.questionnaire?.title || '').replace(/"/g, '""')}"`,
        `"${(s.session?.name || '').replace(/"/g, '""')}"`,
        `"${evaluator.replace(/"/g, '""')}"`,
        s.score || 0,
        s.questionnaire?.maxScore || 20,
        s.submittedAt ? s.submittedAt.toISOString() : ''
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv').send(lines.join('\n'));
  } catch (err) { res.status(500).json({ error: 'Export failed' }); }
});

router.get('/', requireTeacher, async (req, res) => {
  const teacherId = Number(req.user.id);
  const questionnaires = await prisma.questionnaire.findMany({ where: req.user.admin ? {} : { sessions: { some: { active: true, juries: { some: { teacherId } } } } }, orderBy: { id: 'desc' }, include: { categories: true, sessions: { where: req.user.admin ? {} : { active: true, juries: { some: { teacherId } } }, include: { juries: { include: { jury: true, teacher: true } }, students: { include: { student: true, jury: true } } } } } })
  const formatted = questionnaires.map(q => ({ ...q, sessions: (q.sessions || []).map(s => ({ ...s, juries: s.juries.map(sj => ({ id: sj.id, juryId: sj.juryId, juryName: sj.jury.name, teacherId: sj.teacherId, teacherEmail: sj.teacher.email })), students: s.students.map(ss => ({ id: ss.id, studentId: ss.studentId, studentEmail: ss.student.email, studentNom: ss.student.nom, studentPrenom: ss.student.prenom, juryId: ss.juryId, juryName: ss.jury.name })) })) }))
  res.json(await mergeQuestionnaireSettings(formatted))
})

router.get('/:id', requireTeacher, async (req, res) => {
  const id = Number(req.params.id)
  const q = await prisma.questionnaire.findUnique({ 
    where: { id }, 
    include: { 
      categories: { 
        include: { 
          questions: { 
            orderBy: { priority: 'asc' }, 
            include: { elements: { orderBy: { priority: 'asc' } } } 
          } 
        } 
      } 
    } 
  })
  if (!q) return res.status(404).json({ error: 'Not found' })
  if (!req.user.admin) { const hasS = await prisma.session.findFirst({ where: { questionnaireId: id, active: true, juries: { some: { teacherId: Number(req.user.id) } } } }); if (!hasS) return res.status(403).json({ error: 'Accès refusé' }) }
  const m = await getQuestionnaireMembers(id); res.json({ ...(await mergeQuestionnaireSettings(q)), juryMembers: m.teachers, assignedStudents: m.students })
})

router.get('/:id/export-json', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const q = await prisma.questionnaire.findUnique({
      where: { id },
      include: { categories: { include: { questions: { include: { elements: true } } } } }
    })
    if (!q) return res.status(404).json({ error: 'Questionnaire non trouvé' })
    res.json(await mergeQuestionnaireSettings(q))
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'exportation JSON' })
  }
})

router.get('/:id/export-questions-csv', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const q = await prisma.questionnaire.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { id: 'asc' },
          include: {
            questions: {
              orderBy: { id: 'asc' },
              include: { elements: { orderBy: { priority: 'asc' } } }
            }
          }
        }
      }
    })
    if (!q) return res.status(404).json({ error: 'Questionnaire non trouvé' })

    const lines = ["categorie,titreCategorie,niveau,type,valeur,typeReponse,valeurReponse"]
    const typeMap = { 'radio': 'unique', 'checkbox': 'multiple', 'text': 'texte' }
    const evalMap = { 1: 'ajoute', 2: 'enleve', 3: 'coefficient multiplicateur', 5: 'plafond categorie' }

    q.categories.forEach((cat, catIdx) => {
      cat.questions.forEach((question) => {
        // Détermination du type de la question basé sur ses éléments pour la ligne de titre
        const firstEl = question.elements[0]
        const qType = firstEl ? (typeMap[firstEl.type] || firstEl.type) : 'unique'

        // Ligne pour le titre de la question (Niveau 0)
        lines.push([
          catIdx, // Position de la catégorie commence à 0
          `"${cat.title.replace(/"/g, '""')}"`,
          0,      // Niveau 0 pour le titre de la question
          qType,
          `"${question.title.replace(/"/g, '""')}"`, // La valeur est le titre de la question
          '',     // Pas de type de réponse pour le titre
          ''      // Pas de valeur de réponse pour le titre
        ].join(','))

        question.elements.forEach((el, elIdx) => {
          lines.push([
            catIdx,
            `"${cat.title.replace(/"/g, '""')}"`,
            elIdx + 1, // Les réponses commencent au niveau 1
            typeMap[el.type] || el.type,
            `"${el.title.replace(/"/g, '""')}"`,
            evalMap[el.evaluatingType] || 'non noté',
            el.evaluatingValue
          ].join(','))
        })
      })
    })
    res.setHeader('Content-Type', 'text/csv').send(lines.join('\n'))
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'exportation CSV' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions } = req.body
  const q = await prisma.questionnaire.create({ data: { title, openForStudents: !!openForStudents, date: new Date() } })
  await updateQuestionnaireSettings(q.id, { gradingMode: gradingMode || 'points', maxScore: maxScore ?? 20, audience: audience || 'teachers', showResults: !!showResults, shuffleQuestions: !!shuffleQuestions })
  res.status(201).json(await mergeQuestionnaireSettings(q))
})

router.put('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id); const { title, openForStudents, gradingMode, maxScore, audience, showResults, shuffleQuestions, date, juryGroups } = req.body; try { const data = {}; if (title !== undefined) data.title = title; if (openForStudents !== undefined) data.openForStudents = !!openForStudents; if (date) { const d = new Date(date); if (!isNaN(d.getTime())) data.date = d }; if (juryGroups !== undefined) data.juryGroups = typeof juryGroups === 'string' ? juryGroups : JSON.stringify(juryGroups); const u = Object.keys(data).length ? await prisma.questionnaire.update({ where: { id }, data }) : await prisma.questionnaire.findUnique({ where: { id } }); await updateQuestionnaireSettings(id, { gradingMode, maxScore, audience, showResults, shuffleQuestions }); res.json(await mergeQuestionnaireSettings(u)) } catch { res.status(500).json({ error: 'Internal error' }) }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id); try { await prisma.$transaction(async (tx) => { const cats = await tx.questionCategory.findMany({ where: { questionnaireId: id }, select: { id: true } }); const catIds = cats.map(c => c.id); if (catIds.length) { const qs = await tx.question.findMany({ where: { questionCategoryId: { in: catIds } }, select: { id: true } }); const qIds = qs.map(q => q.id); if (qIds.length) await tx.questionElement.deleteMany({ where: { questionId: { in: qIds } } }); await tx.question.deleteMany({ where: { questionCategoryId: { in: catIds } } }); await tx.questionCategory.deleteMany({ where: { questionnaireId: id } }) }; await tx.questionnaire.delete({ where: { id } }) }); res.status(204).end() } catch (err) { if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' }); res.status(409).json({ error: 'Could not delete' }) }
})

router.put('/:id/jury', requireAdmin, async (req, res) => {
  try { const id = Number(req.params.id); const { teacherIds, studentIds } = req.body; await replaceQuestionnaireMembers(id, teacherIds || [], studentIds || []); res.json(await getQuestionnaireMembers(id)) } catch { res.status(500).json({ error: 'Could not update jury' }) }
})

// Route unifiée pour la duplication (supporte /:id/duplicate et /duplicate/:id pour plus de flexibilité avec le frontend)
const handleDuplication = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'ID de questionnaire invalide' })

    console.log(`[Questionnaire] Duplicating from ID: ${id}`)
    const original = await prisma.questionnaire.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            questions: {
              include: {
                elements: true
              }
            }
          }
        }
      }
    })
    if (!original) {
      console.warn(`[Questionnaire] Duplication failed: Questionnaire ${id} not found`)
      return res.status(404).json({ error: 'Questionnaire non trouvé' })
    }

    const duplicated = await prisma.questionnaire.create({
      data: {
        title: `${original.title} (Copie)`,
        openForStudents: false,
        date: new Date(),
        gradingMode: original.gradingMode,
        maxScore: original.maxScore,
        audience: original.audience,
        showResults: original.showResults,
        shuffleQuestions: original.shuffleQuestions,
        juryGroups: original.juryGroups,
        categories: {
          create: original.categories.map(cat => ({
            title: cat.title,
            currentNote: cat.currentNote,
            questions: {
              create: cat.questions.map(q => ({
                title: q.title,
                elements: {
                  create: q.elements.map(el => ({
                    type: el.type,
                    title: el.title,
                    priority: el.priority,
                    evaluatingType: el.evaluatingType,
                    evaluatingValue: el.evaluatingValue
                  }))
                }
              }))
            }
          }))
        }
      }
    })
    const result = await mergeQuestionnaireSettings(duplicated)
    res.status(201).json(result)
  } catch (error) {
    console.error('[Duplication Error]', error)
    res.status(500).json({ error: 'Erreur lors de la duplication' })
  }
}

router.post('/import', requireAdmin, async (req, res) => {
  try {
    const qData = req.body
    console.log(`[Questionnaire] Importing/Duplicating via POST /import: ${qData.title}`)

    const duplicated = await prisma.questionnaire.create({
      data: {
        title: qData.title.includes('(Copie)') ? qData.title : `${qData.title} (Copie)`,
        openForStudents: false,
        date: new Date(),
        gradingMode: qData.gradingMode || 'points',
        maxScore: Number(qData.maxScore) || 20,
        audience: qData.audience || 'teachers',
        showResults: !!qData.showResults,
        shuffleQuestions: !!qData.shuffleQuestions,
        juryGroups: typeof qData.juryGroups === 'object' ? JSON.stringify(qData.juryGroups) : qData.juryGroups,
        categories: {
          create: (qData.categories || []).map(cat => ({
            title: cat.title,
            currentNote: cat.currentNote || 0,
            questions: {
              create: (cat.questions || []).map(q => ({
                title: q.title,
                elements: {
                  create: (q.elements || []).map(el => ({
                    type: el.type,
                    title: el.title,
                    priority: el.priority || 0,
                    evaluatingType: el.evaluatingType || 0,
                    evaluatingValue: el.evaluatingValue || 0
                  }))
                }
              }))
            }
          }))
        }
      }
    })
    res.status(201).json(await mergeQuestionnaireSettings(duplicated))
  } catch (error) {
    console.error('[Import Error]', error)
    res.status(500).json({ error: 'Erreur lors de l\'importation/duplication' })
  }
})

router.post('/import-questions-csv', requireAdmin, async (req, res) => {
  try {
    const { csv, questionnaireId, config } = req.body
    let targetId = questionnaireId

    // Si aucun ID n'est fourni, on crée un nouveau questionnaire
    if (!targetId) {
      const q = await prisma.questionnaire.create({
        data: {
          title: config?.title || 'Import CSV',
          openForStudents: false,
          date: new Date(),
          gradingMode: config?.gradingMode || 'points',
          maxScore: Number(config?.maxScore) || 20,
        }
      })
      targetId = q.id
    }

    const lines = csv.split(/\r?\n/).filter(l => l.trim()).slice(1) // On saute l'en-tête
    const typeMap = { 'unique': 'radio', 'multiple': 'checkbox', 'texte': 'text' }
    const evalMap = { 'ajoute': 1, 'enleve': 2, 'coefficient multiplicateur': 3, 'plafond categorie': 5 }

    const categoriesMap = new Map()

    for (const line of lines) {
      // Parsing CSV gérant les guillemets
      const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',')
      const [catIdx, catTitle, level, type, value, respType, respVal] = parts.map(p => p.trim().replace(/^"|"$/g, ''))
      
      const cIdx = parseInt(catIdx)
      if (isNaN(cIdx)) continue

      if (!categoriesMap.has(cIdx)) {
        categoriesMap.set(cIdx, { title: catTitle, questions: [] })
      }
      const cat = categoriesMap.get(cIdx)

      if (parseInt(level) === 0) {
        cat.questions.push({ title: value, elements: [], type: typeMap[type] || 'radio' })
      } else if (cat.questions.length > 0) {
        const q = cat.questions[cat.questions.length - 1]
        q.elements.push({
          title: value,
          type: typeMap[type] || q.type,
          evaluatingType: evalMap[respType] || 0,
          evaluatingValue: parseFloat(respVal) || 0,
          priority: q.elements.length
        })
      }
    }

    // Création en base de données via transaction
    await prisma.$transaction(async (tx) => {
      const sortedIndices = Array.from(categoriesMap.keys()).sort((a, b) => a - b)
      for (const idx of sortedIndices) {
        const catData = categoriesMap.get(idx)
        const category = await tx.questionCategory.create({
        data: { title: catData.title, questionnaireId: Number(targetId), currentNote: 0 } // Ajout de currentNote
        })

        for (const qData of catData.questions) {
          const question = await tx.question.create({
            data: { title: qData.title, questionCategoryId: category.id }
          })
          if (qData.elements.length > 0) {
            await tx.questionElement.createMany({
              data: qData.elements.map(el => ({ ...el, questionId: question.id }))
            })
          }
        }
      }
    })

    res.json({ success: true, questionnaireId: targetId })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erreur lors de l\'importation CSV des questions' })
  }
})

router.post('/:id/duplicate', requireAdmin, handleDuplication)
router.post('/duplicate/:id', requireAdmin, handleDuplication)

router.get('/:id/results', requireTeacher, async (req, res) => {
  try {
    const qid = Number(req.params.id);
    const submissions = await prisma.submission.findMany({
      where: { questionnaireId: qid },
      include: {
        student: {
          select: { id: true, email: true, nom: true, prenom: true, year: true, group: true } // Inclure year et group
        },
        teacher: { select: { name: true, lastName: true, email: true } }, // L'évaluateur
        session: {
          select: { id: true, name: true, date: true, students: { include: { jury: { include: { teachers: { select: { name: true, lastName: true } } } } } } } // Pour retrouver le jury de l'étudiant
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    res.json(submissions.map(s => ({
      id: s.id,
      studentId: s.studentId,
      student: s.student ? { id: s.student.id, email: s.student.email, nom: s.student.nom, prenom: s.student.prenom, year: s.student.year, group: s.student.group } : null,
      email: s.student?.email || null,
      answers: safeParseJSON(s.answers) || [],
      submittedAt: formatSubmissionDate(s.submittedAt),
      sessionName: s.session?.name || 'Hors session', // Récupérer le nom de la session directement
      sessionId: s.session?.id || null,
      evaluator: s.teacher ? `${s.teacher.name} ${s.teacher.lastName}` : 'N/A',
      juryName: s.session?.students?.find(ss => ss.studentId === s.studentId)?.jury?.name || 'Inconnu',
      juryTeachers: s.session?.students?.find(ss => ss.studentId === s.studentId)?.jury?.teachers?.map(t => `${t.name} ${t.lastName}`) || [],
      score: s.score || 0
    })));
  } catch (error) {
    console.error("Error fetching questionnaire results:", error);
    res.status(500).json({ error: 'Could not fetch results', details: error.message });
  }
})

apiRouter.post('/questionnaires/:id/categories', requireAdmin, async (req, res) => { res.status(201).json(await prisma.questionCategory.create({ data: { title: req.body.title, currentNote: req.body.currentNote || 0, questionnaireId: Number(req.params.id) } })) })
apiRouter.put('/categories/:id', requireAdmin, async (req, res) => { res.json(await prisma.questionCategory.update({ where: { id: Number(req.params.id) }, data: { title: req.body.title, currentNote: req.body.currentNote } })) })
apiRouter.delete('/categories/:id', requireAdmin, async (req, res) => { const id = Number(req.params.id); await prisma.$transaction(async (tx) => { const qs = await tx.question.findMany({ where: { questionCategoryId: id }, select: { id: true } }); for (const q of qs) await tx.questionElement.deleteMany({ where: { questionId: q.id } }); await tx.question.deleteMany({ where: { questionCategoryId: id } }); await tx.questionCategory.delete({ where: { id } }); }); res.status(204).end() })

apiRouter.post('/questions/:id/duplicate', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const orig = await prisma.question.findUnique({ where: { id }, include: { elements: true } });
    if (!orig) return res.status(404).json({ error: 'Question non trouvée' });
    const maxP = await prisma.question.findFirst({ where: { questionCategoryId: orig.questionCategoryId }, orderBy: { priority: 'desc' } });
    const duplicated = await prisma.question.create({
      data: {
        title: `${orig.title} (Copie)`,
        questionCategoryId: orig.questionCategoryId,
        priority: (maxP?.priority || 0) + 1,
        elements: { create: orig.elements.map(el => ({ type: el.type, title: el.title, priority: el.priority, evaluatingType: el.evaluatingType, evaluatingValue: el.evaluatingValue })) }
      }
    });
    res.status(201).json(duplicated);
  } catch (error) { 
    console.error('[Duplicate Error]', error);
    res.status(500).json({ error: 'Erreur lors de la duplication', details: error.message }); 
  }
});

apiRouter.put('/categories/:id/questions/reorder', requireAdmin, async (req, res) => {
  try {
    const { questionIds } = req.body;
    if (!Array.isArray(questionIds)) return res.status(400).json({ error: 'questionIds doit être un tableau' });
    
    // On utilise une transaction pour garantir la cohérence
    await prisma.$transaction(
      questionIds.map((id, idx) => 
        prisma.question.update({ 
          where: { id: Number(id) }, 
          data: { priority: idx } 
        })
      )
    );
    res.json({ success: true });
  } catch (error) { 
    console.error('[Reorder Error]', error);
    res.status(500).json({ error: 'Erreur réordonnancement. Vérifiez que le champ "priority" existe dans la base.', details: error.message }); 
  }
});

apiRouter.put('/questions/:id/move', requireAdmin, async (req, res) => {
  try {
    const { newCategoryId, newPriority } = req.body;
    const updated = await prisma.question.update({ where: { id: Number(req.params.id) }, data: { questionCategoryId: Number(newCategoryId), priority: newPriority !== undefined ? Number(newPriority) : undefined } });
    res.json(updated);
  } catch (error) { 
    console.error('[Move Error]', error);
    res.status(500).json({ error: 'Erreur lors du déplacement', details: error.message }); 
  }
});

apiRouter.post('/categories/:id/questions', requireAdmin, async (req, res) => { res.status(201).json(await prisma.question.create({ data: { title: req.body.title, questionCategoryId: Number(req.params.id) } })) })
apiRouter.put('/questions/:id', requireAdmin, async (req, res) => { const { title, questionCategoryId } = req.body; const data = { title }; const cid = Number(questionCategoryId); if (!isNaN(cid)) data.questionCategoryId = cid; res.json(await prisma.question.update({ where: { id: Number(req.params.id) }, data })) })
apiRouter.delete('/questions/:id', requireAdmin, async (req, res) => { await prisma.questionElement.deleteMany({ where: { questionId: Number(req.params.id) } }); await prisma.question.delete({ where: { id: Number(req.params.id) } }); res.status(204).end() })
apiRouter.post('/questions/:id/elements', requireAdmin, async (req, res) => { res.status(201).json(await prisma.questionElement.create({ data: { type: req.body.type, title: req.body.title, priority: req.body.priority || 0, evaluatingType: req.body.evaluatingType || 0, evaluatingValue: req.body.evaluatingValue || 0, questionId: Number(req.params.id) } })) })
apiRouter.put('/elements/:id', requireAdmin, async (req, res) => { res.json(await prisma.questionElement.update({ where: { id: Number(req.params.id) }, data: { type: req.body.type, title: req.body.title, priority: req.body.priority, evaluatingType: req.body.evaluatingType, evaluatingValue: req.body.evaluatingValue } })) })
apiRouter.delete('/elements/:id', requireAdmin, async (req, res) => { await prisma.questionElement.delete({ where: { id: Number(req.params.id) } }); res.status(204).end() })

export default router