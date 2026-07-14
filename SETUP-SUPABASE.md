# kiln × Supabase — one-time setup

Three steps in the dashboard and you're live. ~10 minutes.

---

## 1. Create the sync table (required)

Dashboard → **SQL Editor** → New query → paste and Run:

```sql
create table public.kiln_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kiln_data enable row level security;

create policy "read own data"
  on public.kiln_data for select
  using (auth.uid() = user_id);

create policy "insert own data"
  on public.kiln_data for insert
  with check (auth.uid() = user_id);

create policy "update own data"
  on public.kiln_data for update
  using (auth.uid() = user_id);
```

Row Level Security means each user can only ever touch their own row —
that's why the anon key is safe to ship in the app.

## 1b. Enable instant cross-device sync (Realtime)

Same SQL Editor, run this one-liner:

```sql
alter publication supabase_realtime add table public.kiln_data;
```

That broadcasts row changes over a websocket — complete a task on your
phone and it appears on your laptop in under a second, no refresh.
(Without this, devices still sync — on sign-in and whenever the tab
regains focus — just not live.)

## 2. Auth URL configuration (required)

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:5173` (change to your real domain when you deploy)
- **Redirect URLs** → add: `http://localhost:5173/?verified=1`
  (and later `https://your-domain/?verified=1`)

This is where the email-verification link drops users — kiln shows them the
animated "Email verified." page and takes them in.

## 3. Brevo SMTP (so verification emails actually send)

The built-in Supabase mailer only sends ~2 emails/hour and only to your own
team — fine for your first test, useless for real users. Brevo gives you
300 emails/day free.

**On Brevo (brevo.com):**
1. Create a free account and log in.
2. Top-right menu → **SMTP & API** → **SMTP** tab.
3. Click **Generate a new SMTP key** — copy it (this is your SMTP password).
   Note the values shown: server `smtp-relay.brevo.com`, port `587`,
   login (your Brevo account email).
4. Go to **Senders, Domains & Dedicated IPs → Senders** → make sure the
   email you want to send *from* (e.g. your Gmail) is listed and **verified**.

**On Supabase:**
1. Dashboard → **Project Settings → Authentication** (or Auth → Emails → SMTP Settings).
2. Enable **Custom SMTP** and fill in:
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Username: your Brevo login email
   - Password: the SMTP key you generated
   - Sender email: your verified Brevo sender
   - Sender name: `kiln`
3. Save. Then go to **Authentication → Rate Limits** — with custom SMTP the
   email limit unlocks (default 30/hour, raise if you ever need to).

Optional polish: **Authentication → Emails → Templates** → edit the
"Confirm signup" template (custom SMTP unlocks template editing on free tier).
Keep the `{{ .ConfirmationURL }}` variable — that's the magic link.

## Test checklist

1. `npm run dev`, open http://localhost:5173
2. **Create an account** with a real email of yours
3. You should see the "Check your inbox" screen → open the email → click the link
4. You land on **"Email verified."** with confetti → *Enter kiln*
5. Add a task, then open the site in another browser / your phone, sign in —
   the task is there. That's the sync working.
6. Ctrl+K → **Sign out** when you want to switch accounts.

## How the sync works (for your README / interview answers)

- Local-first: everything is written to `localStorage` instantly, so the app
  works offline and guests never touch the network.
- Signed in: every change is debounced ~1.2s and upserted as a single JSONB
  document per user (`kiln_data.data`). On sign-in, the cloud copy wins;
  if the account has no cloud copy yet, the device's data is adopted.
- Last-write-wins — simple and right-sized for a personal task app.
