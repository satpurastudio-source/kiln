# kiln. — task studio

_shape · fire · ship_

A premium-feeling project & task manager in the same cream/terracotta editorial
style as [ananysoni2007.github.io](https://ananysoni2007.github.io) — typewriter
boot screen, custom cursor, film grain, spring physics animations everywhere,
sounds, confetti, and a command palette.

Built with React + Vite + Framer Motion. All data persists in `localStorage`.
To rename the app, edit `src/brand.js` (one place) and the `<title>` in `index.html`.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173

> Node.js lives at `~/.local/opt/node` (portable install). If `npm` isn't found, run:
> `export PATH="$HOME/.local/opt/node/bin:$PATH"` (add it to `~/.bashrc` to make it permanent).

## Features

- **Projects** with custom color + icon, live progress rings, and confetti + fanfare when you finish the last task
- **Views**: Today (overdue + due today), Upcoming (grouped by date), All Tasks, per-project
- **Quick add bar** — press `N`, type, pick date chips / priority flags / project, hit Enter
- **Inline editor** — click any task to edit title, notes, due date, priority, or move project
- **Drag to reorder** (grip handle, in All Tasks & project views)
- **Command palette** — `Ctrl+K`
- **Search** — `/`
- Animated checkbox with particle burst, strike-through sweep, satisfying completion sounds (mutable)
- **Typewriter loading screen** that types the app name, then fades into the UI
- **Custom cursor** — trailing ring + dot that grows over anything clickable (auto-disabled on touch)
- **3D tilt** on task cards following the pointer, Bebas Neue slide-up header reveals
- Light (cream) & dark (warm black) themes with a smooth whole-page cross-fade on toggle
- Dot-grid paper texture + film grain overlay, DM Mono for all data text
- Undo for deletes, hover ✗ quick-delete on task rows, toasts

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
