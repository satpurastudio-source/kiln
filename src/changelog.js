// What's new: newest first. Adding an entry here shows it once to everyone
// who has used kiln before (see WhatsNew.jsx); brand-new people skip it.
// Keep each line short and about what changed for the person, not the code.
export const CHANGELOG = [
  {
    id: '2026-10-25',
    date: '25 Oct 2026',
    title: 'Easier to read, easier to swipe',
    items: [
      'Text size: drag the new slider in Settings → Appearance to make everything bigger.',
      'Small labels are larger by default.',
      'On Android, swipe right from anywhere in the middle of the screen to open your folders. No more accidentally closing kiln.',
      'New: Help, Send feedback, and change your email or password in Settings.',
    ],
  },
  {
    id: '2026-10-24',
    date: '24 Oct 2026',
    title: 'Sturdier and smarter',
    items: [
      'Sign up with a 6-digit code from your email.',
      'Quick add understands real dates like “26 oct” and “12/11”.',
      'Sync is safer: changes made on two devices at once no longer overwrite each other.',
      'Install kiln to your home screen. It now updates itself when you open it.',
    ],
  },
]

export const LATEST = CHANGELOG[0].id
