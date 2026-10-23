import Anthropic from '@anthropic-ai/sdk'
import { cdnBase } from './r2.ts'
import {
  type AiReport, type Candidate, type Person, type ReportData, type Task, KIND_LABELS, mergeLayout, periodLabel,
  STATUS_LABELS, STATUSES, TYPE_LABELS, TYPES,
} from './model.ts'

const MAX_IMAGE_BYTES = 4_500_000 // the API rejects images over 5 MB; skip those rather than fail the request
const MAX_IMAGES = 10

let client: Anthropic | undefined

async function ask<T>(system: string, content: Anthropic.Beta.BetaContentBlockParam[], schema: Record<string, unknown>): Promise<T> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY tanımlı değil.')
  const res = await (client ??= new Anthropic()).beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  })
  if (res.stop_reason === 'refusal') throw new Error('Claude bu isteği yanıtlamadı. Metni değiştirip tekrar deneyin.')
  if (res.stop_reason === 'max_tokens') throw new Error('Yanıt çok uzun olduğu için kesildi. Metni bölerek tekrar deneyin.')
  const text = res.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('Claude boş yanıt döndü.')
  return JSON.parse(text.text) as T
}

// Claude fetches screenshots from the public CDN itself; we only check they are small enough.
async function image(file: string): Promise<Anthropic.Beta.BetaImageBlockParam | null> {
  const url = `${cdnBase()}/${file}`
  try {
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok || Number(head.headers.get('content-length') ?? Infinity) > MAX_IMAGE_BYTES) return null
    return { type: 'image', source: { type: 'url', url } }
  } catch {
    return null
  }
}

const line = (t: Task, indent = '') =>
  `${indent}- [${TYPE_LABELS[t.type]}] [${STATUS_LABELS[t.status]}] ${t.title}${t.person ? ` (${t.person})` : ''}${
    t.note ? `\n${indent}  Not: ${t.note.replace(/\n/g, ' ')}` : ''
  }`

const REPORT_SYSTEM = `You write "Freewill Gündem", a private newspaper the CTO sends to Ege Bey, the company's manager. It reports what the team did across the company's apps in a given period, based on the CTO's task log. Write in Turkish.

Return:
- headline: the front-page headline. One line, at most ~70 characters, naming the most important outcome of the period.
- spot: one or two sentences summing up the whole period for a busy manager.
- sections: one article per app that appears in the task log, using the app names exactly as given.
  - headline: specific to what changed in that app.
  - body: 1–3 short paragraphs separated by a blank line. Explain what changed for users or the business, which bugs were fixed and what is still in progress. The full task list is printed next to the article, so summarise instead of repeating every task. Keep facts, numbers and names from the log; never invent metrics, dates, people or quotes.
  - featured: true for exactly one app, the most significant story of the period (prefer one with screenshots); false for the rest.

Tone: calm, warm and professional, like a good business daily. Lead with outcomes rather than process. Use the typographic apostrophe (’) before Turkish suffixes, as in "Hn’de".`

export async function writeReport(data: ReportData, tasks: Task[]): Promise<ReportData> {
  const apps = [...new Set(tasks.map((t) => t.app || 'Genel'))]
  if (!apps.length) throw new Error('Bu dönemde görev yok. Önce görev ekleyin.')

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: 'text',
      text: `${KIND_LABELS[data.kind]} rapor, dönem: ${periodLabel(data.kind, data.date)}.
Editörün mevcut başlığı: ${data.headline || '(yok)'}
Editörün mevcut özeti: ${data.spot || '(yok)'}`,
    },
  ]
  let budget = MAX_IMAGES
  for (const app of apps) {
    const own = tasks.filter((t) => (t.app || 'Genel') === app)
    content.push({
      type: 'text',
      text: `=== Uygulama: ${app} ===\n${own.map((t) => [line(t), ...t.subtasks.map((s) => line(s, '    '))].join('\n')).join('\n')}`,
    })
    const shots = own.flatMap((t) => t.shots.map((s) => ({ ...s, task: t.title }))).slice(0, budget)
    const imgs = await Promise.all(shots.map((s) => image(s.file)))
    imgs.forEach((img, i) => {
      if (!img) return
      budget--
      content.push({ type: 'text', text: `Ekran görüntüsü (${app}, görev: ${shots[i].task}):` }, img)
    })
  }

  const ai = await ask<AiReport>(REPORT_SYSTEM, content, {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'spot', 'sections'],
    properties: {
      headline: { type: 'string' },
      spot: { type: 'string' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['app', 'headline', 'body', 'featured'],
          properties: {
            app: { type: 'string', enum: apps },
            headline: { type: 'string' },
            body: { type: 'string' },
            featured: { type: 'boolean' },
          },
        },
      },
    },
  })
  return mergeLayout(data, ai, apps)
}

const EXTRACT_SYSTEM = `You turn a CTO's free-form notes (Slack messages, stand-up notes, commit lists, bullet lists) into a clean task list for a task tracker. Write task titles in Turkish.

For every distinct piece of work in the notes return:
- title: short and specific, in the style "Ödeme ekranına Apple Pay eklendi" for finished work or "Ödeme ekranına Apple Pay eklenecek" for planned work.
- type: feature (new capability), bug (fixing broken behaviour), improvement (making existing things better or faster), design (UI/UX or visual work), infra (servers, CI, databases, tooling, refactors).
- app: one of the known app names when the work clearly belongs to it; otherwise the app name the notes mention; otherwise an empty string.
- person: exactly one of the given people names when the notes say who did it; otherwise an empty string.
- status: done when finished, doing when in progress, todo when planned.
- subtasks: short titles of clear sub-steps when an item is made of several steps; otherwise an empty array.

Do not invent work that is not in the notes, and do not split one piece of work into several tasks. Use the typographic apostrophe (’) before Turkish suffixes.`

export async function extractTasks(text: string, people: Person[], apps: string[]): Promise<Candidate[]> {
  const names = people.filter((p) => p.active).map((p) => p.name)
  const out = await ask<{ tasks: (Omit<Candidate, 'personId'> & { person: string })[] }>(
    EXTRACT_SYSTEM,
    [
      {
        type: 'text',
        text: `Bilinen uygulamalar: ${apps.join(', ') || '(henüz yok)'}\nEkip: ${names.join(', ') || '(henüz yok)'}\n\nNotlar:\n${text}`,
      },
    ],
    {
      type: 'object',
      additionalProperties: false,
      required: ['tasks'],
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'type', 'app', 'person', 'status', 'subtasks'],
            properties: {
              title: { type: 'string' },
              type: { type: 'string', enum: [...TYPES] },
              app: { type: 'string' },
              person: { type: 'string' },
              status: { type: 'string', enum: [...STATUSES] },
              subtasks: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  )
  const byName = new Map(people.filter((p) => p.active).map((p) => [p.name.toLocaleLowerCase('tr'), p.id]))
  return out.tasks
    .filter((t) => t.title.trim())
    .map(({ person, ...t }) => ({ ...t, personId: byName.get(person.toLocaleLowerCase('tr')) ?? null }))
}
