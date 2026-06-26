import express from 'express';
import { prisma, requireAdmin, generatePassword, hashPassword, normalizeEmail } from '../utils.js';

const router = express.Router();
// Route for importing students/teachers via CSV
router.post('/import', requireAdmin, async (req, res) => {
  const { targetRole, users, isTest } = req.body;
  const results = [];

  for (const userData of users) {
    try {
      let { email, nom, prenom } = userData;
      const normalized = normalizeEmail(email);
      const isMissing = !normalized || normalized === 'n/a';
      
      let existing = null;
      if (!isMissing) {
        if (targetRole === 'student') existing = await prisma.student.findUnique({ where: { email: normalized } });
        else if (targetRole === 'teacher') existing = await prisma.teacher.findUnique({ where: { email: normalized } });
      }

      const generatedPassword = generatePassword(); 
      const hashedPassword = await hashPassword(generatedPassword); 

      if (targetRole === 'student') {
        if (existing) {
          await prisma.student.update({
            where: { id: existing.id },
            data: { nom, prenom, year: userData.year, group: userData.group },
          });
          results.push({ email: (existing.email && !existing.email.includes('_')) ? existing.email : '', status: 'updated', input: userData, message: 'Étudiant mis à jour' });
        } else {
          const finalEmail = isMissing ? `student_${Date.now()}_${Math.floor(Math.random() * 1000)}` : normalized;
          await prisma.student.create({
            data: { 
              email: finalEmail, 
              nom, prenom, year: userData.year, group: userData.group 
            },
          });
          results.push({ email: (finalEmail && !finalEmail.includes('_')) ? finalEmail : '', status: 'created', input: userData, message: 'Étudiant créé' });
        }
      } else if (targetRole === 'teacher') {
        if (existing) {
          await prisma.teacher.update({
            where: { id: existing.id },
            data: { name: prenom, lastName: nom },
          });
          results.push({ email: (existing.email && !existing.email.includes('_')) ? existing.email : '', status: 'updated', input: userData, message: 'Enseignant mis à jour' });
        } else {
          const finalEmail = isMissing ? `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}` : normalized;
          await prisma.teacher.create({
            data: { 
              email: finalEmail, 
              password: hashedPassword, name: prenom, lastName: nom 
            },
          });
          results.push({ email: (finalEmail && !finalEmail.includes('_')) ? finalEmail : '', status: 'created', password: generatedPassword, input: userData, message: 'Enseignant créé' });
        }
      } else {
        results.push({ email: email || '', status: 'error', input: userData, reason: 'Rôle cible inconnu' });
      }
    } catch (e) {
      results.push({ email: userData.email || '', status: 'error', input: userData, reason: e.message });
    }
  }
  res.status(200).json({ results });
});

router.post('/import-all', requireAdmin, async (req, res) => {
  const { questionnaires, students, teachers } = req.body;
  const importSummary = {
    questionnaires: { created: 0, updated: 0, errors: [] },
    students: { created: 0, updated: 0, errors: [] },
    teachers: { created: 0, updated: 0, errors: [] },
  };

  try {
    await prisma.$transaction(async (tx) => {
      // Import Teachers
      for (const teacherData of teachers) {
        try {
          const teacherEmail = normalizeEmail(teacherData.email) || `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const existingTeacher = await tx.teacher.findUnique({ where: { email: teacherEmail } });
          if (existingTeacher) {
            await tx.teacher.update({
              where: { id: existingTeacher.id },
              data: {
                name: teacherData.name,
                lastName: teacherData.lastName,
                jury: teacherData.jury ? { connect: { id: teacherData.jury.id } } : undefined,
              },
            });
            importSummary.teachers.updated++;
          } else {
            const newPassword = generatePassword();
            const hashedPassword = await hashPassword(newPassword);
            await tx.teacher.create({
              data: {
                email: teacherEmail,
                name: teacherData.name,
                lastName: teacherData.lastName,
                password: hashedPassword,
                jury: teacherData.jury ? { connect: { id: teacherData.jury.id } } : undefined,
              },
            });
            importSummary.teachers.created++;
          }
        } catch (e) {
          importSummary.teachers.errors.push({ email: teacherData.email, error: e.message });
        }
      }

      // Import Students
      for (const studentData of students) {
        try {
          const studentEmail = normalizeEmail(studentData.email) || `student_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const existingStudent = await tx.student.findUnique({ where: { email: studentEmail } });
          if (existingStudent) {
            await tx.student.update({
              where: { id: existingStudent.id },
              data: {
                nom: studentData.nom,
                prenom: studentData.prenom,
                year: studentData.year,
                group: studentData.group,
              },
            });
            importSummary.students.updated++;
          } else {
            await tx.student.create({
              data: {
                email: studentEmail,
                nom: studentData.nom,
                prenom: studentData.prenom,
                year: studentData.year,
                group: studentData.group,
              },
            });
            importSummary.students.created++;
          }
        } catch (e) {
          importSummary.students.errors.push({ email: studentData.email, error: e.message });
        }
      }

      // Import Questionnaires
      for (const qData of questionnaires) {
        try {
          let questionnaireId;
          const existingQuestionnaire = await tx.questionnaire.findFirst({ where: { title: qData.title } });
          if (existingQuestionnaire) {
            questionnaireId = existingQuestionnaire.id;
            await tx.questionnaire.update({
              where: { id: questionnaireId },
              data: {
                title: qData.title,
                openForStudents: qData.openForStudents,
                gradingMode: qData.gradingMode,
                maxScore: qData.maxScore,
                audience: qData.audience,
                showResults: qData.showResults,
                shuffleQuestions: qData.shuffleQuestions,
                date: qData.date ? new Date(qData.date) : null,
                juryGroups: typeof qData.juryGroups === 'object' ? JSON.stringify(qData.juryGroups) : qData.juryGroups,
                // Removed 'sessions' assignment because it is a relation (Session[]) in schema.prisma
              },
            });
            importSummary.questionnaires.updated++;
            // Delete and re-create nested categories, questions, elements for simplicity
            await tx.questionElement.deleteMany({ where: { question: { category: { questionnaireId: questionnaireId } } } });
            await tx.question.deleteMany({ where: { category: { questionnaireId: questionnaireId } } });
            await tx.questionCategory.deleteMany({ where: { questionnaireId: questionnaireId } });
          } else {
            const newQuestionnaire = await tx.questionnaire.create({
              data: {
                title: qData.title,
                openForStudents: qData.openForStudents,
                gradingMode: qData.gradingMode,
                maxScore: qData.maxScore,
                audience: qData.audience,
                showResults: qData.showResults,
                shuffleQuestions: qData.shuffleQuestions,
                date: qData.date ? new Date(qData.date) : null,
                juryGroups: typeof qData.juryGroups === 'object' ? JSON.stringify(qData.juryGroups) : qData.juryGroups,
                // Removed 'sessions' assignment because it is a relation (Session[]) in schema.prisma
              },
            });
            questionnaireId = newQuestionnaire.id;
            importSummary.questionnaires.created++;
          }

          // Import Categories, Questions, Elements
          for (const catData of qData.categories) {
            const newCategory = await tx.questionCategory.create({
              data: {
                title: catData.title,
                currentNote: catData.currentNote,
                questionnaireId: questionnaireId,
              },
            });
            for (const qItemData of catData.questions) {
              const newQuestion = await tx.question.create({
                data: {
                  title: qItemData.title,
                  questionCategoryId: newCategory.id,
                },
              });
              for (const elData of qItemData.elements) {
                await tx.questionElement.create({
                  data: {
                    type: elData.type,
                    title: elData.title,
                    priority: elData.priority,
                    evaluatingType: elData.evaluatingType,
                    evaluatingValue: elData.evaluatingValue,
                    questionId: newQuestion.id,
                  },
                });
              }
            }
          }
        } catch (e) {
          importSummary.questionnaires.errors.push({ title: qData.title, error: e.message });
        }
      }
    });

    res.status(200).json({ message: 'Importation complète réussie', summary: importSummary });
  } catch (err) {
    console.error('Global import transaction failed:', err);
    res.status(500).json({ error: 'Erreur lors de l\'importation globale', details: err.message, summary: importSummary });
  }
});

export default router;