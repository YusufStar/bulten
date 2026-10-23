'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Raporlar', match: (p: string) => p === '/admin' || p.startsWith('/admin/reports') },
  { href: '/admin/tasks', label: 'Görevler', match: (p: string) => p.startsWith('/admin/tasks') },
  { href: '/admin/metrics', label: 'Metrikler', match: (p: string) => p.startsWith('/admin/metrics') },
  { href: '/admin/people', label: 'Çalışanlar', match: (p: string) => p.startsWith('/admin/people') },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <nav className="nav-links" aria-label="Yönetim">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.match(path) ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
