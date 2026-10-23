import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { listReports, tasksInRange } from '@/lib/db'
import { KIND_LABELS, KINDS, period, periodLabel } from '@/lib/model'
import { createReport } from '../actions'

export const metadata = { title: 'Raporlar · Freewill Gündem' }

export default async function ReportsPage() {
  await requireAdmin()
  const reports = listReports()
  const numbers = new Map([...reports].sort((a, b) => a.createdAt - b.createdAt).map((r, i) => [r.id, i + 1]))

  return (
    <main className="desk">
      <header className="desk-head">
        <div>
          <h1>Raporlar</h1>
          <p>Ege Bey’e gönderilen günlük, haftalık ve aylık raporlar. Görevler seçilen döneme göre otomatik eklenir.</p>
        </div>
        <form action={createReport} className="desk-new">
          {KINDS.map((k, i) => (
            <button key={k} name="kind" value={k} className={i === 0 ? 'btn btn-red' : 'btn'}>
              Yeni {KIND_LABELS[k].toLocaleLowerCase('tr')} rapor
            </button>
          ))}
        </form>
      </header>

      {reports.length === 0 ? (
        <p className="desk-empty">Henüz rapor yok. Günün görevlerini toplamak için “Yeni günlük rapor”a basın.</p>
      ) : (
        <ol className="desk-list">
          {reports.map((r) => {
            const { from, to } = period(r.kind, r.date)
            const tasks = tasksInRange(from, to)
            const done = tasks.filter((t) => t.status === 'done').length
            return (
              <li key={r.id}>
                <span className="desk-no">Rapor {numbers.get(r.id)}</span>
                <span className="desk-date">
                  {periodLabel(r.kind, r.date)}
                  <em>
                    {KIND_LABELS[r.kind]}, {done}/{tasks.length} görev tamamlandı
                  </em>
                </span>
                <Link href={`/admin/reports/${r.id}`} className="desk-title">
                  {r.headline || <i>Başlık henüz yazılmadı</i>}
                </Link>
                <span className={r.published ? 'pill is-live' : 'pill'}>{r.published ? 'Yayında' : 'Taslak'}</span>
                <span className="desk-actions">
                  <Link href={`/admin/reports/${r.id}`}>Düzenle</Link>
                  <Link href={`/b/${r.id}`} target="_blank">
                    Raporu aç
                  </Link>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}
