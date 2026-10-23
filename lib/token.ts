import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// Session token: "<expiry ms>.<HMAC-SHA256(expiry)>". Pure so it can be tested without Next.

export const MAX_AGE = 60 * 60 * 24 * 30 // 30 days, in seconds

const sign = (exp: string, key: string) => createHmac('sha256', key).update(exp).digest('base64url')

export function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

export function makeToken(key: string, now = Date.now()) {
  const exp = String(now + MAX_AGE * 1000)
  return `${exp}.${sign(exp, key)}`
}

export function verifyToken(token: string | undefined, key: string, now = Date.now()) {
  const [exp, mac] = token?.split('.') ?? []
  return !!exp && !!mac && Number(exp) > now && safeEqual(mac, sign(exp, key))
}
