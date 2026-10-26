import { createClient } from '@supabase/supabase-js'

// The anon key is public by design — safety comes from Row Level Security
// on the tables (see SETUP-SUPABASE.md).
const SUPABASE_URL = 'https://hdrqegyvegsbpjdjmozp.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcnFlZ3l2ZWdzYnBqZGptb3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTU1NDIsImV4cCI6MjA5OTUzMTU0Mn0.U06b0zXbXLrUCdffRh21yvNJh9jKy8NcXfGXDgTHC80'

// An email link that didn't work (used already, or expired) lands with the
// error in the URL. Read it before the client tidies the URL away.
const linkParams = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`)
export const linkFailed = linkParams.has('error_code') || linkParams.has('error')

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
