import { useState, useEffect } from 'react'
import { apiFetch } from '../hooks/useApi.js'
import HistoryCard from '../components/HistoryCard.jsx'

export default function History() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/history')
      .then(setItems)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter(item =>
    item.company?.toLowerCase().includes(search.toLowerCase()) ||
    item.role?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">History</h1>

      <input
        type="text"
        placeholder="Search by company or role..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-2">📋</div>
          <div>No resumes yet. Tailor your first resume!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => <HistoryCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
