'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { deleteReport, saveReport, setPublished, writeReportWithClaude } from '@/app/actions'
import {
  type Article, type Person, type Report, type ReportData, type Task, KIND_LABELS, KINDS, period, periodLabel, today,
} from '@/lib/model'
import { Newspaper } from './Newspaper'
import { TaskBoard } from './TaskBoard'

type Props = { report: Report; number: number; tasks: Task[]; people: Person[]; apps: string[]; cdn: string }

export function ReportEditor({ report, number, tasks, people, apps, cdn }: Props) {
  const initial: ReportData = { kind: report.kind, date: report.date, headline: report.headline, spot: report.spot, sections: report.sections }
  const [data, setData] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [published, setPub] = useState(report.published)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState<'save' | 'ai' | 'share' | null>(null)
  const [undo, setUndo] = useState<ReportData | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const dirty = JSON.stringify(data) !== saved
  const url = typeof window === 'undefined' ? `/b/${report.id}` : `${location.origin}/b/${report.id}`

  const { from, to } = period(data.kind, data.date)
  const now = today()
  const taskDate = now < from ? from : now > to ? to : now
  const reportApps = [...new Set([...tasks.map((t) => t.app || 'Genel'), ...data.sections.map((a) => a.app)])]
  const flash = (text: string, error = false) => setNotice({ text, error })

  async function save(next = data) {
    setBusy('save')
    try {
      await saveReport(report.id, next)
      setSaved(JSON.stringify(next))
      flash('Kaydedildi.')
      return true
    } catch {
      flash('Kaydedilemedi. Bağlantınızı kontrol edip tekrar kaydedin.', true)
      return false
    } finally {
      setBusy(null)
    }
  }

  // The task list below follows the saved period, so a period change is saved right away.
  function changePeriod(patch: Partial<ReportData>) {
    const next = { ...data, ...patch }
    setData(next)
    save(next)
  }

  function setArticle(app: string, patch: Partial<Article>) {
    setData((d) => {
      const has = d.sections.some((a) => a.app === app)
      const sections = has
        ? d.sections.map((a) => (a.app === app ? { ...a, ...patch } : a))
        : [...d.sections, { app, headline: '', body: '', featured: false, ...patch }]
      return { ...d, sections: patch.featured ? sections.map((a) => ({ ...a, featured: a.app === app })) : sections }
    })
  }

  async function write() {
    setBusy('ai')
    flash('Claude dönemin görevlerini okuyup raporu yazıyor. Bu 1–2 dakika sürebilir.')
    try {
      const r = await writeReportWithClaude(data)
      if ('error' in r) return flash(r.error, true)
      setUndo(data)
      setData(r.data)
      setTab('preview')
      flash('Claude raporu yazdı. Beğenmezseniz “Geri al”a basın; beğendiyseniz kaydedin.')
    } catch {
      flash('Claude’a ulaşılamadı. Biraz sonra tekrar deneyin.', true)
    } finally {
      setBusy(null)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  }

  async function share() {
    if (dirty && !(await save())) return
    setBusy('share')
    try {
      await setPublished(report.id, true)
      setPub(true)
      flash((await copy()) ? 'Yayında. Okuma linki panoya kopyalandı.' : 'Yayında. Linki aşağıdan kopyalayın.')
    } catch {
      flash('Yayınlanamadı. Tekrar deneyin.', true)
    } finally {
      setBusy(null)
    }
  }

  async function unpublish() {
    await setPublished(report.id, false)
    setPub(false)
    flash('Yayından kaldırıldı. Link artık açılmıyor.')
  }

  // ⌘S / Ctrl+S saves; warn before leaving with unsaved changes.
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return (
    <div className="ed">
      <header className="ed-bar">
        <Link href="/admin" className="ed-back">
          Tüm raporlar
        </Link>
        <span className="ed-no">Rapor {number}</span>
        <span className={published ? 'pill is-live' : 'pill'}>{published ? 'Yayında' : 'Taslak'}</span>
        <div className="ed-tabs" role="tablist" aria-label="Görünüm">
          <button role="tab" aria-selected={tab === 'edit'} onClick={() => setTab('edit')}>
            Düzenle
          </button>
          <button role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>
            Önizle
          </button>
        </div>
        <div className="ed-actions">
          {undo && (
            <button
              className="btn btn-quiet"
              onClick={() => {
                setData(undo)
                setUndo(null)
                flash('Claude’dan önceki hâline dönüldü.')
              }}
            >
              Geri al
            </button>
          )}
          <button className="btn" onClick={write} disabled={!!busy}>
            {busy === 'ai' ? 'Claude yazıyor…' : 'Claude ile yaz'}
          </button>
          <button className="btn" onClick={() => save()} disabled={!dirty || !!busy}>
            {busy === 'save' ? 'Kaydediliyor…' : dirty ? 'Kaydet' : 'Kaydedildi'}
          </button>
          <button className="btn btn-red" onClick={share} disabled={!!busy}>
            {busy === 'share' ? 'Yayınlanıyor…' : 'Paylaş'}
          </button>
        </div>
      </header>

      {notice && (
        <p className={notice.error ? 'ed-notice is-error' : 'ed-notice'} role="status">
          {notice.text}
        </p>
      )}

      {published && (
        <div className="ed-share">
          <label>
            Okuma linki
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <button className="btn" onClick={async () => flash((await copy()) ? 'Link kopyalandı.' : 'Kopyalanamadı; linki seçip kopyalayın.')}>
            Kopyala
          </button>
          <a className="btn btn-quiet" href={url} target="_blank" rel="noopener">
            Aç
          </a>
          <button className="btn btn-quiet" onClick={unpublish}>
            Yayından kaldır
          </button>
        </div>
      )}

      {tab === 'preview' ? (
        <div className="ed-preview">
          <Newspaper report={data} tasks={tasks} number={number} cdn={cdn} />
        </div>
      ) : (
        <div className="ed-form">
          <section className="card">
            <h2>Rapor</h2>
            <div className="ed-meta">
              <fieldset className="ed-kind">
                <legend>Rapor türü</legend>
                {KINDS.map((k) => (
                  <label key={k}>
                    <input type="radio" name="kind" checked={data.kind === k} onChange={() => changePeriod({ kind: k })} />
                    {KIND_LABELS[k]}
                  </label>
                ))}
              </fieldset>
              {data.kind === 'aylik' ? (
                <label>
                  Ay
                  <input type="month" value={data.date.slice(0, 7)} onChange={(e) => e.target.value && changePeriod({ date: `${e.target.value}-01` })} />
                </label>
              ) : (
                <label>
                  {data.kind === 'haftalik' ? 'Haftanın son günü' : 'Gün'}
                  <input type="date" value={data.date} onChange={(e) => e.target.value && changePeriod({ date: e.target.value })} />
                </label>
              )}
              <p className="ed-period">
                Kapsadığı dönem: <b>{periodLabel(data.kind, data.date)}</b>, {tasks.length} görev
              </p>
            </div>
            <label>
              Başlık
              <input
                className="ed-manset"
                value={data.headline}
                onChange={(e) => setData({ ...data, headline: e.target.value })}
                placeholder="Raporun en büyük başlığı. Boş bırakırsanız Claude yazar."
              />
            </label>
            <label>
              Özet
              <textarea rows={2} value={data.spot} onChange={(e) => setData({ ...data, spot: e.target.value })} placeholder="Başlığın altındaki bir iki cümlelik özet." />
            </label>
          </section>

          <section className="card">
            <h2>Dönemin görevleri</h2>
            <p className="card-hint">Rapordaki listeler ve grafikler bu görevlerden oluşur. Değişiklikler hemen kaydedilir.</p>
            <TaskBoard tasks={tasks} people={people} apps={apps} cdn={cdn} defaultDate={taskDate} />
          </section>

          <section className="card">
            <h2>Uygulama yazıları</h2>
            <p className="card-hint">
              “Claude ile yaz” bu alanları görevlerden doldurur. Yazısı boş kalan uygulamalar raporda yalnızca görev listesiyle görünür. “Öne
              çıkar” seçilen uygulama raporun en büyük haberi olur.
            </p>
            {reportApps.length === 0 && <p className="tb-empty">Önce bu döneme görev ekleyin.</p>}
            {reportApps.map((app) => {
              const a = data.sections.find((x) => x.app === app)
              const own = tasks.filter((t) => (t.app || 'Genel') === app)
              return (
                <fieldset key={app} className="ed-article">
                  <legend>
                    {app}
                    <span>
                      {own.filter((t) => t.status === 'done').length}/{own.length} görev tamamlandı
                    </span>
                  </legend>
                  <label className="ed-feature">
                    <input type="radio" name="featured" checked={!!a?.featured} onChange={() => setArticle(app, { featured: true })} />
                    Öne çıkar
                  </label>
                  <input
                    className="ed-headline"
                    aria-label={`${app} başlığı`}
                    placeholder="Başlık"
                    value={a?.headline ?? ''}
                    onChange={(e) => setArticle(app, { headline: e.target.value })}
                  />
                  <textarea
                    className="ed-body"
                    aria-label={`${app} yazısı`}
                    placeholder="Bu uygulamada dönem boyunca neler oldu?"
                    value={a?.body ?? ''}
                    onChange={(e) => setArticle(app, { body: e.target.value })}
                  />
                  {a && own.length === 0 && (
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={() => setData((d) => ({ ...d, sections: d.sections.filter((x) => x.app !== app) }))}
                    >
                      Bu dönemde görevi yok, yazıyı kaldır
                    </button>
                  )}
                </fieldset>
              )
            })}
          </section>

          <div className="ed-danger">
            <button type="button" className="btn btn-quiet is-danger" onClick={() => confirm('Bu rapor silinsin mi? Görevler silinmez.') && deleteReport(report.id)}>
              Raporu sil
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
