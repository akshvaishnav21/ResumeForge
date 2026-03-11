export async function apiFetch(path, options = {}) {
  const geminiKey = sessionStorage.getItem('gemini_api_key')
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(geminiKey ? { 'X-Gemini-Api-Key': geminiKey } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

export function setApiKey(key) {
  if (key) sessionStorage.setItem('gemini_api_key', key)
  else sessionStorage.removeItem('gemini_api_key')
}

export function getApiKey() {
  return sessionStorage.getItem('gemini_api_key') || ''
}
