import Link from 'next/link'
import { type RangeKey, RANGES } from '@/lib/model'

// Plain links and a GET form: the range lives in the URL, no client state.
export function RangePicker({ path, current, from, to }: { path: string; current: RangeKey; from: string; to: string }) {
  return (
    <div className="range">
      <nav aria-label="Tarih aralığı">
        {RANGES.map(([key, label]) => (
          <Link key={key} href={`${path}?range=${key}`} aria-current={current === key ? 'true' : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <form action={path} className="range-custom">
        <label>
          Başlangıç
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          Bitiş
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button className="btn">Göster</button>
      </form>
    </div>
  )
}
