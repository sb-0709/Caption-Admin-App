'use client'

import { useTransition } from 'react'

export default function DeleteButton({ action, label = 'Delete' }: { action: () => Promise<void>; label?: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm('Delete this caption and all of its votes? This cannot be undone.')) {
          start(() => action())
        }
      }}
    >
      {pending ? 'Deleting…' : label}
    </button>
  )
}
