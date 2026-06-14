import express from 'express';
import { prisma, requireAdmin, generatePassword, hashPassword } from '../utils.js';

const router = express.Router();

// Route for importing students/teachers via CSV
router.post('/import', requireAdmin, async (req, res) => {
  const { targetRole, users, isTest } = req.body;
  const results = [];

  for (const userData of users) {
    try {
      const { email, nom, prenom } = userData;
      const generatedPassword = generatePassword(); 
      const hashedPassword = await hashPassword(generatedPassword); 

      if (targetRole === 'student') {
        const existingStudent = await prisma.student.findUnique({ where: { email } });
        if (existingStudent) {
          await prisma.student.update({
            where: { id: existingStudent.id },
            data: { nom, prenom, year: userData.year, group: userData.group },
          });
          results.push({ email, status: 'updated', message: 'Étudiant mis à jour' });
        } else {
          await prisma.student.create({
            data: { email, nom, prenom, year: userData.year, group: userData.group }, // Ajout de year et group
          });
          results.push({ email, status: 'created', message: 'Étudiant créé' });
        }
      } else if (targetRole === 'teacher') {
        const existingTeacher = await prisma.teacher.findUnique({ where: { email } });
        if (existingTeacher) {
          await prisma.teacher.update({
            where: { id: existingTeacher.id },
            data: { name: nom, lastName: prenom }, 
          });
          results.push({ email, status: 'updated', message: 'Enseignant mis à jour' });
        } else {
          await prisma.teacher.create({
            data: { email, password: hashedPassword, name: nom, lastName: prenom },
          });
          results.push({ email, status: 'created', password: generatedPassword, message: 'Enseignant créé' });
        }
      } else {
        results.push({ email, status: 'error', reason: 'Rôle cible inconnu' });
      }
    } catch (e) {
      results.push({ email: userData.email, status: 'error', reason: e.message });
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
          const existingTeacher = await tx.teacher.findUnique({ where: { email: teacherData.email } });
          if (existingTeacher) {
            await tx.teacher.update({
              where: { id: existingTeacher.id },
              data: {
                name: teacherData.name,
                lastName: teacherData.lastName,
                admin: teacherData.admin,
                jury: teacherData.jury ? { connect: { id: teacherData.jury.id } } : undefined,
              },
            });
            importSummary.teachers.updated++;
          } else {
            const newPassword = generatePassword();
            const hashedPassword = await hashPassword(newPassword);
            await tx.teacher.create({
              data: {
                email: teacherData.email,
                name: teacherData.name,
                lastName: teacherData.lastName,
                password: hashedPassword,
                admin: teacherData.admin,
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
          const existingStudent = await tx.student.findUnique({ where: { email: studentData.email } });
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
                email: studentData.email,
                nom: studentData.nom,
                prenom: studentData.prenom,
                year: studentData.year, // Ajout du champ 'year'
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