import { requireAdmin } from '@/lib/auth'
import { tasksInRange } from '@/lib/db'
import { periodLabel, resolveRange, summarize, TYPE_LABELS, TYPES } from '@/lib/model'
import { BarList, DailyColumns, StatTiles } from '@/components/Charts'
import { RangePicker } from '@/components/RangePicker'

export const metadata = { title: 'Metrikler · Freewill Gündem' }

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> }

export default async function MetricsPage({ searchParams }: Props) {
  await requireAdmin()
  const { key, from, to } = resolveRange(await searchParams, '30')
  const tasks = tasksInRange(from, to)
  const s = summarize(tasks, from, to)
  const open = new Map<string, number>()
  for (const t of tasks) if (t.status !== 'done') open.set(t.app || 'Genel', (open.get(t.app || 'Genel') ?? 0) + 1)
  const dayCount = s.byDay.length
  const perDay = dayCount ? (s.done / dayCount).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '0'
  const bugShare = s.done ? Math.round((s.byType.bug / s.done) * 100) : 0

  return (
    <main className="desk">
      <header className="desk-head">
        <div>
          <h1>Metrikler</h1>
          <p>
            {periodLabel('gunluk', from)} – {periodLabel('gunluk', to)}. Günde ortalama {perDay} görev tamamlandı; tamamlananların %{bugShare}’i
            bug düzeltmesi.
          </p>
        </div>
      </header>
      <RangePicker path="/admin/metrics" current={key} from={from} to={to} />

      <div className="metrics">
        <section className="card">
          <StatTiles s={s} />
        </section>
        <section className="card">
          <DailyColumns byDay={s.byDay} caption="Günlere göre tamamlanan görevler" />
        </section>
        <div className="metrics-grid">
          <section className="card">
            <BarList rows={s.byApp} caption="Uygulamalara göre tamamlanan" empty="Bu aralıkta tamamlanan görev yok." />
          </section>
          <section className="card">
            <BarList rows={s.byPerson} caption="Kişilere göre tamamlanan" empty="Tamamlanan görevlere kişi atanmamış." />
          </section>
          <section className="card">
            <BarList
              rows={TYPES.map((t) => [TYPE_LABELS[t], s.byType[t]] as [string, number]).filter((r) => r[1])}
              caption="Türlere göre tamamlanan"
              empty="Bu aralıkta tamamlanan görev yok."
            />
          </section>
          <section className="card">
            <BarList
              rows={[...open].sort((a, b) => b[1] - a[1])}
              caption="Uygulamalara göre açık görevler"
              empty="Açık görev yok."
            />
          </section>
        </div>
      </div>
    </main>
  )
}
