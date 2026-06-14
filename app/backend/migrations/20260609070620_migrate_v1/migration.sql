-- CreateTable
CREATE TABLE "jury" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "jury" TEXT,
    "juryId" INTEGER,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Teacher_juryId_fkey" FOREIGN KEY ("juryId") REFERENCES "jury" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT,
    "prenom" TEXT,
    "assignedJury" TEXT,
    "juryId" INTEGER,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Student_juryId_fkey" FOREIGN KEY ("juryId") REFERENCES "jury" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openForStudents" BOOLEAN NOT NULL DEFAULT false,
    "gradingMode" TEXT NOT NULL DEFAULT 'points',
    "maxScore" REAL NOT NULL DEFAULT 20,
    "audience" TEXT NOT NULL DEFAULT 'teachers',
    "showResults" BOOLEAN NOT NULL DEFAULT false,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "juryGroups" TEXT
);

-- CreateTable
CREATE TABLE "QuestionnaireJuryMember" (
    "questionnaireId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,

    PRIMARY KEY ("questionnaireId", "teacherId"),
    CONSTRAINT "QuestionnaireJuryMember_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionnaireJuryMember_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionnaireStudentMember" (
    "questionnaireId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,

    PRIMARY KEY ("questionnaireId", "studentId"),
    CONSTRAINT "QuestionnaireStudentMember_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionnaireStudentMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "date" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "questionnaireId" INTEGER NOT NULL,
    CONSTRAINT "Session_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionJury" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "juryId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    CONSTRAINT "SessionJury_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionJury_juryId_fkey" FOREIGN KEY ("juryId") REFERENCES "jury" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionJury_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionStudent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "juryId" INTEGER NOT NULL,
    CONSTRAINT "SessionStudent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionStudent_juryId_fkey" FOREIGN KEY ("juryId") REFERENCES "jury" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "questionnaireId" INTEGER NOT NULL,
    "currentNote" REAL NOT NULL,
    CONSTRAINT "QuestionCategory_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "questionCategoryId" INTEGER NOT NULL,
    CONSTRAINT "Question_questionCategoryId_fkey" FOREIGN KEY ("questionCategoryId") REFERENCES "QuestionCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionElement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "evaluatingType" INTEGER NOT NULL,
    "evaluatingValue" REAL NOT NULL,
    CONSTRAINT "QuestionElement_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "questionnaireId" INTEGER NOT NULL,
    "studentId" INTEGER,
    "answers" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Session_questionnaireId_idx" ON "Session"("questionnaireId");

-- CreateIndex
CREATE INDEX "SessionJury_sessionId_idx" ON "SessionJury"("sessionId");

-- CreateIndex
CREATE INDEX "SessionJury_juryId_idx" ON "SessionJury"("juryId");

-- CreateIndex
CREATE INDEX "SessionJury_teacherId_idx" ON "SessionJury"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionJury_sessionId_teacherId_key" ON "SessionJury"("sessionId", "teacherId");

-- CreateIndex
CREATE INDEX "SessionStudent_sessionId_idx" ON "SessionStudent"("sessionId");

-- CreateIndex
CREATE INDEX "SessionStudent_studentId_idx" ON "SessionStudent"("studentId");

-- CreateIndex
CREATE INDEX "SessionStudent_juryId_idx" ON "SessionStudent"("juryId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionStudent_sessionId_studentId_key" ON "SessionStudent"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "Submission_questionnaireId_idx" ON "Submission"("questionnaireId");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");
