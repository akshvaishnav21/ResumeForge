import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch, setApiKey, getApiKey } from '../hooks/useApi.js'
import StepProgress from '../components/StepProgress.jsx'
import HistoryCard from '../components/HistoryCard.jsx'

const INTENSITIES = [
  { value: 'light',    label: 'Light',    desc: 'Minor keyword tweaks, structure preserved' },
  { value: 'moderate', label: 'Moderate', desc: 'Reordering + emphasized skills (recommended)' },
  { value: 'heavy',    label: 'Heavy',    desc: 'Rewrites bullets for maximum JD alignment' },
]
const MODELS = [
  { value: 'gemini', label: 'Gemini (Primary)' },
  { value: 'azure',  label: 'Azure GPT (Fallback)' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [jd, setJd] = useState('')
  const [intensity, setIntensity] = useState('moderate')
  const [model, setModel] = useState('gemini')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiKey, setApiKeyState] = useState(getApiKey())
  const [resumeReady, setResumeReady] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    apiFetch('/api/resume')
      .then(() => setResumeReady(true))
      .catch(err => {
        const msg = err.message || ''
        setResumeReady(msg.includes('404') || msg.includes('not found') ? false : true)
      })

    apiFetch('/api/history')
      .then(items => setHistory((items || []).slice(0, 3)))
      .catch(() => {})
  }, [])

  async function handleTailor() {
    if (!apiKey.trim()) {
      setError('Enter your Gemini API key to continue')
      return
    }
    if (!jd.trim()) {
      setError('Please paste a job description')
      return
    }
    if (resumeReady === false) {
      setError('Set up your master resume first (tap the Resume tab).')
      return
    }
    setLoading(true)
    setError('')

    try {
      const result = await apiFetch('/api/tailor', {
        method: 'POST',
        body: {
          job_description: jd,
          intensity,
          preferred_model: model,
          company,
          role,
        },
      })
      navigate(`/preview/${result.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ResumeForge</h1>
        <p className="text-gray-500 text-sm mt-1">AI-powered resume tailoring</p>
      </div>

      {/* Resume readiness banner */}
      {resumeReady === null && (
        <div className="h-10 bg-gray-100 animate-pulse rounded-lg mb-4" />
      )}
      {resumeReady === false && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-lg shrink-0 leading-tight">!</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Master resume not set up</p>
            <p className="text-xs text-amber-600 mt-0.5">You need to add your resume before tailoring.</p>
          </div>
          <Link
            to="/resume"
            className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors"
          >
            Set up resume
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {/* Gemini API key input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Gemini API Key</label>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Get a free key
            </a>
          </div>
          <input
            type="password"
            placeholder="Paste your API key here (AIza...)"
            value={apiKey}
            onChange={e => { setApiKeyState(e.target.value); setApiKey(e.target.value) }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Stored for this session only — cleared when you close the tab.</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Company (optional)"
            value={company}
            onChange={e => setCompany(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Role (optional)"
            value={role}
            onChange={e => setRole(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <textarea
          placeholder="Paste job description here..."
          value={jd}
          onChange={e => setJd(e.target.value)}
          rows={10}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        {/* Intensity cards */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tailoring Intensity</label>
          <div className="flex flex-col gap-2">
            {INTENSITIES.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setIntensity(value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  intensity === value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                <span className="font-medium text-sm">{label}</span>
                <span className={`block text-xs mt-0.5 ${intensity === value ? 'text-blue-100' : 'text-gray-400'}`}>
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced options (model selector) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced options
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <StepProgress active={loading} />

        <button
          onClick={handleTailor}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Tailoring...' : 'Tailor Resume'}
        </button>
      </div>

      {/* Below-the-fold: recent history */}
      {!loading && history.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent</p>
            <Link to="/history" className="text-xs text-blue-600 hover:underline">See all</Link>
          </div>
          <div className="space-y-2">
            {history.map(item => (
              <HistoryCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Below-the-fold: how it works (first-time users) */}
      {!loading && history.length === 0 && resumeReady !== null && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How it works</p>
          <div className="space-y-3">
            {[
              { n: '1', title: 'Add your master resume', desc: 'Paste your full resume into the Resume tab once.' },
              { n: '2', title: 'Paste a job description', desc: 'Copy the full JD text into the box above.' },
              { n: '3', title: 'Export in one tap',       desc: 'Download as PDF, DOCX, or Markdown.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-3 items-start">
                <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  {n}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
