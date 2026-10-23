import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { appNames, getReport, listPeople, reportNumber, tasksInRange } from '@/lib/db'
import { period } from '@/lib/model'
import { cdnBase } from '@/lib/r2'
import { ReportEditor } from '@/components/ReportEditor'

export const metadata = { title: 'Raporu düzenle · Freewill Gündem' }

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const report = getReport((await params).id)
  if (!report) notFound()
  const { from, to } = period(report.kind, report.date)
  return (
    <ReportEditor
      report={report}
      number={reportNumber(report)}
      tasks={tasksInRange(from, to)}
      people={listPeople()}
      apps={appNames()}
      cdn={cdnBase()}
    />
  )
}
