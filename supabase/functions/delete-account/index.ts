// Supabase Edge Function: permanently delete the calling user's account.
//
// A client using the anon key cannot delete its own auth user, so this runs
// server-side with the service-role key. It verifies the caller's JWT, deletes
// their kiln_data row, then deletes the auth user itself.
//
// Deploy:  supabase functions deploy delete-account
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected
//  automatically by the platform — no secrets to set.)

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Missing Authorization header' })

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // identify the caller from their JWT
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await asUser.auth.getUser()
    if (userErr || !user) return json(401, { error: 'Invalid or expired token' })

    // admin client wipes their data + auth record
    const admin = createClient(url, service)
    // data first, and stop if it fails — never leave an orphaned row of
    // someone's tasks behind a deleted account
    const { error: dataErr } = await admin.from('kiln_data').delete().eq('user_id', user.id)
    if (dataErr) return json(500, { error: dataErr.message })
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) return json(500, { error: delErr.message })

    return json(200, { ok: true })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})
