import { useEffect, useRef, useState } from 'react'

export function useSSE(url, enabled = false) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const esRef = useRef(null)

  useEffect(() => {
    if (!enabled || !url) return

    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => setData(e.data)
    es.onerror = () => { setError('Connection error'); es.close() }
    es.addEventListener('done', () => { setDone(true); es.close() })

    return () => es.close()
  }, [url, enabled])

  return { data, error, done }
}
