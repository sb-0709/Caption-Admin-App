'use client'

import { useState, useTransition } from 'react'

export default function DeleteButton({
                                         action,
                                         label = 'Delete',
                                         message = 'Delete this caption and all of its votes? This cannot be undone.',
                                     }: {
    action: () => Promise<void | { error?: string }>
    label?: string
    message?: string
}) {
    const [pending, start] = useTransition()
    const [error, setError] = useState('')
    return (
        <div className="admin-toggle">
            <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={() => {
                    if (!confirm(message)) return
                    setError('')
                    start(async () => {
                        const res = await action()
                        if (res && res.error) setError(res.error)
                    })
                }}
            >
                {pending ? 'Deleting…' : label}
            </button>
            {error && <small className="error-text">{error}</small>}
        </div>
    )
}