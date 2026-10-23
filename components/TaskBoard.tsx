'use client'

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import {
  addCandidates, createTask, deleteTask, extractWithClaude, linkSubtask, setTaskStatus, unlinkSubtask, updateTask,
} from '@/app/actions'
import {
  type Candidate, type Person, type Status, type Task, type TaskInput, type TaskType, shortDay, STATUS_LABELS, STATUSES,
  TYPE_COLORS, TYPE_LABELS, TYPES,
} from '@/lib/model'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
type Result = { error?: string } | void

async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Görsel yüklenemedi.')
  return json.file as string
}

function useAction() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<Result>, then?: () => void) =>
    start(async () => {
      setError(null)
      try {
        const r = await fn()
        if (r?.error) setError(r.error)
        else then?.()
      } catch {
        setError('İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.')
      }
    })
  return { pending, error, setError, run }
}

export function TypeChip({ type }: { type: TaskType }) {
  return (
    <span className="chip">
      <i style={{ background: TYPE_COLORS[type] }} />
      {TYPE_LABELS[type]}
    </span>
  )
}

function PersonSelect({ people, value, onChange, label }: { people: Person[]; value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Sorumlu yok</option>
      {people.filter((p) => p.active || p.id === value).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.active ? '' : ' (pasif)'}
        </option>
      ))}
    </select>
  )
}

type Props = { tasks: Task[]; people: Person[]; apps: string[]; cdn: string; defaultDate: string }

export function TaskBoard({ tasks, people, apps, cdn, defaultDate }: Props) {
  const { pending, error, run } = useAction()
  // Status changes show instantly; the server's refreshed props take over when the action finishes.
  const [override, setOverride] = useOptimistic<Record<number, Status>, [number, Status]>({}, (s, [id, st]) => ({ ...s, [id]: st }))
  const statusOf = (t: Task) => override[t.id] ?? t.status
  const changeStatus = (id: number, st: Status) =>
    run(async () => {
      setOverride([id, st])
      await setTaskStatus(id, st)
    })
  const [draft, setDraft] = useState({ title: '', type: 'feature' as TaskType, app: '', personId: null as number | null, status: 'done' as Status })
  const [filter, setFilter] = useState({ q: '', type: '', status: '', app: '', person: '' })
  const [editing, setEditing] = useState<number | null>(null)
  const [extracting, setExtracting] = useState(false)

  const all = tasks.flatMap((t) => [t, ...t.subtasks])
  const editingTask = all.find((t) => t.id === editing)
  const q = filter.q.toLocaleLowerCase('tr')
  const visible = tasks.filter(
    (t) =>
      (!q || [t, ...t.subtasks].some((x) => x.title.toLocaleLowerCase('tr').includes(q))) &&
      (!filter.type || t.type === filter.type) &&
      (!filter.status || t.status === filter.status) &&
      (!filter.app || (t.app || 'Genel') === filter.app) &&
      (!filter.person || String(t.personId) === filter.person),
  )
  const boardApps = [...new Set(tasks.map((t) => t.app || 'Genel'))].sort((a, b) => a.localeCompare(b, 'tr'))

  function add(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) return
    run(
      () => createTask({ ...draft, date: defaultDate, note: '', shots: [] }),
      () => setDraft((d) => ({ ...d, title: '' })),
    )
  }

  return (
    <div className="tb">
      <form className="tb-add" onSubmit={add}>
        <input
          className="tb-add-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Yeni görev, ör. Ödeme ekranına Apple Pay eklendi"
          aria-label="Yeni görev başlığı"
        />
        <select aria-label="Tür" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as TaskType })}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input list="tb-apps" aria-label="Uygulama" placeholder="Uygulama" value={draft.app} onChange={(e) => setDraft({ ...draft, app: e.target.value })} />
        <PersonSelect people={people} label="Sorumlu" value={draft.personId} onChange={(personId) => setDraft({ ...draft, personId })} />
        <select aria-label="Durum" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn btn-red" disabled={pending || !draft.title.trim()}>
          Görev ekle
        </button>
        <button type="button" className="btn" onClick={() => setExtracting(true)}>
          Metinden görev çıkar
        </button>
      </form>

      {error && (
        <p className="tb-error" role="alert">
          {error}
        </p>
      )}

      <div className="tb-filters">
        <input type="search" placeholder="Görevlerde ara" aria-label="Görevlerde ara" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select aria-label="Türe göre süz" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
          <option value="">Tüm türler</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select aria-label="Duruma göre süz" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">Tüm durumlar</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select aria-label="Uygulamaya göre süz" value={filter.app} onChange={(e) => setFilter({ ...filter, app: e.target.value })}>
          <option value="">Tüm uygulamalar</option>
          {boardApps.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select aria-label="Kişiye göre süz" value={filter.person} onChange={(e) => setFilter({ ...filter, person: e.target.value })}>
          <option value="">Herkes</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="tb-count">
          {visible.length} / {tasks.length} görev
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="tb-empty">
          {tasks.length
            ? 'Bu süzgeçlere uyan görev yok.'
            : 'Bu aralıkta görev yok. Yukarıdaki satıra yazıp Enter’a basın ya da notlarınızı “Metinden görev çıkar” ile listeye çevirin.'}
        </p>
      ) : (
        <ul className="tb-list">
          {visible.map((t) => {
            const subDone = t.subtasks.filter((s) => s.status === 'done').length
            return (
              <li key={t.id} className={`tb-row is-${statusOf(t)}`}>
                <div className="tb-main">
                  <TypeChip type={t.type} />
                  <button type="button" className="tb-title" onClick={() => setEditing(t.id)}>
                    {t.title}
                  </button>
                  <span className="tb-meta">
                    {t.subtasks.length > 0 && <span>{subDone}/{t.subtasks.length} alt görev</span>}
                    {t.shots.length > 0 && <span>{t.shots.length} görsel</span>}
                  </span>
                </div>
                <span className="tb-app">{t.app || 'Genel'}</span>
                <span className="tb-person">{t.person || 'Sorumlu yok'}</span>
                <span className="tb-date">{shortDay(t.date)}</span>
                <select
                  className={`tb-status is-${statusOf(t)}`}
                  aria-label={`${t.title} durumu`}
                  value={statusOf(t)}
                  onChange={(e) => changeStatus(t.id, e.target.value as Status)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                {t.subtasks.length > 0 && (
                  <ul className="tb-subs">
                    {t.subtasks.map((s) => (
                      <li key={s.id}>
                        <input
                          type="checkbox"
                          aria-label={`${s.title} tamamlandı`}
                          checked={statusOf(s) === 'done'}
                          onChange={(e) => changeStatus(s.id, e.target.checked ? 'done' : 'todo')}
                        />
                        <button type="button" onClick={() => setEditing(s.id)}>
                          {s.title}
                        </button>
                        {s.person && <span>{s.person}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <datalist id="tb-apps">
        {apps.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      {editingTask && (
        <TaskDialog
          key={editingTask.id}
          task={editingTask}
          tasks={tasks}
          people={people}
          cdn={cdn}
          statusOf={statusOf}
          changeStatus={changeStatus}
          onClose={() => setEditing(null)}
          onOpen={setEditing}
        />
      )}
      {extracting && <ExtractDialog people={people} date={defaultDate} onClose={() => setExtracting(false)} />}
    </div>
  )
}

function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const d = ref.current
    const handle = () => closeRef.current()
    d?.showModal()
    d?.addEventListener('close', handle)
    return () => d?.removeEventListener('close', handle)
  }, [])
  return ref
}

type DialogProps = {
  task: Task
  tasks: Task[]
  people: Person[]
  cdn: string
  statusOf: (t: Task) => Status
  changeStatus: (id: number, st: Status) => void
  onClose: () => void
  onOpen: (id: number) => void
}

function TaskDialog({ task, tasks, people, cdn, statusOf, changeStatus, onClose, onOpen }: DialogProps) {
  const ref = useModal(onClose)
  const { pending, error, setError, run } = useAction()
  const [form, setForm] = useState<TaskInput>({
    title: task.title, type: task.type, app: task.app, personId: task.personId, status: task.status, date: task.date, note: task.note, shots: task.shots,
  })
  const [uploads, setUploads] = useState(0)
  const [newSub, setNewSub] = useState('')
  const [linkId, setLinkId] = useState('')
  const isSub = task.parentId !== null
  const linkable = tasks.filter((t) => t.id !== task.id && t.subtasks.length === 0)

  async function addFiles(files: File[]) {
    const images = files.filter((f) => IMAGE_TYPES.includes(f.type))
    if (!images.length) return setError('Yalnızca PNG, JPG, GIF ve WebP görseller eklenebilir.')
    setUploads((n) => n + images.length)
    for (const f of images) {
      try {
        const file = await uploadImage(f)
        setForm((d) => ({ ...d, shots: [...d.shots, { file, caption: '' }] }))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Görsel yüklenemedi.')
      } finally {
        setUploads((n) => n - 1)
      }
    }
  }

  const close = () => ref.current?.close()

  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-label="Görevi düzenle"
      onPaste={(e) => {
        const files = [...e.clipboardData.files]
        if (files.length) {
          e.preventDefault()
          addFiles(files)
        }
      }}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault()
          addFiles([...e.dataTransfer.files])
        }
      }}
    >
      <form
        method="dialog"
        className="dlg-body"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => updateTask(task.id, form), close)
        }}
      >
        <header className="dlg-head">
          <h2>{isSub ? 'Alt görevi düzenle' : 'Görevi düzenle'}</h2>
          <button type="button" className="btn btn-quiet" onClick={close}>
            Kapat
          </button>
        </header>

        <label>
          Başlık
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <div className="dlg-grid">
          <label>
            Tür
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Durum
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Uygulama
            <input list="tb-apps" value={form.app} onChange={(e) => setForm({ ...form, app: e.target.value })} />
          </label>
          <label>
            Sorumlu
            <PersonSelect people={people} label="Sorumlu" value={form.personId} onChange={(personId) => setForm({ ...form, personId })} />
          </label>
          <label>
            Tarih
            <input type="date" value={form.date} onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} />
          </label>
        </div>
        <label>
          Not
          <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ayrıntı, bağlantı ya da bağlam (isteğe bağlı)" />
        </label>

        <fieldset className="dlg-shots">
          <legend>Ekran görüntüleri</legend>
          {form.shots.map((sh, i) => (
            <figure key={sh.file}>
              <img src={`${cdn}/${sh.file}`} alt="" />
              <input
                aria-label="Görsel altı yazısı"
                placeholder="Görsel altı yazısı"
                value={sh.caption}
                onChange={(e) => setForm({ ...form, shots: form.shots.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)) })}
              />
              <button type="button" className="btn btn-quiet" onClick={() => setForm({ ...form, shots: form.shots.filter((_, k) => k !== i) })}>
                Kaldır
              </button>
            </figure>
          ))}
          <label className="dlg-drop">
            <input
              type="file"
              className="sr-only"
              accept={IMAGE_TYPES.join(',')}
              multiple
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
            {uploads ? `${uploads} görsel yükleniyor…` : 'Görsel ekle'}
            <small>Sürükleyin, yapıştırın ya da seçin</small>
          </label>
        </fieldset>

        {!isSub && (
          <fieldset className="dlg-subs">
            <legend>Alt görevler</legend>
            {task.subtasks.length > 0 && (
              <ul>
                {task.subtasks.map((s) => (
                  <li key={s.id}>
                    <input
                      type="checkbox"
                      aria-label={`${s.title} tamamlandı`}
                      checked={statusOf(s) === 'done'}
                      onChange={(e) => changeStatus(s.id, e.target.checked ? 'done' : 'todo')}
                    />
                    <button type="button" className="dlg-sub-title" onClick={() => onOpen(s.id)}>
                      {s.title}
                    </button>
                    <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => run(() => unlinkSubtask(s.id))}>
                      Ayır
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="dlg-inline">
              <input
                aria-label="Yeni alt görev"
                placeholder="Yeni alt görev"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (newSub.trim())
                      run(() => createTask({ ...form, title: newSub, status: 'todo', note: '', shots: [] }, task.id), () => setNewSub(''))
                  }
                }}
              />
              <button
                type="button"
                className="btn"
                disabled={pending || !newSub.trim()}
                onClick={() => run(() => createTask({ ...form, title: newSub, status: 'todo', note: '', shots: [] }, task.id), () => setNewSub(''))}
              >
                Ekle
              </button>
            </div>
            {linkable.length > 0 && (
              <div className="dlg-inline">
                <select aria-label="Mevcut görevi alt görev yap" value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                  <option value="">Mevcut bir görevi alt görev olarak seçin</option>
                  {linkable.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn" disabled={pending || !linkId} onClick={() => run(() => linkSubtask(task.id, Number(linkId)), () => setLinkId(''))}>
                  Bağla
                </button>
              </div>
            )}
          </fieldset>
        )}

        {error && (
          <p className="tb-error" role="alert">
            {error}
          </p>
        )}

        <footer className="dlg-foot">
          <button
            type="button"
            className="btn btn-quiet is-danger"
            disabled={pending}
            onClick={() => confirm('Bu görev silinsin mi? Alt görevleri ayrı görev olarak kalır.') && run(() => deleteTask(task.id), close)}
          >
            Görevi sil
          </button>
          {isSub && (
            <button type="button" className="btn btn-quiet" onClick={() => onOpen(task.parentId!)}>
              Üst göreve dön
            </button>
          )}
          <button className="btn btn-red" disabled={pending || uploads > 0}>
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}

type Pick = Candidate & { keep: boolean }

function ExtractDialog({ people, date, onClose }: { people: Person[]; date: string; onClose: () => void }) {
  const ref = useModal(onClose)
  const { pending, error, setError, run } = useAction()
  const [text, setText] = useState('')
  const [list, setList] = useState<Pick[] | null>(null)
  const kept = list?.filter((c) => c.keep) ?? []
  const edit = (i: number, patch: Partial<Pick>) => setList((l) => l!.map((c, k) => (k === i ? { ...c, ...patch } : c)))

  return (
    <dialog ref={ref} className="dlg is-wide" aria-label="Metinden görev çıkar">
      <div className="dlg-body">
        <header className="dlg-head">
          <h2>Metinden görev çıkar</h2>
          <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>
            Kapat
          </button>
        </header>

        {!list ? (
          <>
            <p className="dlg-hint">
              Slack mesajını, toplantı notunu ya da commit listesini yapıştırın. Claude içindeki işleri ayrı görevlere böler; türünü,
              uygulamasını ve sorumlusunu tahmin eder. Eklemeden önce listeyi düzenleyebilirsiniz.
            </p>
            <textarea
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Görevlerin geçtiği metin"
              placeholder={'ör.\nElif: hn ödeme ekranı bitti, apple pay de eklendi\nMert checkout adres bug’ını çözdü\nPazar sipariş listesi yarın canlıya çıkacak'}
            />
            {error && (
              <p className="tb-error" role="alert">
                {error}
              </p>
            )}
            <footer className="dlg-foot">
              <button
                type="button"
                className="btn btn-red"
                disabled={pending || !text.trim()}
                onClick={() =>
                  run(async () => {
                    const r = await extractWithClaude(text)
                    if ('error' in r) return r
                    if (!r.tasks.length) return { error: 'Bu metinde görev bulunamadı.' }
                    setList(r.tasks.map((c) => ({ ...c, keep: true })))
                  })
                }
              >
                {pending ? 'Claude okuyor…' : 'Görevleri çıkar'}
              </button>
            </footer>
          </>
        ) : (
          <>
            <p className="dlg-hint">
              {list.length} görev bulundu. İstemediklerinizin işaretini kaldırın; eklenenlerin tarihi {shortDay(date)} olur.
            </p>
            <ul className="ex-list">
              {list.map((c, i) => (
                <li key={i} className={c.keep ? '' : 'is-off'}>
                  <input type="checkbox" aria-label="Bu görevi ekle" checked={c.keep} onChange={(e) => edit(i, { keep: e.target.checked })} />
                  <div className="ex-fields">
                    <input aria-label="Başlık" value={c.title} onChange={(e) => edit(i, { title: e.target.value })} />
                    <select aria-label="Tür" value={c.type} onChange={(e) => edit(i, { type: e.target.value as TaskType })}>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <input aria-label="Uygulama" list="tb-apps" placeholder="Uygulama" value={c.app} onChange={(e) => edit(i, { app: e.target.value })} />
                    <PersonSelect people={people} label="Sorumlu" value={c.personId} onChange={(personId) => edit(i, { personId })} />
                    <select aria-label="Durum" value={c.status} onChange={(e) => edit(i, { status: e.target.value as Status })}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    {c.subtasks.length > 0 && <p className="ex-subs">Alt görevler: {c.subtasks.join(' / ')}</p>}
                  </div>
                </li>
              ))}
            </ul>
            {error && (
              <p className="tb-error" role="alert">
                {error}
              </p>
            )}
            <footer className="dlg-foot">
              <button type="button" className="btn btn-quiet" onClick={() => setList(null)}>
                Metne dön
              </button>
              <button
                type="button"
                className="btn btn-red"
                disabled={pending || !kept.length}
                onClick={() =>
                  kept.some((c) => !c.title.trim())
                    ? setError('Başlığı boş görev var.')
                    : run(() => addCandidates(kept.map(({ keep: _, ...c }) => c), date), () => ref.current?.close())
                }
              >
                {pending ? 'Ekleniyor…' : `${kept.length} görevi ekle`}
              </button>
            </footer>
          </>
        )}
      </div>
    </dialog>
  )
}
