import { type Summary, type TaskType, shortDay, TYPE_COLORS, TYPE_LABELS, TYPES } from '@/lib/model'

// Pure HTML/CSS charts: render on the server and in the client preview alike.

export function TypeLegend({ counts }: { counts?: Record<TaskType, number> }) {
  return (
    <ul className="viz-legend">
      {TYPES.map((t) => (
        <li key={t}>
          <i style={{ background: TYPE_COLORS[t] }} />
          {TYPE_LABELS[t]}
          {counts && <b>{counts[t]}</b>}
        </li>
      ))}
    </ul>
  )
}

export function StatTiles({ s }: { s: Summary }) {
  return (
    <dl className="viz-tiles">
      <div className="is-hero">
        <dt>Tamamlanan görev</dt>
        <dd>{s.done}</dd>
      </div>
      {TYPES.filter((t) => s.byType[t]).map((t) => (
        <div key={t}>
          <dt>
            <i style={{ background: TYPE_COLORS[t] }} />
            {TYPE_LABELS[t]}
          </dt>
          <dd>{s.byType[t]}</dd>
        </div>
      ))}
      <div>
        <dt>Devam eden</dt>
        <dd>{s.doing}</dd>
      </div>
      <div>
        <dt>Sırada</dt>
        <dd>{s.todo}</dd>
      </div>
      {s.subTotal > 0 && (
        <div>
          <dt>Alt görev</dt>
          <dd>
            {s.subDone}
            <small>/{s.subTotal}</small>
          </dd>
        </div>
      )}
    </dl>
  )
}

// Even, so the midline tick is a whole number.
const niceMax = (n: number) => Math.max(2, Math.ceil(n / 2) * 2)

export function DailyColumns({ byDay, caption }: { byDay: Summary['byDay']; caption: string }) {
  const totals = byDay.map((d) => TYPES.reduce((n, t) => n + d.counts[t], 0))
  const max = niceMax(Math.max(0, ...totals))
  const every = Math.ceil(byDay.length / 8)
  return (
    <figure className="viz-figure">
      <figcaption>{caption}</figcaption>
      <TypeLegend />
      <div className="viz-cols">
        <div className="viz-yaxis" aria-hidden>
          <span>{max}</span>
          <span>{max / 2}</span>
          <span>0</span>
        </div>
        <div className="viz-plot">
          {byDay.map((d, i) => (
            <div
              key={d.date}
              className="viz-slot"
              title={`${shortDay(d.date)}: ${totals[i] ? TYPES.filter((t) => d.counts[t]).map((t) => `${d.counts[t]} ${TYPE_LABELS[t]}`).join(', ') : 'tamamlanan görev yok'}`}
            >
              <div className="viz-col">
                {TYPES.filter((t) => d.counts[t]).map((t) => (
                  <span key={t} style={{ height: `${(d.counts[t] / max) * 100}%`, background: TYPE_COLORS[t] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <span />
        <div className="viz-xaxis" aria-hidden>
          {byDay.map((d, i) => (
            <span key={d.date}>{i % every === 0 || i === byDay.length - 1 ? shortDay(d.date) : ''}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Gün</th>
            {TYPES.map((t) => (
              <th key={t}>{TYPE_LABELS[t]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {byDay.map((d) => (
            <tr key={d.date}>
              <th>{shortDay(d.date)}</th>
              {TYPES.map((t) => (
                <td key={t}>{d.counts[t]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function BarList({ rows, caption, empty }: { rows: [string, number][]; caption: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <figure className="viz-figure">
      <figcaption>{caption}</figcaption>
      {rows.length ? (
        <dl className="viz-bars">
          {rows.map(([label, n]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <span style={{ width: `${(n / max) * 100}%` }} />
                <b>{n}</b>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="viz-empty">{empty}</p>
      )}
    </figure>
  )
}
