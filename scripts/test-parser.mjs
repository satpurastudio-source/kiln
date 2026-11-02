// Tests natural-language add, Hinglish and Hindi above all.
// Run from the repo root: node scripts/test-parser.mjs [older-parse-fixture.json]
// With a fixture, also checks that every earlier result is unchanged.
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const RealDate = Date
const fixed = new RealDate(2026, 9, 31, 10, 30, 0).getTime() // Sat 31 Oct 2026
globalThis.Date = class extends RealDate {
  constructor(...a) {
    if (a.length) super(...a)
    else super(fixed)
  }
  static now() {
    return fixed
  }
}
globalThis.window = { location: { search: '', hash: '', origin: 'http://x', pathname: '/' }, matchMedia: () => ({ matches: false }), addEventListener() {} }
globalThis.document = { documentElement: { classList: { toggle() {}, add() {} }, style: { setProperty() {} }, dataset: {} }, addEventListener() {} }
const mem = new Map()
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en'], storage: {} }, configurable: true })

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const { parseQuickAdd } = await vite.ssrLoadModule('/src/utils.js')

// input, title, due, time
const CASES = [
  ['mummy ko kal 6 baje call', 'mummy ko call', '2026-11-01', '18:00'],
  ['Mummy ko KAL 6 BAJE call', 'Mummy ko call', '2026-11-01', '18:00'],
  ['kal subah 7 baje gym', 'gym', '2026-11-01', '07:00'],
  ['gym kal subah 7', 'gym', '2026-11-01', '07:00'],
  ['rent dena shukravar sham 5 baje', 'rent dena', '2026-11-06', '17:00'],
  ['friday ko rent dena', 'rent dena', '2026-11-06', undefined],
  ['agle friday ko rent dena', 'rent dena', '2026-11-13', undefined],
  ['is friday rent dena', 'rent dena', '2026-11-06', undefined],
  ['agle shukravar rent', 'rent', '2026-11-13', undefined],
  ['doodh lana aaj', 'doodh lana', '2026-10-31', undefined],
  ['aaj raat 9 baje khana', 'khana', '2026-10-31', '21:00'],
  ['aaj raat khana', 'khana', '2026-10-31', undefined],
  ['report kal tak bhejna', 'report bhejna', '2026-11-01', undefined],
  ['kal ki meeting prepare', 'meeting prepare', '2026-11-01', undefined],
  ['kal ko bank jaana', 'bank jaana', '2026-11-01', undefined],
  ['bank parso', 'bank', '2026-11-02', undefined],
  ['bank narso', 'bank', '2026-11-03', undefined],
  ['x agle hafte', 'x', '2026-11-07', undefined],
  ['x agle week', 'x', '2026-11-07', undefined],
  ['x agle mahine', 'x', '2026-11-30', undefined],
  ['x 3 din baad', 'x', '2026-11-03', undefined],
  ['x 2 din mein', 'x', '2026-11-02', undefined],
  ['x 2 hafte baad', 'x', '2026-11-14', undefined],
  ['x is weekend', 'x', '2026-10-31', undefined],
  ['x sunday ko', 'x', '2026-11-01', undefined],
  ['x itwar', 'x', '2026-11-01', undefined],
  // times
  ['x 1 baje', 'x', undefined, '13:00'],
  ['x 6 baje', 'x', undefined, '18:00'],
  ['x 7 baje', 'x', undefined, '07:00'],
  ['x 12 baje', 'x', undefined, '12:00'],
  ['x 6baje', 'x', undefined, '18:00'],
  ['x 6 bje', 'x', undefined, '18:00'],
  ['x 6 baje ko', 'x', undefined, '18:00'],
  ['x 6:30 baje', 'x', undefined, '18:30'],
  ['x 14 baje', 'x', undefined, '14:00'],
  ['x saade 6 baje', 'x', undefined, '18:30'],
  ['x sawa 6 baje', 'x', undefined, '18:15'],
  ['x paune 6 baje', 'x', undefined, '17:45'],
  ['x paune 1 baje', 'x', undefined, '12:45'],
  ['x dedh baje', 'x', undefined, '13:30'],
  ['x dhai baje', 'x', undefined, '14:30'],
  ['x subah 8 baje', 'x', undefined, '08:00'],
  ['x subah ke 8 baje', 'x', undefined, '08:00'],
  ['x sham ko 6 baje', 'x', undefined, '18:00'],
  ['x shaam saade 6 baje', 'x', undefined, '18:30'],
  ['x dopahar 2 baje', 'x', undefined, '14:00'],
  ['x dopahar 12 baje', 'x', undefined, '12:00'],
  ['x dopahar 11 baje', 'x', undefined, '11:00'],
  ['x raat 9 baje', 'x', undefined, '21:00'],
  ['x raat 12 baje', 'x', undefined, '00:00'],
  ['x raat 1 baje', 'x', undefined, '01:00'],
  ['x raat 9pm', 'x', undefined, '21:00'],
  ['x subah 7am', 'x', undefined, '07:00'],
  ['x kal 5pm', 'x', '2026-11-01', '17:00'],
  // Devanagari
  ['मम्मी को कल 6 बजे कॉल', 'मम्मी को कॉल', '2026-11-01', '18:00'],
  ['किराया शुक्रवार शाम 5 बजे', 'किराया', '2026-11-06', '17:00'],
  ['जिम कल सुबह ७ बजे', 'जिम', '2026-11-01', '07:00'],
  ['दूध आज', 'दूध', '2026-10-31', undefined],
  ['x परसों', 'x', '2026-11-02', undefined],
  ['x साढ़े 6 बजे', 'x', undefined, '18:30'],
  ['x साढ़े 6 बजे', 'x', undefined, '18:30'],
  ['x ढाई बजे', 'x', undefined, '14:30'],
  ['x अगले हफ्ते', 'x', '2026-11-07', undefined],
  ['x 3 दिन बाद', 'x', '2026-11-03', undefined],
  // must stay plain titles
  ['Kalpana ko call', 'Kalpana ko call', undefined, undefined],
  ['kal wala kaam', 'kal wala kaam', undefined, undefined],
  ['Aajtak dekhna', 'Aajtak dekhna', undefined, undefined],
  ['parsons report', 'parsons report', undefined, undefined],
  ['subah ka walk', 'subah ka walk', undefined, undefined],
  ['kal', 'kal', undefined, undefined],
  ['6 baje', '6 baje', undefined, undefined],
  ['x 25 baje', 'x 25 baje', undefined, undefined],
  ['raat 45 ko', 'raat 45 ko', undefined, undefined],
  ['saturn sham', 'saturn sham', undefined, undefined],
  ['this is weekly', 'this is weekly', undefined, undefined],
  ['buy 2 weeks supply', 'buy 2 weeks supply', undefined, undefined],
  ['mangal pandey movie', 'mangal pandey movie', undefined, undefined],
]

let bad = 0
for (const [input, title, due, time] of CASES) {
  const r = parseQuickAdd(input, [])
  if (r.title !== title || r.due !== due || r.time !== time) {
    bad++
    console.log(`FAIL "${input}"\n  want ${title} | ${due} | ${time}\n  got  ${r.title} | ${r.due} | ${r.time}`)
  }
}
console.log(`${CASES.length - bad}/${CASES.length} Hinglish and Hindi cases pass`)

const older = process.argv[2]
if (older) {
  const { projects, cases } = JSON.parse(readFileSync(older, 'utf8'))
  let changed = 0
  for (const { input, output } of cases) {
    const now = parseQuickAdd(input, projects)
    if (JSON.stringify(now) !== JSON.stringify(output)) {
      changed++
      console.log(`CHANGED "${input}"\n  was ${JSON.stringify(output)}\n  now ${JSON.stringify(now)}`)
    }
  }
  console.log(`${cases.length - changed}/${cases.length} earlier results unchanged`)
  bad += changed
}
await vite.close()
process.exit(bad ? 1 : 0)
