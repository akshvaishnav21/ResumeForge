export default function ATSBadge({ score }) {
  if (score === null || score === undefined) return null

  const color = score >= 80 ? 'bg-green-100 text-green-800 border-green-300'
    : score >= 60 ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
    : 'bg-red-100 text-red-800 border-red-300'

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
      ATS Score: {score}%
    </span>
  )
}
