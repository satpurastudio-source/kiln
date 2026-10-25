// Supabase Edge Function: private product analytics for the kiln owner.
//
// Reads every account + synced row with the service-role key and returns
// aggregates only — counts and daily series, never task titles or notes.
// The one per-person view is the recent sign-ups list (email, dates, counts),
// which is the same information the Supabase dashboard already shows.
//
// Only emails listed in the ADMIN_EMAILS secret get an answer:
//   supabase secrets set ADMIN_EMAILS=you@example.com
//   supabase functions deploy admin-stats
//
// Guests ("continue on this device") never reach the server, so they are
// invisible here by design.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const DAY = 86_400_000
const SERIES_DAYS = 30
// kiln's audience is in India, so days roll over at IST midnight
const dayKey = (ms: number) => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10)

type Task = { createdAt?: number; done?: boolean; doneAt?: number | null; pomos?: number; subtasks?: unknown[] }
type Blob = { tasks?: Task[]; projects?: unknown[]; habits?: { log?: Record<string, unknown> }[] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Missing Authorization header' })

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admins = (Deno.env.get('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: userErr,
    } = await asUser.auth.getUser()
    if (userErr || !user) return json(401, { error: 'Invalid or expired token' })
    if (!user.email || !admins.includes(user.email.toLowerCase())) return json(403, { error: 'Not an admin' })

    const admin = createClient(url, service)

    // every auth user, paged
    const users = []
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return json(500, { error: error.message })
      users.push(...data.users)
      if (data.users.length < 1000) break
    }

    // every synced row, paged
    const rows: { user_id: string; data: Blob; updated_at: string }[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from('kiln_data')
        .select('user_id, data, updated_at')
        .range(from, from + 999)
      if (error) return json(500, { error: error.message })
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    const rowOf = new Map(rows.map((r) => [r.user_id, r]))

    const now = Date.now()
    const within = (iso: string | null | undefined, days: number) => !!iso && now - Date.parse(iso) < days * DAY

    // empty 30-day series
    const days: string[] = []
    for (let i = SERIES_DAYS - 1; i >= 0; i--) days.push(dayKey(now - i * DAY))
    const series = Object.fromEntries(
      days.map((d) => [d, { signups: 0, created: 0, completed: 0, active: new Set<string>() }])
    )

    let tasks = 0,
      done = 0,
      pomos = 0,
      projects = 0,
      habits = 0,
      withSubtasks = 0,
      withHabits = 0,
      emptyAccounts = 0,
      returned = 0 // still making changes a week or more after signing up
    const perUserTasks: number[] = []

    for (const u of users) {
      const signup = dayKey(Date.parse(u.created_at))
      if (series[signup]) series[signup].signups++

      const row = rowOf.get(u.id)
      const blob: Blob = row?.data ?? {}
      const list = Array.isArray(blob.tasks) ? blob.tasks : []
      const hs = Array.isArray(blob.habits) ? blob.habits : []
      tasks += list.length
      perUserTasks.push(list.length)
      projects += Array.isArray(blob.projects) ? blob.projects.length : 0
      habits += hs.length
      if (hs.length) withHabits++
      if (!list.length && !hs.length) emptyAccounts++
      if (row && Date.parse(row.updated_at) - Date.parse(u.created_at) >= 7 * DAY) returned++

      for (const t of list) {
        if (t.done) done++
        pomos += t.pomos || 0
        if (Array.isArray(t.subtasks) && t.subtasks.length) withSubtasks++
        if (t.createdAt) {
          const s = series[dayKey(t.createdAt)]
          if (s) {
            s.created++
            s.active.add(u.id)
          }
        }
        if (t.done && t.doneAt) {
          const s = series[dayKey(t.doneAt)]
          if (s) {
            s.completed++
            s.active.add(u.id)
          }
        }
      }
      for (const h of hs) for (const d of Object.keys(h.log ?? {})) series[d]?.active.add(u.id)
    }

    perUserTasks.sort((a, b) => a - b)
    const median = perUserTasks.length ? perUserTasks[Math.floor(perUserTasks.length / 2)] : 0
    const verified = users.filter((u) => u.email_confirmed_at).length

    const recent = [...users]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 25)
      .map((u) => {
        const row = rowOf.get(u.id)
        const list = row?.data?.tasks ?? []
        return {
          email: u.email,
          signedUp: u.created_at,
          verified: !!u.email_confirmed_at,
          lastSignIn: u.last_sign_in_at ?? null,
          lastChange: row?.updated_at ?? null,
          tasks: list.length,
          done: list.filter((t) => t.done).length,
        }
      })

    return json(200, {
      generatedAt: new Date(now).toISOString(),
      users: {
        total: users.length,
        verified,
        new7: users.filter((u) => within(u.created_at, 7)).length,
        new30: users.filter((u) => within(u.created_at, 30)).length,
        active1: rows.filter((r) => within(r.updated_at, 1)).length,
        active7: rows.filter((r) => within(r.updated_at, 7)).length,
        active30: rows.filter((r) => within(r.updated_at, 30)).length,
        returned,
        empty: emptyAccounts,
      },
      content: {
        tasks,
        done,
        open: tasks - done,
        projects,
        habits,
        withHabits,
        withSubtasks,
        pomos,
        medianTasksPerUser: median,
      },
      series: days.map((d) => ({
        day: d,
        signups: series[d].signups,
        created: series[d].created,
        completed: series[d].completed,
        active: series[d].active.size,
      })),
      recent,
    })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})
