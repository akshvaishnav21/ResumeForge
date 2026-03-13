import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../hooks/useApi.js'

export default function Settings() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const navigate = useNavigate()

  async function handleReset() {
    setResetting(true)
    try {
      await apiFetch('/api/admin/reset', { method: 'DELETE' })
      navigate('/')
    } catch (err) {
      setError('Reset failed: ' + err.message)
      setResetting(false)
      setShowConfirm(false)
    }
  }

  useEffect(() => {
    apiFetch('/api/models/status')
      .then(setStatus)
      .catch(err => setError(err.message))
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      <section className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Model Status</h2>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        {status && (
          <div className="space-y-2">
            {Object.entries(status.models).map(([name, info]) => (
              <div key={name} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div>
                  <div className="font-medium capitalize">{name}</div>
                  <div className="text-xs text-gray-500">
                    {info.model || info.deployment || ''}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  info.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {info.available ? 'Available' : 'Not configured'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">About</h2>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600">
          <p><strong>ResumeForge</strong> v1.0.0</p>
          <p className="mt-1">AI-powered resume tailoring with 4-step pipeline: Extract → Map → Tailor → Validate</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Danger Zone</h2>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-3 rounded-lg border border-red-300 text-red-600 font-medium text-sm hover:bg-red-50 transition-colors"
          >
            Reset All Data
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700 mb-3 font-medium">This will permanently delete all history and your master resume. Are you sure?</p>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {resetting ? 'Clearing...' : 'Yes, clear everything'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={resetting}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
