import { useNavigate } from 'react-router-dom'
import ATSBadge from './ATSBadge.jsx'

export default function HistoryCard({ item }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/preview/${item.id}`)}
      className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold text-gray-900">{item.role || 'Unknown Role'}</div>
          <div className="text-sm text-gray-500">{item.company || 'Unknown Company'}</div>
        </div>
        <ATSBadge score={item.ats_score} />
      </div>
      <div className="flex gap-2 mt-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.intensity}</span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.model_used}</span>
        <span className="text-xs text-gray-400 ml-auto">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
