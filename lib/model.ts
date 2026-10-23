// Shared, dependency-free model. Imported by server code, the client UI and node --test.

export const KINDS = ['gunluk', 'haftalik', 'aylik'] as const
export type Kind = (typeof KINDS)[number]
export const KIND_LABELS: Record<Kind, string> = { gunluk: 'Günlük', haftalik: 'Haftalık', aylik: 'Aylık' }

export const TYPES = ['feature', 'bug', 'improvement', 'design', 'infra'] as const
export type TaskType = (typeof TYPES)[number]
export const TYPE_LABELS: Record<TaskType, string> = {
  feature: 'Özellik',
  bug: 'Bug',
  improvement: 'İyileştirme',
  design: 'Tasarım',
  infra: 'Altyapı',
}
// Categorical order validated (CVD + normal-vision separation) against the paper colour; keep the order.
export const TYPE_COLORS: Record<TaskType, string> = {
  feature: '#0f5499',
  bug: '#d2501c',
  improvement: '#0a8f6e',
  design: '#c98a00',
  infra: '#8b4bb3',
}

export const STATUSES = ['todo', 'doing', 'done'] as const
export type Status = (typeof STATUSES)[number]
export const STATUS_LABELS: Record<Status, string> = { todo: 'Yapılacak', doing: 'Devam ediyor', done: 'Tamamlandı' }

export type Shot = { file: string; caption: string }
export type Person = { id: number; name: string; role: string; active: boolean }
export type Task = {
  id: number
  parentId: number | null
  title: string
  type: TaskType
  app: string
  personId: number | null
  person: string
  status: Status
  date: string
  note: string
  shots: Shot[]
  subtasks: Task[]
}
export type TaskInput = Pick<Task, 'title' | 'type' | 'app' | 'personId' | 'status' | 'date' | 'note' | 'shots'>
export type Candidate = Pick<Task, 'title' | 'type' | 'app' | 'personId' | 'status'> & { subtasks: string[] }

export type Article = { app: string; headline: string; body: string; featured: boolean }
export type ReportData = { kind: Kind; date: string; headline: string; spot: string; sections: Article[] }
export type Report = ReportData & { id: string; published: boolean; createdAt: number; updatedAt: number }

export const FILE_RE = /^[A-Za-z0-9_-]{16,32}\.(png|jpg|gif|webp)$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T) =>
  list.includes(v as T) ? (v as T) : fallback
const date = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) && !isNaN(Date.parse(v)) ? v : today())

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

export function addDays(d: string, n: number) {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

export function period(kind: Kind, d: string) {
  if (kind === 'gunluk') return { from: d, to: d }
  if (kind === 'haftalik') return { from: addDays(d, -6), to: d }
  const [y, m] = d.split('-').map(Number)
  return { from: `${d.slice(0, 7)}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
}

export function days(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d)
  return out
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', ...o })
const utc = (d: string) => new Date(`${d}T00:00:00Z`)

export function periodLabel(kind: Kind, d: string) {
  if (kind === 'gunluk') return fmt({ dateStyle: 'full' }).format(utc(d))
  if (kind === 'aylik') return fmt({ month: 'long', year: 'numeric' }).format(utc(d))
  const { from, to } = period(kind, d)
  return fmt({ day: 'numeric', month: 'long', year: 'numeric' }).formatRange(utc(from), utc(to))
}

export const shortDay = (d: string) => fmt({ day: 'numeric', month: 'short' }).format(utc(d))

// ───── trust boundary: everything from the browser or the model passes through these ─────

export function sanitizeReport(input: unknown): ReportData {
  const o = (input ?? {}) as Record<string, unknown>
  const seen = new Set<string>()
  const sections = (Array.isArray(o.sections) ? o.sections : [])
    .map((raw) => {
      const s = (raw ?? {}) as Record<string, unknown>
      return { app: str(s.app, 80).trim(), headline: str(s.headline, 300), body: str(s.body, 20000), featured: s.featured === true }
    })
    .filter((s) => s.app && !seen.has(s.app) && seen.add(s.app))
    .slice(0, 60)
  return {
    kind: oneOf(KINDS, o.kind, 'gunluk'),
    date: date(o.date),
    headline: str(o.headline, 300),
    spot: str(o.spot, 1000),
    sections,
  }
}

export function sanitizeTask(input: unknown): TaskInput {
  const o = (input ?? {}) as Record<string, unknown>
  const title = str(o.title, 300).trim()
  if (!title) throw new Error('Görev başlığı boş olamaz.')
  return {
    title,
    type: oneOf(TYPES, o.type, 'feature'),
    app: str(o.app, 80).trim(),
    personId: Number.isInteger(o.personId) && (o.personId as number) > 0 ? (o.personId as number) : null,
    status: oneOf(STATUSES, o.status, 'todo'),
    date: date(o.date),
    note: str(o.note, 5000),
    shots: (Array.isArray(o.shots) ? o.shots : [])
      .map((x) => ({ file: str((x as Shot)?.file, 64), caption: str((x as Shot)?.caption, 300) }))
      .filter((x) => FILE_RE.test(x.file))
      .slice(0, 12),
  }
}

// ───── metrics ─────

const zero = () => Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<TaskType, number>

// Counts top-level tasks only; subtasks show up as progress.
export function summarize(tasks: Task[], from: string, to: string) {
  const done = tasks.filter((t) => t.status === 'done')
  const byType = zero()
  const byDay = new Map(days(from, to).map((d) => [d, zero()]))
  const byApp = new Map<string, number>()
  const byPerson = new Map<string, number>()
  for (const t of done) {
    byType[t.type]++
    const day = byDay.get(t.date)
    if (day) day[t.type]++
    byApp.set(t.app || 'Genel', (byApp.get(t.app || 'Genel') ?? 0) + 1)
    if (t.person) byPerson.set(t.person, (byPerson.get(t.person) ?? 0) + 1)
  }
  const subs = tasks.flatMap((t) => t.subtasks)
  const desc = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
  return {
    total: tasks.length,
    done: done.length,
    doing: tasks.filter((t) => t.status === 'doing').length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    subDone: subs.filter((s) => s.status === 'done').length,
    subTotal: subs.length,
    byType,
    byDay: [...byDay].map(([date, counts]) => ({ date, counts })),
    byApp: desc(byApp),
    byPerson: desc(byPerson),
  }
}
export type Summary = ReturnType<typeof summarize>

// ───── Claude's article layout, applied without losing what the editor wrote ─────

export type AiReport = { headline: string; spot: string; sections: Article[] }

export function mergeLayout(data: ReportData, ai: AiReport, apps: string[]): ReportData {
  const known = new Set(apps)
  const old = new Map(data.sections.map((s) => [s.app, s]))
  const used = new Set<string>()
  const sections: Article[] = []
  for (const a of ai.sections) {
    if (!known.has(a.app) || used.has(a.app)) continue
    used.add(a.app)
    const prev = old.get(a.app)
    sections.push({
      app: a.app,
      headline: a.headline.trim() || prev?.headline || '',
      body: a.body.trim() || prev?.body || '',
      featured: false,
    })
  }
  for (const s of data.sections) if (!used.has(s.app)) sections.push(s)
  const pick = ai.sections.find((a) => a.featured && used.has(a.app))?.app ?? data.sections.find((s) => s.featured)?.app
  for (const s of sections) s.featured = s.app === pick
  return { ...data, headline: ai.headline.trim() || data.headline, spot: ai.spot.trim() || data.spot, sections }
}

// ───── date ranges for the task list and metrics pages ─────

// An array, not an object: numeric-looking keys would be reordered by the engine.
export const RANGES = [
  ['bugun', 'Bugün'],
  ['7', 'Son 7 gün'],
  ['ay', 'Bu ay'],
  ['30', 'Son 30 gün'],
  ['90', 'Son 90 gün'],
] as const
type PresetKey = (typeof RANGES)[number][0]
export type RangeKey = PresetKey | 'ozel'

export function resolveRange(q: { range?: string; from?: string; to?: string }, fallback: PresetKey) {
  const t = today()
  const valid = (d?: string) => !!d && DATE_RE.test(d) && !isNaN(Date.parse(d))
  if (valid(q.from) && valid(q.to) && q.from! <= q.to!) return { key: 'ozel' as RangeKey, from: q.from!, to: q.to! }
  const key = RANGES.find(([k]) => k === q.range)?.[0] ?? fallback
  if (key === 'bugun') return { key, from: t, to: t }
  if (key === 'ay') return { key, from: `${t.slice(0, 7)}-01`, to: t }
  return { key, from: addDays(t, -(Number(key) - 1)), to: t }
}
