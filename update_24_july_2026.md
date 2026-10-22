# kiln — what's new this cycle

Everything below was added or changed in this round of work. Baseline features
that already existed (tasks, folders, calendar, drag‑to‑complete, cloud sync,
password reset, etc.) are not re-listed here.

---

## Onboarding & first run

- **New Duolingo-style flow** — the app now personalizes *before* asking you to
  sign in. Order: your name → accent color + light/dark → *"What's on your
  plate?"* → an animated feature tour → account.
- **Animated feature tour** — each feature is *shown*, not just described, with a
  small looping animation: natural-language capture (words turning into pills),
  tap-to-complete, the calendar filling with due-dots, a Pomodoro ring sweeping,
  and habits + Insights building momentum.
- **Purpose picker builds folders** — choosing Work / Study / Personal / Fitness /
  Side project / Errands creates matching folders. The "Getting Started" tutorial
  folder is always preserved.
- **Add your first task in-flow** — the "how it works" step captures a real task
  and drops it on Today, so you never land on an empty screen.
- **Account step is last** — "Create a free account" / "Continue on this device"
  (guest) / "Sign in." Choosing an account hands your name + intent to the login
  screen so it's pre-filled. Returning users and existing accounts skip the tour.
- **Replayable** — reopen the tour anytime from Settings or the command palette.
- **Typewriter loader plays only once** — the boot animation runs on first-ever
  open, then boots straight in on every visit after.

## Personalization & theming

- **6 accent themes** — Terracotta, Ember, Amber, Sage, Ocean, Plum — that retint
  the *entire* app instantly. Every hardcoded accent color was routed through a
  CSS variable so the theming is consistent, not patchy.
- **Custom accent color** — a "+" swatch opens a color wheel; any hex becomes your
  accent, with lighter/darker/rgb variants auto-derived. The color applies on a
  confirm **Apply** button (dragging the wheel no longer retints live, which was
  laggy).
- **Editable display name** — drives your Today greeting.

## Quick capture

- **Natural-language quick-add** — type it how you'd say it:
  `gym tomorrow 7am !high #fitness`. kiln parses the date, time, priority, and
  folder, strips those words from the title, and shows a live "reading:" preview
  of what it understood. Understands today/tonight/tomorrow, weekday names,
  `next week`, `in N days`, `5pm`/`9:30am`/`at 14:00`/`noon`/`midnight`,
  `p1‑p3` / `!high‑!low`, and `#folder`.
- **`#folder` creates folders on the fly** — if the tag matches an existing folder
  the task goes into it; if it doesn't, kiln creates that folder (auto-named and
  colored) and files the task there. The live preview shows a dashed
  "＋ New folder · Fitness" pill so you know before you hit Enter.
- **Exact time on tasks** — set a time in the quick-add bar or the task editor;
  shown as "Today · 9:30 AM" and synced like any other field.
- **Smart new-task defaults** — Settings → New task defaults: default due date,
  default priority, and default time, which pre-fill the quick-add bar.

## Insights (habits + analytics)

- **New Insights view** in the sidebar.
- **Habits & streaks** — add a daily habit with a color, check it off each day,
  and watch a 🔥 streak and a 14-day tracker build.
- **This-week analytics** — stat cards (done this week, day streak, focus
  sessions, best day), a 7-day completion bar chart, a per-folder breakdown, and
  "you finish the most around …".
- **Analytics survive clearing tasks** — completions are recorded in a persistent
  log, so clearing or deleting completed tasks no longer wipes your Insights.
  Existing history is backfilled once from your current tasks.
- Habits sync across devices alongside tasks and folders.

## Focus timer

- **Custom durations** — a "Custom" mode with editable Focus / Break minutes,
  alongside the 25·5 and 50·10 presets. Completed pomodoros feed Insights.

## Organizing & cleanup

- **Archive** — tuck a task away without deleting it (from the task editor).
  Archived tasks get their own tab and stay out of your lists, counts, calendar,
  and progress until you restore them.
- **Trash** — deleting a task now sends it to Trash instead of destroying it. Each
  item shows a live countdown, can be restored or deleted immediately, and is
  auto-erased after 20 seconds (trial window — one constant to raise later).
- **Contextual tips** — first time you open Calendar, Focus, or Insights, a small
  one-time hint explains the feature, then never nags again.

## Navigation & UI polish

- **"Projects" renamed to "Folders"** everywhere (sidebar, header, modal, palette,
  toasts).
- **All progress indicators match the theme** — the folder rings, Today/folder
  bars, and focus ring all use your accent color so nothing looks off-palette.
- **Trimmed onboarding** — the calendar/focus/habits demo steps moved out of the
  (now shorter) tour and into the contextual tips above.
- **Filled selected nav icons** — the active view's icon renders filled and
  accent-tinted.
- **Goal completion gradient** — a progress bar on Today and inside each folder
  with a shimmer sweep, a glow that intensifies near 100%, and milestone
  microcopy ("halfway there" → "so close — one more push ✦" → "cleared").
- **A real Settings panel** — name, accent, theme, sound, new-task defaults,
  notifications, reduced visuals, replay tour, export, sign out.
- **Friendlier empty states** and clearer copy throughout.
- **Touch "+" affordance** — on touch devices the keyboard "N" hint becomes a
  tappable + button (the shortcut still shows on desktop).

## Performance & accessibility

- **Reduced-visuals mode** — Settings → Appearance: turns off blur, aurora, glow,
  and confetti for a lighter, faster feel on older phones.
- **Smoother task completion on mobile** — the confetti and particle burst (the
  source of the tap-to-complete stutter) are skipped on touch devices and in
  reduced mode.
- **Custom cursor removed** — the OS cursor is back.
- **Softer hover tilt** — the 3D task-row tilt is subtler and disabled in reduced
  mode.

## Bug fixes

- **Green-star / emoji icons** — folder glyphs now force monochrome text
  rendering, so they never turn into colored system emoji.
- **Insights reset on clearing completed tasks** — fixed via the persistent
  completion log (see Insights above).
- **Laggy custom color wheel** — the accent now applies only when you press Apply,
  not on every drag tick.
- **Custom color picker not working** — reworked into a visible color well + a hex
  field + Apply, so it's reliable across browsers/platforms (the old hidden input
  didn't open the picker everywhere).
- **Misaligned icons** — every inline icon now renders as a block element and the
  search glass is grid-centered, fixing the off-center look.
