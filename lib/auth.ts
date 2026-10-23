import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MAX_AGE, makeToken as make, safeEqual, verifyToken as verify } from './token.ts'

export const COOKIE = 'gundem_session'

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars)')
  return s
}

export function checkCredentials(user: string, pass: string) {
  const u = process.env.ADMIN_USERNAME
  const p = process.env.ADMIN_PASSWORD
  if (!u || !p) throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set')
  return safeEqual(user, u) && safeEqual(pass, p)
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE,
}

export const makeToken = () => make(secret())

export async function isAdmin() {
  return verify((await cookies()).get(COOKIE)?.value, secret())
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/login')
}

// ponytail: in-memory, per-process lockout; fine for a single container
const failures = new Map<string, { n: number; until: number }>()

export function lockedOut(ip: string) {
  const f = failures.get(ip)
  return !!f && f.n >= 5 && f.until > Date.now()
}

export function recordFailure(ip: string) {
  const f = failures.get(ip)
  const n = f && f.until > Date.now() ? f.n + 1 : 1
  failures.set(ip, { n, until: Date.now() + 15 * 60 * 1000 })
}

export const clearFailures = (ip: string) => failures.delete(ip)
