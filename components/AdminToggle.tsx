'use client'

import { useState, useTransition } from 'react'
import { setSuperadmin } from '@/app/(admin)/users/actions'

export default function AdminToggle({
                                        userId,
                                        name,
                                        isAdmin,
                                        isSelf,
                                    }: {
    userId: string
    name: string
    isAdmin: boolean
    isSelf: boolean
}) {
    const [pending, start] = useTransition()
    const [error, setError] = useState('')

    if (isSelf) return <span className="muted small-text">You</span>

    const onClick = () => {
        const msg = isAdmin
            ? `Remove superadmin access from ${name}? They will be locked out of this panel.`
            : `Make ${name} a superadmin? They will be able to see all users and edit or delete any caption.`
        if (!confirm(msg)) return
        setError('')
        start(async () => {
            const res = await setSuperadmin(userId, !isAdmin)
            if (res.error) setError(res.error)
        })
    }

    return (
        <div className="admin-toggle">
            <button
                type="button"
                className={isAdmin ? 'btn btn-sm' : 'btn btn-sm btn-primary'}
                onClick={onClick}
                disabled={pending}
            >
                {pending ? 'Saving…' : isAdmin ? 'Remove admin' : 'Make admin'}
            </button>
            {error && <small className="error-text">{error}</small>}
        </div>
    )
}