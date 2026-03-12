import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../hooks/useApi.js'

const EMPTY_AREA = { area: '', bullets: [] }
const EMPTY_EXPERIENCE = { company: '', role: '', start_date: '', end_date: '', location: '', bullets: [], areas: [] }
const EMPTY_SKILL = { category: '', skills: [] }
const EMPTY_PROJECT = { name: '', description: '', technologies: [], bullets: [], url: '' }
const EMPTY_EDUCATION = { institution: '', degree: '', field: '', graduation_date: '', gpa: '' }
const EMPTY_CERT = { name: '', issuer: '', date: '' }

const CONTACT_LABELS = {
  website: 'Vibe coding portfolio',
}

function SectionHeader({ title, onAdd, addLabel }) {
  return (
    <div className="flex justify-between items-center mb-2">
      <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{title}</h2>
      {onAdd && (
        <button onClick={onAdd} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
          + {addLabel || 'Add'}
        </button>
      )}
    </div>
  )
}

function RemoveBtn({ onClick }) {
  return (
    <button onClick={onClick} className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0" title="Remove">
      Remove
    </button>
  )
}

function BulletList({ bullets, onChange }) {
  const addBullet = () => onChange([...bullets, ''])
  const updateBullet = (i, val) => onChange(bullets.map((b, j) => j === i ? val : b))
  const removeBullet = (i) => onChange(bullets.filter((_, j) => j !== i))

  return (
    <div className="ml-2 mt-1 space-y-1">
      {bullets.map((b, i) => (
        <div key={i} className="flex items-start gap-1">
          <span className="text-gray-400 mt-1.5 text-xs">-</span>
          <textarea
            value={b}
            onChange={e => updateBullet(i, e.target.value)}
            rows={1}
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            placeholder="Bullet point..."
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
          />
          <button onClick={() => removeBullet(i)} className="text-red-300 hover:text-red-500 text-sm mt-1">x</button>
        </div>
      ))}
      <button onClick={addBullet} className="text-xs text-blue-500 hover:text-blue-700">+ Add bullet</button>
    </div>
  )
}

function TagList({ items, onChange, placeholder }) {
  const [input, setInput] = useState('')
  const add = () => {
    const val = input.trim()
    if (val && !items.includes(val)) { onChange([...items, val]); setInput('') }
  }
  const remove = (i) => onChange(items.filter((_, j) => j !== i))

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
            {item}
            <button onClick={() => remove(i)} className="ml-1 text-gray-400 hover:text-red-500">x</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder || 'Type and press Enter'}
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={add} className="text-xs text-blue-500 px-2">Add</button>
      </div>
    </div>
  )
}

export default function ResumeEditor() {
  const [data, setData] = useState(null)
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    apiFetch('/api/resume')
      .then(res => {
        setData(res.data)
        setJsonText(JSON.stringify(res.data, null, 2))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Sync form data to JSON text when switching modes
  function switchMode() {
    if (jsonMode) {
      // Switching from JSON -> Form: parse JSON into data
      try {
        const parsed = JSON.parse(jsonText)
        setData(parsed)
        setJsonMode(false)
      } catch {
        setError('Invalid JSON — fix it before switching to Form View')
      }
    } else {
      // Switching from Form -> JSON: serialize data
      setJsonText(JSON.stringify(data, null, 2))
      setJsonMode(true)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    setError('')

    let saveData = data
    if (jsonMode) {
      try { saveData = JSON.parse(jsonText) }
      catch { setError('Invalid JSON'); setSaving(false); return }
    }

    try {
      await apiFetch('/api/resume', { method: 'PUT', body: saveData })
      setMessage('Resume saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  function handleExportJson() {
    const exportData = jsonMode ? jsonText : JSON.stringify(data, null, 2)
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'master_resume.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportJson(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        setData(parsed)
        setJsonText(JSON.stringify(parsed, null, 2))
        setMessage('JSON imported! Click Save to persist.')
        setTimeout(() => setMessage(''), 4000)
      } catch {
        setError('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Updater helpers
  const updateExp = (i, field, val) =>
    setData(d => ({ ...d, experience: d.experience.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
  const removeExp = (i) =>
    setData(d => ({ ...d, experience: d.experience.filter((_, j) => j !== i) }))

  const updateSkill = (i, field, val) =>
    setData(d => ({ ...d, skills: d.skills.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
  const removeSkill = (i) =>
    setData(d => ({ ...d, skills: d.skills.filter((_, j) => j !== i) }))

  const updateProject = (i, field, val) =>
    setData(d => ({ ...d, projects: d.projects.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
  const removeProject = (i) =>
    setData(d => ({ ...d, projects: d.projects.filter((_, j) => j !== i) }))

  const updateEdu = (i, field, val) =>
    setData(d => ({ ...d, education: d.education.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
  const removeEdu = (i) =>
    setData(d => ({ ...d, education: d.education.filter((_, j) => j !== i) }))

  const updateCert = (i, field, val) =>
    setData(d => ({ ...d, certifications: d.certifications.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
  const removeCert = (i) =>
    setData(d => ({ ...d, certifications: d.certifications.filter((_, j) => j !== i) }))

  if (loading) return <div className="p-4 text-center text-gray-500">Loading...</div>
  if (!data) return <div className="p-4 text-red-600">{error}</div>

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-xl font-bold">Master Resume</h1>
        <button onClick={switchMode} className="text-sm text-blue-600 hover:underline">
          {jsonMode ? 'Form View' : 'JSON View'}
        </button>
      </div>

      {/* Import / Export */}
      <div className="flex gap-2 mb-4">
        <button onClick={handleExportJson} className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
          Export JSON
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
          Import JSON
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJson} className="hidden" />
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded-lg text-sm mb-4">{message}</div>}

      {jsonMode ? (
        <textarea
          value={jsonText}
          onChange={e => setJsonText(e.target.value)}
          rows={30}
          className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <div className="space-y-6">

          {/* Contact */}
          <section>
            <SectionHeader title="Contact" />
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(data.contact || {}).map(key => (
                <input
                  key={key}
                  type="text"
                  placeholder={CONTACT_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1)}
                  value={data.contact[key] || ''}
                  onChange={e => setData(d => ({ ...d, contact: { ...d.contact, [key]: e.target.value } }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ))}
            </div>
          </section>

          {/* Summary */}
          <section>
            <SectionHeader title="Summary" />
            <textarea
              value={data.summary || ''}
              onChange={e => setData(d => ({ ...d, summary: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Professional summary..."
            />
          </section>

          {/* Experience */}
          <section>
            <SectionHeader title="Experience" onAdd={() => setData(d => ({ ...d, experience: [...(d.experience || []), { ...EMPTY_EXPERIENCE }] }))} addLabel="Experience" />
            <div className="space-y-4">
              {(data.experience || []).map((exp, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <input placeholder="Company" value={exp.company} onChange={e => updateExp(i, 'company', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Role" value={exp.role} onChange={e => updateExp(i, 'role', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Start Date" value={exp.start_date} onChange={e => updateExp(i, 'start_date', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="End Date" value={exp.end_date} onChange={e => updateExp(i, 'end_date', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Location" value={exp.location || ''} onChange={e => updateExp(i, 'location', e.target.value)} className="col-span-2 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <RemoveBtn onClick={() => removeExp(i)} />
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Bullet points:</div>
                  <BulletList bullets={exp.bullets || []} onChange={val => updateExp(i, 'bullets', val)} />

                  {/* Areas */}
                  <div className="mt-3 border-t border-gray-200 pt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">Areas:</span>
                      <button
                        onClick={() => updateExp(i, 'areas', [...(exp.areas || []), { area: '', bullets: [] }])}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >+ Add Area</button>
                    </div>
                    <div className="space-y-2">
                      {(exp.areas || []).map((ar, ai) => (
                        <div key={ai} className="ml-2 border-l-2 border-blue-200 pl-2">
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              placeholder="Area name"
                              value={ar.area}
                              onChange={e => {
                                const newAreas = [...(exp.areas || [])]
                                newAreas[ai] = { ...newAreas[ai], area: e.target.value }
                                updateExp(i, 'areas', newAreas)
                              }}
                              className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => updateExp(i, 'areas', (exp.areas || []).filter((_, j) => j !== ai))}
                              className="text-red-300 hover:text-red-500 text-xs"
                            >Remove</button>
                          </div>
                          <BulletList
                            bullets={ar.bullets || []}
                            onChange={val => {
                              const newAreas = [...(exp.areas || [])]
                              newAreas[ai] = { ...newAreas[ai], bullets: val }
                              updateExp(i, 'areas', newAreas)
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Skills */}
          <section>
            <SectionHeader title="Skills" onAdd={() => setData(d => ({ ...d, skills: [...(d.skills || []), { ...EMPTY_SKILL, skills: [] }] }))} addLabel="Category" />
            <div className="space-y-3">
              {(data.skills || []).map((sk, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <input placeholder="Category name" value={sk.category} onChange={e => updateSkill(i, 'category', e.target.value)} className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <RemoveBtn onClick={() => removeSkill(i)} />
                  </div>
                  <TagList items={sk.skills || []} onChange={val => updateSkill(i, 'skills', val)} placeholder="Add skill..." />
                </div>
              ))}
            </div>
          </section>

          {/* Projects */}
          <section>
            <SectionHeader title="Projects" onAdd={() => setData(d => ({ ...d, projects: [...(d.projects || []), { ...EMPTY_PROJECT, technologies: [], bullets: [] }] }))} addLabel="Project" />
            <div className="space-y-4">
              {(data.projects || []).map((proj, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <input placeholder="Project Name" value={proj.name} onChange={e => updateProject(i, 'name', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="URL" value={proj.url || ''} onChange={e => updateProject(i, 'url', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <textarea placeholder="Description" value={proj.description} onChange={e => updateProject(i, 'description', e.target.value)} rows={2} className="col-span-2 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                    </div>
                    <RemoveBtn onClick={() => removeProject(i)} />
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Technologies:</div>
                  <TagList items={proj.technologies || []} onChange={val => updateProject(i, 'technologies', val)} placeholder="Add technology..." />
                  <div className="text-xs text-gray-500 mb-1 mt-2">Bullet points:</div>
                  <BulletList bullets={proj.bullets || []} onChange={val => updateProject(i, 'bullets', val)} />
                </div>
              ))}
            </div>
          </section>

          {/* Education */}
          <section>
            <SectionHeader title="Education" onAdd={() => setData(d => ({ ...d, education: [...(d.education || []), { ...EMPTY_EDUCATION }] }))} addLabel="Education" />
            <div className="space-y-3">
              {(data.education || []).map((edu, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <input placeholder="Institution" value={edu.institution} onChange={e => updateEdu(i, 'institution', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Degree" value={edu.degree} onChange={e => updateEdu(i, 'degree', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Field" value={edu.field} onChange={e => updateEdu(i, 'field', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Graduation Date" value={edu.graduation_date} onChange={e => updateEdu(i, 'graduation_date', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="GPA (optional)" value={edu.gpa || ''} onChange={e => updateEdu(i, 'gpa', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <RemoveBtn onClick={() => removeEdu(i)} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Certifications */}
          <section>
            <SectionHeader title="Certifications" onAdd={() => setData(d => ({ ...d, certifications: [...(d.certifications || []), { ...EMPTY_CERT }] }))} addLabel="Certification" />
            <div className="space-y-3">
              {(data.certifications || []).map((cert, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <input placeholder="Name" value={cert.name} onChange={e => updateCert(i, 'name', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Issuer" value={cert.issuer} onChange={e => updateCert(i, 'issuer', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input placeholder="Date" value={cert.date} onChange={e => updateCert(i, 'date', e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <RemoveBtn onClick={() => removeCert(i)} />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Resume'}
      </button>
    </div>
  )
}
