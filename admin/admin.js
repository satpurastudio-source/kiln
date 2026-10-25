// kiln owner analytics — a separate page, never part of the app build.
// Run with `npm run admin`. Sign in with a kiln account whose email is in
// the admin-stats function's ADMIN_EMAILS secret; everyone else gets a 403.
import { supabase } from '../src/supabase.js'

const $ = (id) => document.getElementById(id)
const fmt = (n) => Number(n).toLocaleString('en-IN')
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')
const ago = (iso) => {
  if (!iso) return '—'
  const m = (Date.now() - Date.parse(iso)) / 60000
  if (m < 60) return `${Math.max(1, Math.round(m))}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}
const date = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      })
    : '—'
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

async function load() {
  $('error').textContent = ''
  $('refresh').disabled = true
  const { data, error } = await supabase.functions.invoke('admin-stats')
  $('refresh').disabled = false
  if (error) {
    let msg = error.message
    try {
      msg = (await error.context.json()).error ?? msg
    } catch {
      /* not a JSON body */
    }
    $('error').textContent = msg === 'Not an admin' ? 'This account isn’t on the admin list.' : `Couldn’t load: ${msg}`
    return
  }
  render(data)
}

function tile(label, value, note = '') {
  return `<div class="card tile"><div class="label">${label}</div><div class="value">${value}</div><div class="note">${note}</div></div>`
}

// one-series bar chart over the 30-day window
function bars(title, series, key, perDay = false) {
  const W = 300,
    H = 120,
    gap = 2
  const max = Math.max(1, ...series.map((d) => d[key]))
  const bw = (W - gap * (series.length - 1)) / series.length
  const total = series.reduce((s, d) => s + d[key], 0)
  const marks = series
    .map((d, i) => {
      const h = (d[key] / max) * H
      const x = i * (bw + gap)
      const r = Math.min(4, bw / 2, h)
      // rounded top, square base
      const path = h
        ? `M${x},${H} V${H - h + r} Q${x},${H - h} ${x + r},${H - h} H${x + bw - r} Q${x + bw},${H - h} ${x + bw},${H - h + r} V${H} Z`
        : ''
      const label = `${new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${d[key]}`
      return `<rect class="hit" x="${x}" y="0" width="${bw + gap}" height="${H}" fill="transparent" data-tip="${label}"/><path class="bar" d="${path}"/>`
    })
    .join('')
  const first = series[0]?.day.slice(5)
  const last = series.at(-1)?.day.slice(5)
  return `<div class="card chart">
    <h3>${title}<span>${perDay ? `${fmt(Math.round(total / series.length))} a day on average` : `${fmt(total)} in 30 days`} · peak ${fmt(max)}</span></h3>
    <svg viewBox="0 -4 ${W} ${H + 22}" preserveAspectRatio="none" role="img" aria-label="${title}, last 30 days">
      <line class="grid" x1="0" x2="${W}" y1="${H}" y2="${H}"/>
      <line class="grid" x1="0" x2="${W}" y1="0" y2="0"/>
      ${marks}
      <text class="axis" x="0" y="${H + 16}">${first}</text>
      <text class="axis" x="${W}" y="${H + 16}" text-anchor="end">${last}</text>
    </svg>
  </div>`
}

function render(d) {
  const u = d.users,
    c = d.content
  $('stamp').textContent =
    `updated ${new Date(d.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  $('dash').innerHTML = `
    <h2>People</h2>
    <div class="tiles">
      ${tile('Accounts', fmt(u.total), `${pct(u.verified, u.total)} verified`)}
      ${tile('New · 7 days', fmt(u.new7), `${fmt(u.new30)} in 30 days`)}
      ${tile('Active today', fmt(u.active1), 'synced a change in 24h')}
      ${tile('Active · 7 days', fmt(u.active7), `${pct(u.active7, u.total)} of accounts`)}
      ${tile('Active · 30 days', fmt(u.active30), `${pct(u.active30, u.total)} of accounts`)}
      ${tile('Came back', fmt(u.returned), 'still editing 7+ days after sign-up')}
      ${tile('Never started', fmt(u.empty), 'no tasks or habits')}
    </div>

    <h2>Last 30 days</h2>
    <div class="charts">
      ${bars('Sign-ups', d.series, 'signups')}
      ${bars('Active people', d.series, 'active', true)}
      ${bars('Tasks added', d.series, 'created')}
      ${bars('Tasks completed', d.series, 'completed')}
    </div>
    <details>
      <summary>Show as a table</summary>
      <div class="table-wrap card" style="margin-top:8px">
        <table>
          <thead><tr><th>Day</th><th class="num">Sign-ups</th><th class="num">Active</th><th class="num">Added</th><th class="num">Completed</th></tr></thead>
          <tbody>${[...d.series]
            .reverse()
            .map(
              (s) =>
                `<tr><td>${s.day}</td><td class="num">${s.signups}</td><td class="num">${s.active}</td><td class="num">${s.created}</td><td class="num">${s.completed}</td></tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
    </details>

    <h2>What people make</h2>
    <div class="tiles">
      ${tile('Tasks', fmt(c.tasks), `${fmt(c.open)} open · ${pct(c.done, c.tasks)} done`)}
      ${tile('Tasks per person', fmt(c.medianTasksPerUser), 'median')}
      ${tile('Folders', fmt(c.projects))}
      ${tile('Habits', fmt(c.habits), `${fmt(c.withHabits)} people use habits`)}
      ${tile('With subtasks', fmt(c.withSubtasks), 'tasks')}
      ${tile('Focus sessions', fmt(c.pomos), 'pomodoros logged')}
    </div>

    <h2>Recent sign-ups</h2>
    <div class="table-wrap card">
      <table>
        <thead><tr><th>Email</th><th>Signed up</th><th>Verified</th><th>Last sign-in</th><th>Last change</th><th class="num">Tasks</th><th class="num">Done</th></tr></thead>
        <tbody>${d.recent
          .map(
            (r) =>
              `<tr><td>${esc(r.email)}</td><td>${date(r.signedUp)}</td><td>${r.verified ? 'yes' : 'no'}</td><td>${ago(r.lastSignIn)}</td><td>${ago(r.lastChange)}</td><td class="num">${r.tasks}</td><td class="num">${r.done}</td></tr>`,
          )
          .join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="margin-top:14px">Counts signed-in accounts only. Guests who use kiln without an account never reach the server. “Active” means synced a change.</p>
  `
  $('dash').hidden = false
}

// bar hover tooltip
document.addEventListener('pointerover', (e) => {
  const t = e.target.closest?.('[data-tip]')
  const tip = $('tip')
  if (!t) return (tip.hidden = true)
  const r = t.getBoundingClientRect()
  tip.textContent = t.dataset.tip
  tip.style.left = `${r.left + r.width / 2}px`
  tip.style.top = `${r.top + 8}px`
  tip.hidden = false
})

function show(signedIn) {
  $('login').hidden = signedIn
  document.querySelector('.top-actions').hidden = !signedIn
  if (!signedIn) $('dash').hidden = true
}

$('login').addEventListener('submit', async (e) => {
  e.preventDefault()
  $('login-error').textContent = ''
  const { error } = await supabase.auth.signInWithPassword({
    email: $('email').value,
    password: $('password').value,
  })
  if (error) $('login-error').textContent = error.message
})
$('refresh').addEventListener('click', load)
$('signout').addEventListener('click', () => supabase.auth.signOut())

// ?demo — sample numbers, no sign-in, for previewing the layout
if (new URLSearchParams(location.search).has('demo')) {
  const now = Date.now()
  const day = (i) => new Date(now - (29 - i) * 864e5).toISOString().slice(0, 10)
  show(true)
  render({
    generatedAt: new Date(now).toISOString(),
    users: {
      total: 142,
      verified: 120,
      new7: 18,
      new30: 61,
      active1: 22,
      active7: 54,
      active30: 97,
      returned: 40,
      empty: 31,
    },
    content: {
      tasks: 3810,
      done: 2210,
      open: 1600,
      projects: 402,
      habits: 188,
      withHabits: 49,
      withSubtasks: 300,
      pomos: 512,
      medianTasksPerUser: 14,
    },
    series: [...Array(30)].map((_, i) => ({
      day: day(i),
      signups: (i * 7) % 5,
      active: 10 + ((i * 13) % 17),
      created: 40 + ((i * 31) % 60),
      completed: 30 + ((i * 17) % 50),
    })),
    recent: [...Array(6)].map((_, i) => ({
      email: `sample${i + 1}@example.com`,
      signedUp: new Date(now - i * 2e8).toISOString(),
      verified: i % 3 !== 0,
      lastSignIn: new Date(now - i * 5e6).toISOString(),
      lastChange: new Date(now - i * 9e6).toISOString(),
      tasks: 20 - i,
      done: 10 - i,
    })),
  })
  $('stamp').textContent = 'demo data'
} else
  supabase.auth.onAuthStateChange((event, session) => {
    show(!!session)
    if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) load()
  })
