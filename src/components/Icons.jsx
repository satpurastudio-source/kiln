// Crisp inline SVG icons — no font/emoji dependence, always render.
const I = ({ children, size = 16, sw = 1.7, style, ...p }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
    {...p}
  >
    {children}
  </svg>
)

export const SunIcon = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </I>
)

export const MoonIcon = (p) => (
  <I {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </I>
)

export const CalendarIcon = (p) => (
  <I {...p}>
    <rect x="3" y="4.5" width="18" height="17" rx="3" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </I>
)

export const LayersIcon = (p) => (
  <I {...p}>
    <path d="M12 2.5 22 8l-10 5.5L2 8l10-5.5z" />
    <path d="M2 12.5 12 18l10-5.5" />
    <path d="M2 17 12 22.5 22 17" />
  </I>
)

export const PlusIcon = (p) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
)

export const PencilIcon = (p) => (
  <I {...p}>
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </I>
)

export const BellIcon = (p) => (
  <I {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </I>
)

export const BellOffIcon = (p) => (
  <I {...p}>
    <path d="M8.7 3A6 6 0 0 1 18 8c0 4.5 1.2 7 2.2 8.3M6.3 6.3C6.1 6.8 6 7.4 6 8c0 7-3 9-3 9h14" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    <path d="M2 2l20 20" />
  </I>
)

export const SearchIcon = (p) => (
  <I {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </I>
)

export const CommandIcon = (p) => (
  <I {...p}>
    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
  </I>
)

export const ChevronIcon = (p) => (
  <I {...p}>
    <path d="M9 6l6 6-6 6" />
  </I>
)

export const FlagIcon = ({ filled, ...p }) => (
  <I {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M4 22V4c0-.6.4-1 1-1h9.5l.6 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5.5l-.6-2H6v8" />
  </I>
)

export const TrashIcon = (p) => (
  <I {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </I>
)

export const GripIcon = (p) => (
  <I {...p} sw={0}>
    <circle cx="9" cy="5.5" r="1.7" fill="currentColor" />
    <circle cx="15" cy="5.5" r="1.7" fill="currentColor" />
    <circle cx="9" cy="12" r="1.7" fill="currentColor" />
    <circle cx="15" cy="12" r="1.7" fill="currentColor" />
    <circle cx="9" cy="18.5" r="1.7" fill="currentColor" />
    <circle cx="15" cy="18.5" r="1.7" fill="currentColor" />
  </I>
)

export const NoteIcon = (p) => (
  <I {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </I>
)

export const SparkleIcon = (p) => (
  <I {...p} fill="currentColor" sw={0}>
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
  </I>
)

export const FlameIcon = (p) => (
  <I {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </I>
)

export const RepeatIcon = (p) => (
  <I {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </I>
)

export const ChecklistIcon = (p) => (
  <I {...p}>
    <path d="M3.5 5.5l1.5 1.5 3-3.5" />
    <path d="M11 6h9.5" />
    <path d="M3.5 12.5l1.5 1.5 3-3.5" />
    <path d="M11 13h9.5" />
    <path d="M11 20h9.5" />
  </I>
)

export const DownloadIcon = (p) => (
  <I {...p}>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M4 20h16" />
  </I>
)

export const ClockIcon = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v5l3.2 2" />
  </I>
)

export const PlayIcon = (p) => (
  <I {...p} fill="currentColor" sw={0}>
    <path d="M7 4.8c0-1 1.1-1.6 2-1.1l11 6.4c.9.5.9 1.8 0 2.3L9 18.8c-.9.5-2-.1-2-1.1V4.8z" />
  </I>
)

export const PauseIcon = (p) => (
  <I {...p} fill="currentColor" sw={0}>
    <rect x="6" y="4" width="4" height="16" rx="1.4" />
    <rect x="14" y="4" width="4" height="16" rx="1.4" />
  </I>
)

export const SkipIcon = (p) => (
  <I {...p}>
    <path d="M5 5l8 7-8 7V5z" fill="currentColor" strokeWidth="0" />
    <path d="M18 5v14" />
  </I>
)

export const XIcon = (p) => (
  <I {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </I>
)

export const MenuIcon = (p) => (
  <I {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </I>
)

export const BroomIcon = (p) => (
  <I {...p}>
    <path d="M19 3l-7 7M5 21c3-1 5-3 5.5-5.5L13 13l-2-2-2.5 2.5C6 14 4 16 3 19l2 2z" />
  </I>
)
