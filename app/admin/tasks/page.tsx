import { requireAdmin } from '@/lib/auth'
import { appNames, listPeople, tasksInRange } from '@/lib/db'
import { periodLabel, resolveRange, today } from '@/lib/model'
import { cdnBase } from '@/lib/r2'
import { RangePicker } from '@/components/RangePicker'
import { TaskBoard } from '@/components/TaskBoard'

export const metadata = { title: 'Görevler · Freewill Gündem' }

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> }

export default async function TasksPage({ searchParams }: Props) {
  await requireAdmin()
  const { key, from, to } = resolveRange(await searchParams, '7')
  const t = today()
  return (
    <main className="desk">
      <header className="desk-head">
        <div>
          <h1>Görevler</h1>
          <p>
            {from === to ? periodLabel('gunluk', from) : `${periodLabel('gunluk', from)} – ${periodLabel('gunluk', to)}`}. Yeni görevler{' '}
            {to < t ? 'aralığın son gününe' : 'bugüne'} yazılır; tarihini görevin içinden değiştirebilirsiniz.
          </p>
        </div>
      </header>
      <RangePicker path="/admin/tasks" current={key} from={from} to={to} />
      <TaskBoard tasks={tasksInRange(from, to)} people={listPeople()} apps={appNames()} cdn={cdnBase()} defaultDate={to < t ? to : t} />
    </main>
  )
}
