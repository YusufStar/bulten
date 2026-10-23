import { randomBytes } from 'node:crypto'
import { isAdmin } from '@/lib/auth'
import { putObject } from '@/lib/r2'

const MAX_BYTES = 10 * 1024 * 1024
const TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }

// Decide the type from the bytes, never from the client's filename or MIME claim.
function sniff(b: Buffer): keyof typeof TYPES | null {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif'
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return null
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'Oturumunuz kapanmış. Tekrar giriş yapın.' }, { status: 401 })
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES + 64 * 1024)
    return Response.json({ error: 'Görsel 10 MB’tan büyük olamaz.' }, { status: 413 })

  const file = (await req.formData()).get('file')
  if (!(file instanceof File)) return Response.json({ error: 'Dosya bulunamadı.' }, { status: 400 })
  if (file.size > MAX_BYTES) return Response.json({ error: 'Görsel 10 MB’tan büyük olamaz.' }, { status: 413 })

  const raw = await file.arrayBuffer()
  const ext = sniff(Buffer.from(raw))
  if (!ext) return Response.json({ error: 'Yalnızca PNG, JPG, GIF ve WebP yüklenebilir.' }, { status: 415 })

  const name = `${randomBytes(12).toString('base64url')}.${ext}`
  try {
    await putObject(name, raw, TYPES[ext])
  } catch (e) {
    console.error('upload', e)
    return Response.json({ error: 'Görsel depoya yüklenemedi. Tekrar deneyin.' }, { status: 502 })
  }
  return Response.json({ file: name })
}
