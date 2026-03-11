import { useState, useEffect } from 'react'

export function useMarkdown(file: string) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`/content/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`)
        return res.text()
      })
      .then((text) => {
        setContent(text)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [file])

  return { content, loading, error }
}
