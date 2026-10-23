import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type Task, mergeLayout, period, resolveRange, sanitizeReport, sanitizeTask, summarize, today } from './model.ts'
import { makeToken, verifyToken } from './token.ts'

const task = (id: number, extra: Partial<Task> = {}): Task => ({
  id, parentId: null, title: `t${id}`, type: 'feature', app: 'Hn', personId: null, person: '', status: 'done',
  date: '2026-10-20', note: '', shots: [], subtasks: [], ...extra,
})

test('period covers the day, the 7 days up to the date, or the calendar month', () => {
  assert.deepEqual(period('gunluk', '2026-10-23'), { from: '2026-10-23', to: '2026-10-23' })
  assert.deepEqual(period('haftalik', '2026-10-02'), { from: '2026-09-26', to: '2026-10-02' })
  assert.deepEqual(period('aylik', '2026-02-14'), { from: '2026-02-01', to: '2026-02-28' })
  assert.deepEqual(period('aylik', '2028-02-03'), { from: '2028-02-01', to: '2028-02-29' })
})

test('resolveRange accepts presets and custom ranges, rejects junk', () => {
  const t = today()
  assert.deepEqual(resolveRange({ range: 'bugun' }, '7'), { key: 'bugun', from: t, to: t })
  assert.equal(resolveRange({}, '30').key, '30')
  assert.deepEqual(resolveRange({ from: '2026-01-01', to: '2026-01-31' }, '7'), { key: 'ozel', from: '2026-01-01', to: '2026-01-31' })
  assert.equal(resolveRange({ from: '2026-02-01', to: '2026-01-01' }, '7').key, '7')
  assert.equal(resolveRange({ range: 'nope' }, '7').key, '7')
})

test('sanitizeTask rejects empty titles and unsafe values', () => {
  assert.throws(() => sanitizeTask({ title: '   ' }))
  const t = sanitizeTask({ title: ' x ', type: 'hack', status: 'gone', personId: '3', date: '2026-13-45', shots: [{ file: '../x.png' }, { file: 'abcdefghijklmnop.webp', caption: 2 }] })
  assert.equal(t.title, 'x')
  assert.equal(t.type, 'feature')
  assert.equal(t.status, 'todo')
  assert.equal(t.personId, null)
  assert.match(t.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.deepEqual(t.shots, [{ file: 'abcdefghijklmnop.webp', caption: '' }])
})

test('sanitizeReport keeps one article per app and valid kinds only', () => {
  const r = sanitizeReport({ kind: 'yillik', sections: [{ app: 'Hn', body: 'a' }, { app: 'Hn', body: 'b' }, { app: '' }] })
  assert.equal(r.kind, 'gunluk')
  assert.deepEqual(r.sections.map((s) => s.body), ['a'])
})

test('summarize counts finished top-level work by type, day, app and person', () => {
  const s = summarize(
    [
      task(1, { type: 'bug', person: 'Elif', subtasks: [task(9, { status: 'todo' }), task(10)] }),
      task(2, { app: 'Pazar', date: '2026-10-21', person: 'Elif' }),
      task(3, { status: 'doing', app: 'Pazar' }),
      task(4, { status: 'todo', date: '2026-10-21' }),
    ],
    '2026-10-20',
    '2026-10-21',
  )
  assert.equal(s.done, 2)
  assert.equal(s.doing, 1)
  assert.equal(s.todo, 1)
  assert.deepEqual([s.subDone, s.subTotal], [1, 2])
  assert.equal(s.byType.bug, 1)
  assert.deepEqual(s.byDay.map((d) => d.counts.feature + d.counts.bug), [1, 1])
  assert.deepEqual(s.byApp, [['Hn', 1], ['Pazar', 1]])
  assert.deepEqual(s.byPerson, [['Elif', 2]])
})

test('mergeLayout ignores unknown apps, keeps editor text and features exactly one app', () => {
  const data = sanitizeReport({
    kind: 'gunluk', date: '2026-10-23',
    sections: [{ app: 'Hn', headline: 'eski', body: 'editör', featured: true }, { app: 'Eski', body: 'kalsın' }],
  })
  const out = mergeLayout(
    data,
    {
      headline: 'Manşet', spot: '',
      sections: [
        { app: 'Pazar', headline: 'P', body: 'p', featured: true },
        { app: 'Hn', headline: '', body: '', featured: true },
        { app: 'Uydurma', headline: 'x', body: 'x', featured: false },
      ],
    },
    ['Hn', 'Pazar'],
  )
  assert.deepEqual(out.sections.map((s) => s.app), ['Pazar', 'Hn', 'Eski'])
  assert.equal(out.sections[1].body, 'editör')
  assert.deepEqual(out.sections.map((s) => s.featured), [true, false, false])
  assert.equal(out.headline, 'Manşet')
  assert.equal(out.spot, '')
})

test('session tokens verify, expire and reject tampering', () => {
  const key = 'k'.repeat(40)
  const t = makeToken(key, 1000)
  assert.ok(verifyToken(t, key, 2000))
  assert.ok(!verifyToken(t, 'x'.repeat(40), 2000))
  assert.ok(!verifyToken(t.replace(/^\d+/, '99999999999999'), key, 2000))
  assert.ok(!verifyToken(t, key, 1000 + 31 * 86_400_000))
  assert.ok(!verifyToken(undefined, key))
  assert.ok(!verifyToken('garbage', key))
})
