import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { type Kind, type Person, type Report, type ReportData, type Task, type TaskInput, TYPES, today } from './model.ts'

const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? 'data')

let db: DatabaseSync | undefined

function conn() {
  if (db) return db
  mkdirSync(DATA_DIR, { recursive: true })
  db = new DatabaseSync(path.join(DATA_DIR, 'gundem.db'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN (${TYPES.map((t) => `'${t}'`).join(', ')})),
      app TEXT NOT NULL DEFAULT '',
      person_id INTEGER REFERENCES people(id),
      status TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'done')),
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      shots TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tasks_date ON tasks(date);
    CREATE INDEX IF NOT EXISTS tasks_parent ON tasks(parent_id);
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('gunluk', 'haftalik', 'aylik')),
      date TEXT NOT NULL,
      headline TEXT NOT NULL DEFAULT '',
      spot TEXT NOT NULL DEFAULT '',
      sections TEXT NOT NULL DEFAULT '[]',
      published INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`)
  return db
}

type Row = Record<string, string | number | null>

// ───── reports ─────

const toReport = (r: Row): Report => ({
  id: r.id as string,
  kind: r.kind as Kind,
  date: r.date as string,
  headline: r.headline as string,
  spot: r.spot as string,
  sections: JSON.parse(r.sections as string),
  published: r.published === 1,
  createdAt: r.created_at as number,
  updatedAt: r.updated_at as number,
})

export function listReports() {
  return (conn().prepare('SELECT * FROM reports ORDER BY date DESC, created_at DESC').all() as Row[]).map(toReport)
}

export function getReport(id: string) {
  const r = conn().prepare('SELECT * FROM reports WHERE id = ?').get(id) as Row | undefined
  return r && toReport(r)
}

// "Sayı" number: position of the report in creation order.
export function reportNumber(report: Report) {
  return (conn().prepare('SELECT COUNT(*) AS n FROM reports WHERE created_at <= ?').get(report.createdAt) as Row).n as number
}

export function createReport(kind: Kind, date = today(), now = Date.now()) {
  const id = randomBytes(12).toString('base64url') // the share link is the only key, keep it unguessable
  conn().prepare('INSERT INTO reports (id, kind, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, kind, date, now, now)
  return id
}

export function updateReport(id: string, d: ReportData) {
  conn()
    .prepare('UPDATE reports SET kind = ?, date = ?, headline = ?, spot = ?, sections = ?, updated_at = ? WHERE id = ?')
    .run(d.kind, d.date, d.headline, d.spot, JSON.stringify(d.sections), Date.now(), id)
}

export function setPublished(id: string, published: boolean) {
  conn().prepare('UPDATE reports SET published = ? WHERE id = ?').run(published ? 1 : 0, id)
}

export function deleteReport(id: string) {
  conn().prepare('DELETE FROM reports WHERE id = ?').run(id)
}

// ───── people ─────

const toPerson = (r: Row): Person => ({ id: r.id as number, name: r.name as string, role: r.role as string, active: r.active === 1 })

export function listPeople() {
  return (conn().prepare('SELECT * FROM people ORDER BY active DESC, name').all() as Row[]).map(toPerson)
}

export function addPerson(name: string, role: string) {
  return Number(conn().prepare('INSERT INTO people (name, role, created_at) VALUES (?, ?, ?)').run(name, role, Date.now()).lastInsertRowid)
}

export function updatePerson(id: number, name: string, role: string) {
  conn().prepare('UPDATE people SET name = ?, role = ? WHERE id = ?').run(name, role, id)
}

// No delete on purpose: past tasks keep pointing at the person.
export function setPersonActive(id: number, active: boolean) {
  conn().prepare('UPDATE people SET active = ? WHERE id = ?').run(active ? 1 : 0, id)
}

// ───── tasks ─────

const TASK_SELECT = 'SELECT t.*, p.name AS person FROM tasks t LEFT JOIN people p ON p.id = t.person_id'

const toTask = (r: Row): Task => ({
  id: r.id as number,
  parentId: r.parent_id as number | null,
  title: r.title as string,
  type: r.type as Task['type'],
  app: r.app as string,
  personId: r.person_id as number | null,
  person: (r.person as string) ?? '',
  status: r.status as Task['status'],
  date: r.date as string,
  note: r.note as string,
  shots: JSON.parse(r.shots as string),
  subtasks: [],
})

// Top-level tasks dated inside the range, each with all of its subtasks.
export function tasksInRange(from: string, to: string) {
  const top = (
    conn()
      .prepare(`${TASK_SELECT} WHERE t.parent_id IS NULL AND t.date BETWEEN ? AND ? ORDER BY t.date DESC, t.id DESC`)
      .all(from, to) as Row[]
  ).map(toTask)
  const byId = new Map(top.map((t) => [t.id, t]))
  const subs = conn()
    .prepare(`${TASK_SELECT} WHERE t.parent_id IN (SELECT id FROM tasks WHERE parent_id IS NULL AND date BETWEEN ? AND ?) ORDER BY t.id`)
    .all(from, to) as Row[]
  for (const s of subs) byId.get(s.parent_id as number)?.subtasks.push(toTask(s))
  return top
}

export function getTask(id: number) {
  const r = conn().prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as Row | undefined
  return r && toTask(r)
}

export function createTask(t: TaskInput, parentId: number | null = null) {
  const now = Date.now()
  return Number(
    conn()
      .prepare(
        `INSERT INTO tasks (parent_id, title, type, app, person_id, status, date, note, shots, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(parentId, t.title, t.type, t.app, t.personId, t.status, t.date, t.note, JSON.stringify(t.shots), now, now)
      .lastInsertRowid,
  )
}

export function updateTask(id: number, t: TaskInput) {
  conn()
    .prepare('UPDATE tasks SET title = ?, type = ?, app = ?, person_id = ?, status = ?, date = ?, note = ?, shots = ?, updated_at = ? WHERE id = ?')
    .run(t.title, t.type, t.app, t.personId, t.status, t.date, t.note, JSON.stringify(t.shots), Date.now(), id)
}

export function setTaskStatus(id: number, status: Task['status']) {
  conn().prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id)
}

// Subtasks of a deleted task become top-level (ON DELETE SET NULL). Returns its screenshot files.
export function deleteTask(id: number) {
  const t = getTask(id)
  if (!t) return []
  conn().prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return t.shots.map((s) => s.file)
}

// One level only: a subtask can't have children and can't become a parent.
export function linkSubtask(parentId: number, childId: number) {
  const parent = getTask(parentId)
  const child = getTask(childId)
  if (!parent || !child || parentId === childId) throw new Error('Görev bulunamadı.')
  if (parent.parentId) throw new Error('Alt görevin altına görev bağlanamaz.')
  const kids = conn().prepare('SELECT COUNT(*) AS n FROM tasks WHERE parent_id = ?').get(childId) as Row
  if ((kids.n as number) > 0) throw new Error('Kendi alt görevleri olan bir görev alt görev yapılamaz.')
  conn().prepare('UPDATE tasks SET parent_id = ?, updated_at = ? WHERE id = ?').run(parentId, Date.now(), childId)
}

export function unlinkSubtask(id: number) {
  conn().prepare('UPDATE tasks SET parent_id = NULL, updated_at = ? WHERE id = ?').run(Date.now(), id)
}

export function appNames() {
  const rows = conn()
    .prepare(
      `SELECT app AS name FROM tasks WHERE app <> ''
       UNION SELECT json_extract(value, '$.app') FROM reports, json_each(reports.sections)
       ORDER BY 1`,
    )
    .all() as Row[]
  return rows.map((r) => r.name as string).filter(Boolean)
}
