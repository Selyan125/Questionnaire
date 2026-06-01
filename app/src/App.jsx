import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import AdminImport from './pages/AdminImport.jsx'
import QuestionManagerEditor from './pages/QuestionManagerEditor.jsx'
import QuestionnairePage from './pages/QuestionnairePage.jsx'
import StudentLanding from './pages/StudentLanding.jsx'
import QuestionnaireTake from './pages/QuestionnaireTake.jsx'
import QuestionnaireDone from './pages/QuestionnaireDone.jsx'
import QuestionnaireResults from './pages/QuestionnaireResults.jsx'
import StudentResults from './pages/StudentResults.jsx'
import ResultDetail from './pages/ResultDetail.jsx'
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
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
                <Route path="/student" element={
                    <ProtectedRoute>
                        <StudentLanding />
                    </ProtectedRoute>
                } />
                <Route path="/questionnaire/:id/take" element={
                    <ProtectedRoute>
                        <QuestionnaireTake />
                    </ProtectedRoute>
                } />
                <Route path="/questionnaire/:id/done" element={
                    <ProtectedRoute>
                        <QuestionnaireDone />
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
            </Routes>
        </BrowserRouter>
    )
}

export default App;
