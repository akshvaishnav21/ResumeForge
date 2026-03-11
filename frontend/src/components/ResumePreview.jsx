import ReactMarkdown from 'react-markdown'

export default function ResumePreview({ markdown }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 prose max-w-none text-sm">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  )
}
