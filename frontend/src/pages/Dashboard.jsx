import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../hooks/useApi.js'

const INTENSITIES = ['light', 'moderate', 'heavy']
const MODELS = [
  { value: 'gemini', label: 'Gemini (Primary)' },
  { value: 'azure', label: 'Azure GPT (Fallback)' },
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
  const [step, setStep] = useState('')

  async function handleTailor() {
    if (!jd.trim()) {
      setError('Please paste a job description')
      return
    }
    setLoading(true)
    setError('')
    setStep('Analyzing job description...')

    try {
      setStep('Tailoring resume (this takes ~60 seconds)...')
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
      setStep('')
    }
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ResumeForge</h1>
        <p className="text-gray-500 text-sm mt-1">AI-powered resume tailoring</p>
      </div>

      <div className="space-y-4">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tailoring Intensity</label>
          <div className="flex gap-2">
            {INTENSITIES.map(i => (
              <button
                key={i}
                onClick={() => setIntensity(i)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  intensity === i
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {i.charAt(0).toUpperCase() + i.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {step && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {step}
          </div>
        )}

        <button
          onClick={handleTailor}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Tailoring...' : 'Tailor Resume'}
        </button>
      </div>
    </div>
  )
}
