import { Fragment } from 'react'
import {
  type Article, type ReportData, type Status, type Task, KIND_LABELS, period, periodLabel, STATUS_LABELS, summarize,
  TYPE_COLORS, TYPE_LABELS,
} from '@/lib/model'
import { BarList, DailyColumns, StatTiles } from './Charts'

// Pure render: used by the public page (server) and by the report editor's live preview (client).

type Block = { app: string; article?: Article; tasks: Task[] }

const ORDER: Status[] = ['done', 'doing', 'todo']
const GROUP_TITLES: Record<Status, string> = { done: 'Tamamlananlar', doing: 'Devam edenler', todo: 'Sıradakiler' }
const anchor = (app: string) => `app-${encodeURIComponent(app.toLocaleLowerCase('tr').replace(/\s+/g, '-'))}`
const countDone = (ts: Task[]) => ts.filter((t) => t.status === 'done').length

function arrange(report: ReportData, tasks: Task[]): Block[] {
  const groups = new Map<string, Task[]>()
  for (const t of tasks) groups.set(t.app || 'Genel', [...(groups.get(t.app || 'Genel') ?? []), t])
  for (const a of report.sections) if (!groups.has(a.app) && (a.headline || a.body)) groups.set(a.app, [])
  const articles = new Map(report.sections.map((a) => [a.app, a]))
  return [...groups]
    .map(([app, ts]) => ({ app, article: articles.get(app), tasks: ts }))
    .sort(
      (a, b) =>
        Number(!!b.article?.featured) - Number(!!a.article?.featured) ||
        countDone(b.tasks) - countDone(a.tasks) ||
        b.tasks.length - a.tasks.length,
    )
}

function Body({ text, long }: { text: string; long: boolean }) {
  const blocks = text.trim().split(/\n\s*\n/).filter(Boolean)
  return (
    <div className={long ? 'np-body is-long' : 'np-body'}>
      {blocks.map((block, i) => {
        // Consecutive "- item" lines become a list, everything else a paragraph.
        const runs: { list: boolean; lines: string[] }[] = []
        for (const line of block.split('\n')) {
          const list = /^\s*[-•*]\s+/.test(line)
          const last = runs.at(-1)
          if (last && last.list === list) last.lines.push(line)
          else runs.push({ list, lines: [line] })
        }
        return (
          <Fragment key={i}>
            {runs.map((r, j) =>
              r.list ? (
                <ul key={j}>
                  {r.lines.map((l, k) => (
                    <li key={k}>{l.replace(/^\s*[-•*]\s+/, '')}</li>
                  ))}
                </ul>
              ) : (
                <p key={j}>
                  {r.lines.map((l, k) => (
                    <Fragment key={k}>
                      {k > 0 && <br />}
                      {l}
                    </Fragment>
                  ))}
                </p>
              ),
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function Shots({ tasks, cdn, max, eager }: { tasks: Task[]; cdn: string; max: number; eager: boolean }) {
  const shots = tasks.flatMap((t) => t.shots.map((s) => ({ ...s, caption: s.caption || t.title }))).slice(0, max)
  if (!shots.length) return null
  return (
    <div className={shots.length > 1 ? 'np-shots many' : 'np-shots'}>
      {shots.map((sh) => (
        <figure key={sh.file} className="np-shot">
          <a href={`${cdn}/${sh.file}`} target="_blank" rel="noopener">
            <img src={`${cdn}/${sh.file}`} alt={sh.caption} loading={eager ? 'eager' : 'lazy'} />
          </a>
          <figcaption>{sh.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function Mark({ status }: { status: Status }) {
  return (
    <span className={`np-mark is-${status}`} role="img" aria-label={STATUS_LABELS[status]}>
      {status === 'done' ? '✓' : ''}
    </span>
  )
}

function TaskLine({ t }: { t: Task }) {
  const subDone = countDone(t.subtasks)
  return (
    <li>
      <Mark status={t.status} />
      <div>
        <span className="np-type">
          <i style={{ background: TYPE_COLORS[t.type] }} />
          {TYPE_LABELS[t.type]}
        </span>{' '}
        <span className="np-ttl">{t.title}</span>
        {t.person && <span className="np-who">{t.person}</span>}
        {t.subtasks.length > 0 && (
          <ul className="np-subs" aria-label={`Alt görevler, ${subDone}/${t.subtasks.length} tamamlandı`}>
            {t.subtasks.map((s) => (
              <li key={s.id}>
                <Mark status={s.status} />
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

function TaskGroups({ tasks }: { tasks: Task[] }) {
  return (
    <div className="np-tasks">
      {ORDER.map((st) => {
        const list = tasks.filter((t) => t.status === st)
        if (!list.length) return null
        return (
          <section key={st}>
            <h4>
              {GROUP_TITLES[st]} <span>{list.length}</span>
            </h4>
            <ul>
              {list.map((t) => (
                <TaskLine key={t.id} t={t} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// Without a written article, the most notable task (finished, with a screenshot if possible) is the headline.
const topTask = (ts: Task[]) =>
  [...ts].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.shots.length - a.shots.length)[0]

function AppBlock({ b, lead, cdn }: { b: Block; lead: boolean; cdn: string }) {
  const done = countDone(b.tasks)
  const Title = lead ? 'h2' : 'h3'
  const body = b.article?.body.trim() ?? ''
  return (
    <article id={anchor(b.app)} className={lead ? 'np-app is-lead' : 'np-app'}>
      <p className="np-kicker">
        {b.app}
        {b.tasks.length > 0 && (
          <span>
            {done}/{b.tasks.length} görev tamamlandı
          </span>
        )}
      </p>
      <Title>{b.article?.headline || topTask(b.tasks)?.title}</Title>
      <Shots tasks={b.tasks} cdn={cdn} max={lead ? 4 : 2} eager={lead} />
      {body && <Body text={body} long={body.length > 700} />}
      {b.tasks.length > 0 && <TaskGroups tasks={b.tasks} />}
    </article>
  )
}

export function Newspaper({ report, tasks, number, cdn }: { report: ReportData; tasks: Task[]; number: number; cdn: string }) {
  const { from, to } = period(report.kind, report.date)
  const s = summarize(tasks, from, to)
  const [lead, ...rest] = arrange(report, tasks)

  return (
    <main className={`np np-${report.kind}`}>
      <header className="np-mast">
        <div className="np-logo" aria-label="Freewill Gündem">
          <small>freewill</small>
          <b>GÜNDEM</b>
        </div>
        {lead && (
          <nav className="np-ear" aria-label="Bu sayıda">
            <h2>Bu sayıda</h2>
            <ol>
              {[lead, ...rest].map((b) => (
                <li key={b.app}>
                  <a href={`#${anchor(b.app)}`}>
                    <span>{b.app}</span>
                    <span>{b.tasks.length} görev</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </header>

      <ul className="np-folio">
        <li>Sayı {number}</li>
        <li>{periodLabel(report.kind, report.date)}</li>
        <li>{KIND_LABELS[report.kind]} rapor</li>
        <li>Ege Bey’e özel</li>
      </ul>

      {(report.headline || report.spot) && (
        <section className="np-manset">
          {report.headline && <h1>{report.headline}</h1>}
          {report.spot && <p>{report.spot}</p>}
        </section>
      )}

      {!lead ? (
        <p className="np-empty">Bu dönem için henüz görev girilmedi.</p>
      ) : (
        <>
          <section className="np-numbers" aria-label="Rakamlarla">
            <h2>Rakamlarla</h2>
            <StatTiles s={s} />
            {report.kind !== 'gunluk' && <DailyColumns byDay={s.byDay} caption="Günlere göre tamamlanan görevler" />}
          </section>

          <div className="np-front">
            <AppBlock b={lead} lead cdn={cdn} />
            <aside className="np-side">
              <BarList rows={s.byApp} caption="Uygulamalara göre tamamlanan" empty="Henüz tamamlanan görev yok." />
              <BarList rows={s.byPerson} caption="Ekipten katkılar" empty="Görevlere henüz kişi atanmadı." />
            </aside>
          </div>

          {rest.length > 0 && (
            <div className="np-news">
              {rest.map((b) => (
                <AppBlock key={b.app} b={b} lead={false} cdn={cdn} />
              ))}
            </div>
          )}
        </>
      )}

      <footer className="np-kunye">
        <span>Freewill Gündem, ekibin uygulamalarda yaptıklarını Ege Bey’e aktarmak için hazırlanır.</span>
        <span>Sayı {number}</span>
      </footer>
    </main>
  )
}
