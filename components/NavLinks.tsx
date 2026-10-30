'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RESOURCES } from '@/lib/resources'

const CORE = [
  { href: '/', label: 'Overview' },
  { href: '/users', label: 'Users' },
  { href: '/media', label: 'AI media' },
  { href: '/votes', label: 'Votes' },
]

const GROUPS = [
  { title: 'Dashboard', links: CORE },
  ...['Prompts', 'Models', 'Logs', 'Access'].map((g) => ({
    title: g,
    links: RESOURCES.filter((r) => r.group === g).map((r) => ({ href: `/data/${r.key}`, label: r.title })),
  })),
]

export default function NavLinks() {
  const path = usePathname()
  return (
      <nav className="nav">
        {GROUPS.map((g) => (
            <div key={g.title} className="nav-group">
              <span className="nav-group-title">{g.title}</span>
              {g.links.map((l) => {
                const active = l.href === '/' ? path === '/' : path === l.href || path.startsWith(l.href + '/')
                return (
                    <Link key={l.href} href={l.href} className={active ? 'nav-link active' : 'nav-link'}>
                      {l.label}
                    </Link>
                )
              })}
            </div>
        ))}
      </nav>
  )
}