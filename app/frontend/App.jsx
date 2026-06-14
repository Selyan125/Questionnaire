import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import QuestionManagerEditor from './pages/QuestionManagerEditor.jsx'
import QuestionnairePage from './pages/QuestionnairePage.jsx'
import QuestionnaireResults from './pages/QuestionnaireResults.jsx'
import StudentResults from './pages/StudentResults.jsx'
import ResultDetail from './pages/ResultDetail.jsx'
import TeacherSessions from './pages/TeacherSessions.jsx'
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ServerStatus from './pages/ServerStatus.jsx'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/server-status" element={<ServerStatus />} />
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                <Route path="/admin/question-manager" element={
                    <ProtectedRoute>
                        <QuestionManagerEditor />
                    </ProtectedRoute>
                } />
                <Route path="/admin/question-manager/:id" element={
                    <ProtectedRoute>
                        <QuestionManagerEditor />
                    </ProtectedRoute>
                } />
                <Route path="/questionnaire/:id" element={
                    <ProtectedRoute>
                        <QuestionnairePage />
                    </ProtectedRoute>
                } />
                <Route path="/admin/questionnaire/:id/results" element={
                    <ProtectedRoute>
                        <QuestionnaireResults />
                    </ProtectedRoute>
                } />
                <Route path="/admin/student/:id/results" element={
                    <ProtectedRoute>
                        <StudentResults />
                    </ProtectedRoute>
                } />
                <Route path="/admin/result/:id" element={
                    <ProtectedRoute>
                        <ResultDetail />
                    </ProtectedRoute>
                } />
                <Route path="/teacher-sessions" element={
                    <ProtectedRoute>
                        <TeacherSessions />
                    </ProtectedRoute>
                } />
            </Routes>
        </BrowserRouter>
    )
}

export default App;
