"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok && router.push('/dashboard'))
      .catch(() => null)
  }, [router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setMsg(data.error || `Login failed (${res.status})`)
      }
    } catch (err) {
      setMsg('Network error. Is the dev server running?')
    }
  }

  return (
    <div className="row" style={{ marginTop: 40 }}>
      <div className="col">
        <div className="hero">
          <h1>Portfolio Management Dashboard</h1>
        </div>
        <p style={{ color: 'var(--muted)' }}>
          Track your assets, performance, and transaction history in one place.
        </p>
      </div>
      <div className="col">
        <div className="card">
          <h2>Sign in</h2>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 10 }}>
              <label>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button type="submit">Login</button>
            <div style={{ marginTop: 10, color: 'var(--muted)' }}>
              Demo: user@example.com / password
            </div>
            {msg && <div style={{ color: 'red', marginTop: 8 }}>{msg}</div>}
          </form>
        </div>
      </div>
    </div>
  )
}
