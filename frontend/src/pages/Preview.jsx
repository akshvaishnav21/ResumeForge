import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../hooks/useApi.js'
import ATSBadge from '../components/ATSBadge.jsx'

function parseLines(md) {
  return md.split('\n').map((raw, i) => {
    const trimmed = raw.trimStart()
    let type = 'text'
    let headingLevel = 0
    if (!trimmed) type = 'empty'
    else if (trimmed.startsWith('#')) {
      type = 'heading'
      headingLevel = trimmed.match(/^#+/)?.[0].length || 1
    }
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) type = 'bullet'
    return { id: i, raw, text: trimmed, type, headingLevel, checked: true }
  })
}

function renderLine(text) {
  const parts = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline">$1</a>')
  return { __html: parts }
}

function rebuildRaw(line) {
  if (line.type === 'heading') {
    const hashes = '#'.repeat(line.headingLevel)
    return `${hashes} ${line.text.replace(/^#+\s*/, '')}`
  }
  if (line.type === 'bullet') {
    const content = line.text.replace(/^[-*]\s*/, '')
    return `- ${content}`
  }
  if (line.type === 'empty') return ''
  return line.text
}

function LineItem({ line, onToggle, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const { text, type, checked, headingLevel } = line

  if (type === 'empty') return <div className="h-0.5" />

  let className = 'text-xs leading-tight py-0.5 '
  let display = text
  if (type === 'heading') {
    display = text.replace(/^#+\s*/, '')
    if (headingLevel === 1) className = 'text-base font-bold mt-0 mb-0.5 '
    else if (headingLevel === 2) className = 'text-sm font-semibold border-b border-gray-200 pb-0.5 mt-2 mb-0.5 '
    else className = 'text-xs font-semibold mt-1.5 '
  } else if (type === 'bullet') {
    display = text.replace(/^[-*]\s*/, '')
  }

  function startEdit() {
    setEditText(display)
    setEditing(true)
  }

  function saveEdit() {
    onEdit(line.id, editText)
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-start gap-1.5 my-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(line.id)}
          className="mt-1 shrink-0 accent-blue-600 cursor-pointer"
          style={{ width: 13, height: 13 }}
        />
        <div className="flex-1">
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={2}
            autoFocus
            className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
              if (e.key === 'Escape') cancelEdit()
            }}
          />
          <div className="flex gap-1 mt-0.5">
            <button onClick={saveEdit} className="text-xs text-white bg-blue-600 px-2 py-0.5 rounded hover:bg-blue-700">Save</button>
            <button onClick={cancelEdit} className="text-xs text-gray-500 px-2 py-0.5 rounded hover:text-gray-700">Cancel</button>
            <span className="text-xs text-gray-400 ml-1">Enter to save, Esc to cancel</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-1.5 group ${!checked ? 'opacity-25 line-through' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(line.id)}
        className="mt-0.5 shrink-0 accent-blue-600 cursor-pointer"
        style={{ width: 13, height: 13 }}
      />
      <div className={`${className} flex-1 cursor-pointer`} onDoubleClick={startEdit} title="Double-click to edit">
        {type === 'bullet' && <span className="text-gray-400 mr-1">-</span>}
        <span dangerouslySetInnerHTML={renderLine(display)} />
      </div>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 text-xs shrink-0 transition-opacity"
        title="Edit"
      >
        edit
      </button>
    </div>
  )
}

export default function Preview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    apiFetch(`/api/history/${id}`)
      .then(data => {
        setItem(data)
        setLines(parseLines(data.tailored_markdown))
      })
      .catch(err => setError(err.message))
  }, [id])

  function toggleLine(lineId) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId)
      if (idx === -1) return prev
      const target = prev[idx]
      const newChecked = !target.checked
      const updated = [...prev]
      updated[idx] = { ...target, checked: newChecked }
      if (target.type === 'heading') {
        for (let i = idx + 1; i < updated.length; i++) {
          const child = updated[i]
          if (child.type === 'heading' && child.headingLevel <= target.headingLevel) break
          if (child.type !== 'empty') {
            updated[i] = { ...child, checked: newChecked }
          }
        }
      }
      return updated
    })
  }

  function editLine(lineId, newText) {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l
      let updatedText
      if (l.type === 'bullet') updatedText = `- ${newText}`
      else if (l.type === 'heading') updatedText = `${'#'.repeat(l.headingLevel)} ${newText}`
      else updatedText = newText
      return { ...l, text: updatedText, raw: updatedText }
    }))
  }

  function selectAll() { setLines(prev => prev.map(l => ({ ...l, checked: true }))) }
  function deselectAll() { setLines(prev => prev.map(l => l.type !== 'empty' ? { ...l, checked: false } : l)) }

  const filteredMarkdown = useMemo(() => {
    const kept = lines.filter(l => l.checked || l.type === 'empty')
    const result = []
    for (let i = 0; i < kept.length; i++) {
      const line = kept[i]
      if (line.type === 'empty') {
        const prevReal = result.length > 0 ? result[result.length - 1] : null
        const nextReal = kept.slice(i + 1).find(l => l.type !== 'empty')
        if (prevReal && prevReal.type !== 'empty' && nextReal) result.push(line)
      } else {
        result.push(line)
      }
    }
    return result.map(l => rebuildRaw(l)).join('\n')
  }, [lines])

  const checkedCount = lines.filter(l => l.checked && l.type !== 'empty').length
  const totalCount = lines.filter(l => l.type !== 'empty').length

  async function handleSaveFiltered() {
    setSaving(true)
    setSaveMsg('')
    try {
      await apiFetch(`/api/history/${id}`, {
        method: 'PATCH',
        body: { tailored_markdown: filteredMarkdown },
      })
      setSaveMsg('Saved!')
      setItem(prev => ({ ...prev, tailored_markdown: filteredMarkdown }))
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) { setSaveMsg('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  async function handleExport(format) {
    const filename = `resume_${item.company || 'export'}_${item.role || 'tailored'}`
    try {
      const res = await fetch('/api/export-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: filteredMarkdown, filename, format }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        alert('Export failed: ' + (err.detail || res.statusText))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename.replace(/\s+/g, '_').toLowerCase()}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
  }

  if (error) return (
    <div className="p-4">
      <button onClick={() => navigate(-1)} className="text-blue-600 mb-4">← Back</button>
      <div className="text-red-600">{error}</div>
    </div>
  )

  if (!item) return (
    <div className="p-4 text-center text-gray-500">
      <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
      Loading...
    </div>
  )

  return (
    <div className="p-4">
      <button onClick={() => navigate(-1)} className="text-blue-600 mb-4 text-sm">← Back</button>

      <div className="mb-3">
        <h1 className="text-lg font-bold">{item.role || 'Tailored Resume'}</h1>
        <p className="text-gray-500 text-sm">{item.company}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <ATSBadge score={item.ats_score} />
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{item.intensity}</span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{item.model_used}</span>
      </div>

      {item.ats_feedback && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-xs mb-3">
          {item.ats_feedback}
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-gray-500">{checkedCount}/{totalCount} selected</span>
        <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Select all</button>
        <button onClick={deselectAll} className="text-xs text-blue-600 hover:underline">Deselect all</button>
        <span className="text-xs text-gray-400 ml-auto">hover to edit</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
        {lines.map(line => (
          <LineItem key={line.id} line={line} onToggle={toggleLine} onEdit={editLine} />
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleSaveFiltered}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Selected'}
        </button>
        {saveMsg && <span className="self-center text-xs text-green-600">{saveMsg}</span>}
      </div>

      <div className="flex gap-2">
        {['pdf', 'docx', 'md', 'txt'].map(fmt => (
          <button
            key={fmt}
            onClick={() => handleExport(fmt)}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors uppercase"
          >
            {fmt}
          </button>
        ))}
      </div>
    </div>
  )
}
