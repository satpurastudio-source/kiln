// Generates what both native apps share from the web app's own source:
//   shared/locales/*.json — the translations
//   shared/fixtures/*.json — golden cases, computed by the real JS, that the
//   Swift and Kotlin tests must reproduce exactly.
// Run from the repo root: node native/scripts/gen-shared.mjs
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const out = join(here, '..', 'shared')
const write = (p, v) => writeFileSync(join(out, p), JSON.stringify(v, null, 1) + '\n')

// Every date-dependent case runs at a fixed local moment.
const RealDate = Date
let fixed = new RealDate(2026, 9, 31, 10, 30, 0).getTime() // Sat 31 Oct 2026
class FakeDate extends RealDate {
  constructor(...a) {
    if (a.length) super(...a)
    else super(fixed)
  }
  static now() {
    return fixed
  }
}
globalThis.Date = FakeDate
globalThis.window = { location: { search: '', hash: '', origin: 'http://x', pathname: '/' }, matchMedia: () => ({ matches: false }), addEventListener() {} }
globalThis.document = { documentElement: { classList: { toggle() {}, add() {} }, style: { setProperty() {} }, dataset: {} }, addEventListener() {} }
const mem = new Map()
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'], storage: {} }, configurable: true })

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const utils = await vite.ssrLoadModule('/src/utils.js')
const merge = await vite.ssrLoadModule('/src/merge.js')

// ---- locales
mkdirSync(join(out, 'locales'), { recursive: true })
for (const f of readdirSync(join(root, 'src/locales'))) {
  const code = f.replace('.js', '')
  const { default: dict } = await vite.ssrLoadModule(`/src/locales/${f}`)
  write(`locales/${code}.json`, dict)
}

// ---- quick-add parser
const projects = [
  { id: 'p1', name: 'Getting Started' },
  { id: 'p2', name: 'Work' },
  { id: 'p3', name: 'Side Project' },
  { id: 'p4', name: 'घर' },
]
const parseInputs = [
  '', '   ', 'gym', 'gym tomorrow 7am !high #fitness', 'pay rent 26 oct 6pm #home', 'pay rent friday 5pm !high #work',
  'Pay rent Friday 5pm !high #work', 'Buy diyas for Diwali nov 6 #personal', 'plan my week tomorrow 9am',
  'today', 'tonight call mom', 'call mom tonight', 'x day after tomorrow', 'x the day after tomorrow', 'x overmorrow',
  'x tmrw', 'x tmr', 'x next week', 'x next month', 'x weekend', 'x this weekend', 'x in 3 days', 'x in 2 weeks', 'x in 1 wk',
  'x in 999 weeks', 'x 26 oct', 'x 26th october', 'x 26 of oct', 'x 26 oct 2027', 'x on 26 oct', 'x by 26 oct', 'x due 26 oct',
  'x the 26th of oct', 'x oct 26', 'x october 26th', 'x oct 26, 2027', 'x 31 feb', 'x feb 31', 'x 29 feb', 'x 5 jan', 'x jan 5',
  'x 26/10', 'x 26-10-2026', 'x 26/10/27', 'x on 26/10', 'x by 26-10', 'read 1/2 of the book', 'x 45/13', 'x 31/2',
  'x the 30th', 'x on the 30th', 'x by the 5th', 'x 30th', 'x 31st', 'x 1st', 'x the 31st', 'x on friday', 'x this friday',
  'x next friday', 'x next saturday', 'x by mon', 'x friday', 'x sat', 'sat exam prep', 'wed plans', 'x thurs', 'x tues', 'x sun',
  'x p1', 'x p2', 'x p3', 'x !1', 'x !2', 'x !3', 'x !hi', 'x !med', 'x !medium', 'x !low', 'x !HIGH',
  'x 5pm', 'x 5 pm', 'x 12am', 'x 12pm', 'x 7:30 am', 'x at 14:00', 'x 9:05', 'x noon', 'x at noon', 'x midnight', 'x 13pm', 'x 25:00',
  'fix bug #12', 'x #work', 'x #wor', 'x #sideproject', 'x #side', 'x #started', 'x #घर', 'x #newfolder', 'x #नया', '#work', '!high', 'tomorrow', '5pm',
  'दूध लाना tomorrow 7am', 'मिलना 26 oct', 'a  b   c', 'x  tomorrow  !low  #work  3pm',
]
write('fixtures/parse.json', {
  now: [2026, 10, 31, 10, 30],
  projects,
  cases: parseInputs.map((input) => ({ input, output: utils.parseQuickAdd(input, projects) })),
})

// ---- repeats and formats
const nd = []
for (const due of ['2026-10-31', '2026-10-26', '2026-01-31', '2026-01-01', '2025-12-31', '2024-02-29', null])
  for (const repeat of ['daily', 'weekly', 'monthly']) nd.push({ due, repeat, next: utils.nextDue(due, repeat) })
write('fixtures/nextDue.json', { now: [2026, 10, 31, 10, 30], cases: nd })

const timeCases = ['00:00', '09:05', '12:00', '12:30', '14:30', '23:59', '7:05', 'nope', ''].map((v) => ({ value: v, label: utils.fmtTime(v) }))
const accents = ['#d85a30', '#112233', '#abc', '#ffffff', '#000000'].map((hex) => {
  const a = utils.deriveAccent(hex)
  return { hex, accent: a.accent, accent2: a.accent2, deep: a.deep, rgb: a.rgb }
})
const habits = {
  now: [2026, 10, 31, 10, 30],
  cases: [
    { log: {}, streak: 0 },
    { log: { '2026-10-31': true }, streak: 0 },
    { log: { '2026-10-30': true }, streak: 0 },
    { log: { '2026-10-31': true, '2026-10-30': true, '2026-10-29': true }, streak: 0 },
    { log: { '2026-10-30': true, '2026-10-29': true, '2026-10-27': true }, streak: 0 },
    { log: { '2026-11-01': true, '2026-10-31': true, '2026-09-30': true }, streak: 0 },
  ].map((c) => ({ log: c.log, streak: utils.habitStreak({ log: c.log }) })),
}
write('fixtures/misc.json', { now: [2026, 10, 31, 10, 30], times: timeCases, accents, habits: habits.cases })

// ---- backup parsing
const backupGood = {
  projects: [{ id: 'a', name: 'A' }, { id: null, name: 'bad' }, { id: 'b' }],
  tasks: [{ id: '1', title: 'x', projectId: 'a' }, { id: '2', title: 'y', projectId: 'gone', custom: 7 }, { id: '3' }, null],
  habits: [{ id: 'h' }, {}],
}
write('fixtures/backup.json', { input: JSON.stringify(backupGood), output: utils.parseBackup(JSON.stringify(backupGood)) })

// ---- three-way merge, including keys the native apps don't know about
const T = (id, o = {}) => ({ id, projectId: 'p', title: id, done: false, updatedAt: 1, ...o })
const P = (id, o = {}) => ({ id, name: id, ...o })
const snap = (tasks, projects = [P('p')], habits = [], seedV = 3) => ({ projects, tasks, habits, seedV })
const B = snap([T('a'), T('b'), T('c')])
const mergeCases = {
  identical: [B, B, B],
  'edit on remote only': [B, B, snap([T('a', { title: 'r', updatedAt: 2 }), T('b'), T('c')])],
  'edit on local only': [B, snap([T('a', { title: 'l', updatedAt: 2 }), T('b'), T('c')]), B],
  'different fields merge': [B, snap([T('a', { title: 'l', updatedAt: 2 }), T('b'), T('c')]), snap([T('a', { notes: 'r', updatedAt: 3 }), T('b'), T('c')])],
  'same field newer remote wins': [B, snap([T('a', { title: 'l', updatedAt: 2 }), T('b'), T('c')]), snap([T('a', { title: 'r', updatedAt: 3 }), T('b'), T('c')])],
  'same field newer local wins': [B, snap([T('a', { title: 'l', updatedAt: 9 }), T('b'), T('c')]), snap([T('a', { title: 'r', updatedAt: 3 }), T('b'), T('c')])],
  'same field tie goes local': [B, snap([T('a', { title: 'l', updatedAt: 3 }), T('b'), T('c')]), snap([T('a', { title: 'r', updatedAt: 3 }), T('b'), T('c')])],
  'deleted here edited there': [B, snap([T('b'), T('c')]), snap([T('a', { title: 'r', updatedAt: 2 }), T('b'), T('c')])],
  'deleted there edited here': [B, snap([T('a', { title: 'l', updatedAt: 2 }), T('b'), T('c')]), snap([T('b'), T('c')])],
  'deleted both': [B, snap([T('b'), T('c')]), snap([T('b'), T('c')])],
  'added both sides': [B, snap([T('n1'), T('a'), T('b'), T('c')]), snap([T('a'), T('b'), T('c'), T('n2')])],
  'same new id both sides': [B, snap([T('n', { title: 'l', updatedAt: 5 }), T('a'), T('b'), T('c')]), snap([T('n', { title: 'r', notes: 'k', updatedAt: 6 }), T('a'), T('b'), T('c')])],
  'local reorder wins order': [B, snap([T('c'), T('a'), T('b')]), snap([T('a'), T('b'), T('c'), T('z')])],
  'remote reorder followed': [B, snap([T('a'), T('b'), T('c'), T('y')]), snap([T('b'), T('c'), T('a')])],
  'orphan rehomed': [
    snap([T('a', { projectId: 'q' })], [P('p'), P('q')]),
    snap([T('a', { projectId: 'q' }), T('n', { projectId: 'q' })], [P('p'), P('q')]),
    snap([T('a', { projectId: 'q' })], [P('p')]),
  ],
  'habit logs merge key by key': [
    snap([], [P('p')], [{ id: 'h', log: { d1: true }, updatedAt: 1 }]),
    snap([], [P('p')], [{ id: 'h', log: { d1: true, d2: true }, updatedAt: 2 }]),
    snap([], [P('p')], [{ id: 'h', log: { d1: true, d3: true }, updatedAt: 3 }]),
  ],
  'unknown keys survive': [B, snap([T('a', { future: { x: [1, 'é', null] } }), T('b'), T('c')]), snap([T('a', { other: 2.5 }), T('b'), T('c')])],
  'null versus absent': [snap([T('a', { due: null })]), snap([T('a')]), snap([T('a', { due: null, title: 'r' })])],
  'seedV max': [snap([], [], [], 1), snap([], [], [], 2), snap([], [], [], 3)],
  'empty base': [{}, snap([T('a')]), snap([T('b')])],
  'folder removed everywhere keeps tasks': [snap([T('a')]), snap([T('a')], []), snap([T('a')], [])],
}
write('fixtures/merge.json', {
  cases: Object.entries(mergeCases).map(([name, [base, local, remote]]) => ({
    name,
    base,
    local,
    remote,
    merged: merge.mergeSnapshots(base, local, remote),
  })),
})

// ---- canonical serialization
const strings = [{ b: 1, a: [true, null, 'x"\n\\é✦😀'], c: { z: 1.5, y: -2, x: 1700000000000 } }, [], {}, 'plain', 0, 1e21, 0.1]
write('fixtures/stable.json', { cases: strings.map((value) => ({ value, json: merge.stableStringify(value) })) })

await vite.close()
process.exit(0)
