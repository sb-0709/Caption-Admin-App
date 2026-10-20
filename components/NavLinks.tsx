'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Overview', n: '01' },
  { href: '/users', label: 'Users', n: '02' },
  { href: '/media', label: 'Media', n: '03' },
  { href: '/votes', label: 'Votes', n: '04' },
]

export default function NavLinks() {
  const path = usePathname()
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href)
        return (
          <Link key={l.href} href={l.href} className={active ? 'nav-link active' : 'nav-link'}>
            <span className="nav-n">{l.n}</span>
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
