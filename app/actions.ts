'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  checkCredentials, clearFailures, COOKIE, cookieOptions, lockedOut, makeToken, recordFailure, requireAdmin,
} from '@/lib/auth'
import * as db from '@/lib/db'
import { extractTasks, writeReport } from '@/lib/ai'
import { deleteObject } from '@/lib/r2'
import {
  type Candidate, type ReportData, type Status, KINDS, period, sanitizeReport, sanitizeTask, STATUSES,
} from '@/lib/model'

// Every mutation refreshes all pages: the newspaper, task lists and metrics read the same data.
const refresh = () => revalidatePath('/', 'layout')
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : 'Beklenmeyen bir hata oluştu.' })

// ───── session ─────

// Returns the username so the form can keep it after React resets the fields.
export async function login(_: unknown, form: FormData) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local'
  const username = String(form.get('username') ?? '').slice(0, 200)
  if (lockedOut(ip)) return { username, error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' }
  if (!checkCredentials(username, String(form.get('password') ?? ''))) {
    recordFailure(ip)
    return { username, error: 'Kullanıcı adı ya da şifre yanlış.' }
  }
  clearFailures(ip)
  ;(await cookies()).set(COOKIE, makeToken(), cookieOptions)
  redirect('/admin')
}

export async function logout() {
  ;(await cookies()).delete(COOKIE)
  redirect('/login')
}

// ───── reports ─────

export async function createReport(form: FormData) {
  await requireAdmin()
  const kind = KINDS.find((k) => k === form.get('kind')) ?? 'gunluk'
  redirect(`/admin/reports/${db.createReport(kind)}`)
}

export async function saveReport(id: string, data: ReportData) {
  await requireAdmin()
  if (!db.getReport(id)) throw new Error('Rapor bulunamadı.')
  db.updateReport(id, sanitizeReport(data))
  refresh()
}

export async function setPublished(id: string, published: boolean) {
  await requireAdmin()
  db.setPublished(id, published)
  refresh()
}

export async function deleteReport(id: string) {
  await requireAdmin()
  db.deleteReport(id)
  refresh()
  redirect('/admin')
}

export async function writeReportWithClaude(data: ReportData): Promise<{ data: ReportData } | { error: string }> {
  await requireAdmin()
  try {
    const clean = sanitizeReport(data)
    const { from, to } = period(clean.kind, clean.date)
    return { data: await writeReport(clean, db.tasksInRange(from, to)) }
  } catch (e) {
    console.error('writeReport', e)
    return fail(e)
  }
}

// ───── people ─────

export async function addPerson(form: FormData) {
  await requireAdmin()
  const name = String(form.get('name') ?? '').trim().slice(0, 80)
  if (name) db.addPerson(name, String(form.get('role') ?? '').trim().slice(0, 80))
  refresh()
}

export async function updatePerson(form: FormData) {
  await requireAdmin()
  const name = String(form.get('name') ?? '').trim().slice(0, 80)
  if (name) db.updatePerson(Number(form.get('id')), name, String(form.get('role') ?? '').trim().slice(0, 80))
  refresh()
}

export async function setPersonActive(form: FormData) {
  await requireAdmin()
  db.setPersonActive(Number(form.get('id')), form.get('active') === '1')
  refresh()
}

// ───── tasks ─────

export async function createTask(input: unknown, parentId: number | null = null) {
  await requireAdmin()
  try {
    if (parentId !== null && db.getTask(parentId)?.parentId !== null) throw new Error('Alt görevin altına görev eklenemez.')
    db.createTask(sanitizeTask(input), parentId)
    refresh()
    return {}
  } catch (e) {
    return fail(e)
  }
}

export async function updateTask(id: number, input: unknown) {
  await requireAdmin()
  try {
    db.updateTask(id, sanitizeTask(input))
    refresh()
    return {}
  } catch (e) {
    return fail(e)
  }
}

export async function setTaskStatus(id: number, status: Status) {
  await requireAdmin()
  if (STATUSES.includes(status)) db.setTaskStatus(id, status)
  refresh()
}

export async function deleteTask(id: number) {
  await requireAdmin()
  // ponytail: screenshots removed in the edit dialog without deleting the task stay in R2; sweep orphans if storage matters
  const results = await Promise.allSettled(db.deleteTask(id).map(deleteObject))
  for (const r of results) if (r.status === 'rejected') console.error('deleteTask', r.reason)
  refresh()
}

export async function linkSubtask(parentId: number, childId: number) {
  await requireAdmin()
  try {
    db.linkSubtask(parentId, childId)
    refresh()
    return {}
  } catch (e) {
    return fail(e)
  }
}

export async function unlinkSubtask(id: number) {
  await requireAdmin()
  db.unlinkSubtask(id)
  refresh()
}

export async function extractWithClaude(text: string): Promise<{ tasks: Candidate[] } | { error: string }> {
  await requireAdmin()
  if (!text.trim()) return { error: 'Önce görevlerin geçtiği metni yapıştırın.' }
  try {
    return { tasks: await extractTasks(text.slice(0, 30000), db.listPeople(), db.appNames()) }
  } catch (e) {
    console.error('extractTasks', e)
    return fail(e)
  }
}

export async function addCandidates(candidates: Candidate[], date: string) {
  await requireAdmin()
  try {
    for (const c of candidates.slice(0, 100)) {
      const parent = sanitizeTask({ ...c, date, note: '', shots: [] })
      const id = db.createTask(parent)
      for (const title of (Array.isArray(c.subtasks) ? c.subtasks : []).slice(0, 30))
        if (typeof title === 'string' && title.trim())
          db.createTask(sanitizeTask({ ...parent, title, status: parent.status === 'done' ? 'done' : 'todo' }), id)
    }
    refresh()
    return {}
  } catch (e) {
    return fail(e)
  }
}
