import { AwsClient } from 'aws4fetch'

// Screenshots live in Cloudflare R2 (S3 API) and are read straight from its public domain.

function env(key: string) {
  const v = process.env[key]
  if (!v) throw new Error(`${key} tanımlı değil.`)
  return v.replace(/\/$/, '')
}

let client: AwsClient | undefined
const r2 = () =>
  (client ??= new AwsClient({
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  }))

const objectUrl = (key: string) => `${env('R2_ENDPOINT')}/${env('R2_BUCKET')}/${key}`

export const cdnBase = () => env('R2_PUBLIC_URL')

export async function putObject(key: string, body: ArrayBuffer, type: string) {
  const res = await r2().fetch(objectUrl(key), {
    method: 'PUT',
    body,
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
  if (!res.ok) throw new Error(`R2 upload ${res.status}: ${await res.text()}`)
}

export async function deleteObject(key: string) {
  const res = await r2().fetch(objectUrl(key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${res.status}: ${await res.text()}`)
}
