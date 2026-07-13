import { createClient } from '@supabase/supabase-js'

// The anon key is public by design — safety comes from Row Level Security
// on the tables (see SETUP-SUPABASE.md).
const SUPABASE_URL = 'https://hdrqegyvegsbpjdjmozp.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcnFlZ3l2ZWdzYnBqZGptb3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTU1NDIsImV4cCI6MjA5OTUzMTU0Mn0.U06b0zXbXLrUCdffRh21yvNJh9jKy8NcXfGXDgTHC80'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/** Load the signed-in user's kiln data (or null if none saved yet). */
export async function pullCloud(userId) {
  const { data, error } = await supabase
    .from('kiln_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.data ?? null
}

/** Save the user's projects + tasks. Last write wins. */
export async function pushCloud(userId, payload) {
  const { error } = await supabase.from('kiln_data').upsert({
    user_id: userId,
    data: payload,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
