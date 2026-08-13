import { useEffect, useState } from 'react'
import './App.css'

type HealthStatus = {
  status: string
  timestamp: string
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<HealthStatus>
      })
      .then(setHealth)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <main className="app">
      <h1>DataShare</h1>
      <p>Vérification de la liaison front / back :</p>
      {error && <p className="status status-error">Backend injoignable — {error}</p>}
      {!error && !health && <p className="status">Appel de /api/health…</p>}
      {health && (
        <p className="status status-ok">
          Backend {health.status} — {health.timestamp}
        </p>
      )}
    </main>
  )
}

export default App
