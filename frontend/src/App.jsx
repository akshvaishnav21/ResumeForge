import { Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Preview from './pages/Preview.jsx'
import History from './pages/History.jsx'
import ResumeEditor from './pages/ResumeEditor.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <div className="max-w-2xl mx-auto pb-20">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/preview/:id" element={<Preview />} />
        <Route path="/history" element={<History />} />
        <Route path="/resume" element={<ResumeEditor />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <Navigation />
    </div>
  )
}
