// Checks the store text against each store's character limits: node check.mjs
import { readFileSync } from 'node:fs'
const md = readFileSync(new URL('./listing.md', import.meta.url), 'utf8')
const limits = { 'App name': 30, 'Short description': 80, 'Full description': 4000, 'Release notes': 500, 'Name': 30, 'Subtitle': 30, 'Promotional text': 170, 'Keywords': 100, "What's New": 4000 }
let bad = 0
for (const [, label, body] of md.matchAll(/\*\*([^*\n]+)\*\*[^\n]*\n```\n([\s\S]*?)\n```/g)) {
  const key = Object.keys(limits).find((k) => label.startsWith(k))
  if (!key) continue
  const n = [...body].length
  const ok = n <= limits[key]
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'OVER'} ${label.padEnd(20)} ${n}/${limits[key]}`)
  if (key === 'Keywords' && /,\s/.test(body)) { bad++; console.log('     keywords must not have spaces after commas') }
}
process.exit(bad ? 1 : 0)
