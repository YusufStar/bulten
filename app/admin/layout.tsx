import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { AdminNav } from '@/components/AdminNav'
import { logout } from '../actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <>
      <header className="nav">
        <Link href="/admin" className="np-logo is-small" aria-label="Freewill Gündem yönetim">
          <small>freewill</small>
          <b>GÜNDEM</b>
        </Link>
        <AdminNav />
        <form action={logout} className="nav-out">
          <button className="btn btn-quiet">Çıkış</button>
        </form>
      </header>
      {children}
    </>
  )
}
