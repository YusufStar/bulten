import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isAdmin } from '@/lib/auth'
import { getReport, reportNumber, tasksInRange } from '@/lib/db'
import { period } from '@/lib/model'
import { cdnBase } from '@/lib/r2'
import { Newspaper } from '@/components/Newspaper'

type Props = { params: Promise<{ id: string }> }

// Anyone with the link can read a published report; drafts are visible only to the editor.
const load = cache(async (id: string) => {
  const report = getReport(id)
  if (!report || !(report.published || (await isAdmin()))) return undefined
  const { from, to } = period(report.kind, report.date)
  return { report, tasks: tasksInRange(from, to) }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).id)
  if (!r) return {}
  const shot = r.tasks.find((t) => t.shots.length)?.shots[0]
  const title = r.report.headline || 'Freewill Gündem'
  return {
    metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
    title: `${title} · Freewill Gündem`,
    description: r.report.spot || undefined,
    openGraph: { title, description: r.report.spot || undefined, images: shot ? [`${cdnBase()}/${shot.file}`] : undefined },
  }
}

export default async function ReportView({ params }: Props) {
  const r = await load((await params).id)
  if (!r) notFound()
  return <Newspaper report={r.report} tasks={r.tasks} number={reportNumber(r.report)} cdn={cdnBase()} />
}
