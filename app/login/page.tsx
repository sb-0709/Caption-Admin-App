'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    setLoading(true)
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  return (
    <main className="gate">
      <div className="gate-card">
        <p className="eyebrow">Restricted · Staff only</p>
        <h1 className="gate-title">
          The Caption <em>Ledger</em>
        </h1>
        <p className="gate-copy">
          The back office for the caption rating app. Sign in with a Google account that has
          superadmin access.
        </p>
        <button className="btn btn-primary btn-wide" onClick={signIn} disabled={loading}>
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </main>
  )
}
