# kiln. — task studio

_shape · fire · ship_

A premium-feeling project & task manager with a cream/terracotta editorial style —
typewriter boot screen, film grain, spring-physics animations, sounds, confetti,
natural-language quick add, a command palette, and cross-device sync.

A **[Satpura Studio](https://satpurastudio.com)** product. Built with React + Vite +
Framer Motion. Data persists locally and syncs to the cloud when you sign in.
To rename the app, edit `src/brand.js` (one place) and the `<title>` in `index.html`.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Features

- **Folders** with custom color + icon and live progress rings
- **Natural-language quick add** — type `gym tomorrow 7am !high #fitness` and it parses
  the date, time, priority, and folder (creating the folder if it doesn't exist)
- **Views** — Today, Upcoming, Calendar, All Tasks, per-folder
- **Insights** — daily habits with streaks, plus a weekly completion/focus review
- **Focus** — a built-in Pomodoro timer (25·5, 50·10, or custom)
- **Archive & Trash** — tuck tasks away, or delete with a recoverable trash window
- **Inline editor** — notes, sub-steps, due date, exact time, priority, repeat, move folder
- **Drag to reorder**, drag-to-complete, animated checkbox + strike-through
- **Personalization** — 6 accent themes + a custom color, light/dark, reduced-visuals mode
- **Onboarding** — a short, animated first-run tour
- **Ambient mode** — a calm, glanceable full-screen view (clock, today's tasks, focus
  session, a small reactive mascot) for a second monitor; opens via the command palette
  or `?ambient=1`, stays in sync with the main window live
- **Command palette** (`Ctrl+K`), search (`/`), undo for deletes, toasts

## Keyboard shortcuts

| Key      | Action              |
| -------- | ------------------- |
| `N`      | Focus quick add     |
| `/`      | Focus search        |
| `Ctrl+K` | Command palette     |
| `Esc`    | Close / clear       |
| `Enter`  | Add task / confirm  |

## Build for production

```bash
npm run build   # outputs to dist/
```

---

© Satpura Studio
