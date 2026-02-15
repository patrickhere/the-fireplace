---
name: design
description: Design and build Fireplace UI views and components with the project's specific design system — dark amber theme, dense mission-control aesthetic, responsive for macOS and iOS.
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

You are the design specialist for The Fireplace, a mission control app for OpenClaw. Every view and component you create must follow these guidelines.

## Color Palette

Dark mode only. Warm amber on deep gray.

### Backgrounds
- `zinc-950` (#09090b) — app background
- `zinc-900` (#18181b) — sidebar, cards, panels
- `zinc-800` (#27272a) — elevated surfaces, hover states
- `zinc-700` (#3f3f46) — borders, dividers

### Accent (Amber)
- `amber-500` (#f59e0b) — primary accent, active states, links
- `amber-400` (#fbbf24) — hover accent
- `amber-600` (#d97706) — pressed accent
- `amber-300` (#fcd34d) — highlights, badges
- `amber-500/10` — subtle amber tint for selected items

### Text
- `zinc-100` (#f4f4f5) — primary text
- `zinc-400` (#a1a1aa) — secondary text, labels
- `zinc-500` (#71717a) — muted text, timestamps, placeholders

### Status
- `emerald-500` (#10b981) — connected, healthy, success
- `amber-500` (#f59e0b) — warning, degraded, pending
- `red-500` (#ef4444) — error, disconnected, critical
- `zinc-500` (#71717a) — offline, inactive

### Semantic
- `orange-500` (#f97316) — exec approvals needing attention
- `sky-500` (#0ea5e9) — informational, links to external

## Typography

- **UI text**: system font stack (Tauri default) — clean, native feel
- **Code, logs, config**: `font-mono` (JetBrains Mono or system monospace)
- **Size scale**: keep it dense — `text-sm` (14px) for body, `text-xs` (12px) for labels/metadata
- **Headings**: `text-lg` max for view titles, `text-base` for section headers

## Layout Principles

### Dense but Readable
- This is a mission control, not a marketing site
- Minimize whitespace — tight padding (`p-2`, `p-3`), compact gaps (`gap-1`, `gap-2`)
- Data tables should show many rows without excessive spacing
- Cards use `p-3` not `p-6`

### Information Hierarchy
- Most important info visible without scrolling
- Status indicators use color dots, not large banners
- Counts and badges inline, not in separate blocks
- Secondary actions behind `...` menus or right-click

### Responsive Strategy
- **macOS (>768px)**: sidebar + main content, fixed sidebar width ~240px
- **iOS (<768px)**: bottom tab bar (56px), full-width content, no sidebar
- Use `usePlatform()` hook for platform-specific layouts
- Touch targets minimum 44px on iOS, can be tighter on macOS

## Component Patterns

### Cards
```
bg-zinc-900 border border-zinc-700 rounded-lg p-3
```

### Buttons
- Primary: `bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium`
- Secondary: `bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700`
- Destructive: `bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20`
- Ghost: `hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100`

### Inputs
```
bg-zinc-900 border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500
focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30
```

### Status Dots
```tsx
<span className="h-2 w-2 rounded-full bg-emerald-500" />  // connected
<span className="h-2 w-2 rounded-full bg-amber-500" />     // warning
<span className="h-2 w-2 rounded-full bg-red-500" />       // error
<span className="h-2 w-2 rounded-full bg-zinc-500" />      // offline
```

### Sidebar Nav Items
```
Active:   bg-amber-500/10 text-amber-400 border-l-2 border-amber-500
Inactive: text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
```

### Badges / Counts
```
bg-amber-500/15 text-amber-400 text-xs font-medium px-1.5 py-0.5 rounded-full
```

### Tables
- Header: `text-xs uppercase text-zinc-500 font-medium`
- Rows: `border-b border-zinc-800 hover:bg-zinc-800/50`
- Compact: `py-2 px-3` cell padding

### Modals / Dialogs
```
bg-zinc-900 border border-zinc-700 shadow-2xl shadow-black/50 rounded-xl
```

### Toast / Notifications
- Success: left border `border-l-2 border-emerald-500`
- Error: left border `border-l-2 border-red-500`
- Warning: left border `border-l-2 border-amber-500`

## View-Specific Guidelines

### Chat
- Messages: user on right (amber tint bg), assistant on left (zinc-900 bg)
- Streaming indicator: pulsing amber dot
- Code blocks: `bg-zinc-950 border border-zinc-800 rounded-md` with copy button
- Input area pinned to bottom, `bg-zinc-900 border-t border-zinc-700`

### Dashboards (Sessions, Channels, Agents)
- Master-detail layout on macOS: list on left (~300px), detail on right
- Stacked layout on iOS: list view → tap to navigate to detail
- List items: compact, show key info (name, status dot, last activity, model)
- Use shadcn/ui DataTable for sortable/filterable lists

### Logs
- Full monospace, no wrapping
- Color by level: `text-zinc-500` debug, `text-zinc-100` info, `text-amber-400` warn, `text-red-400` error
- Timestamp in `text-zinc-500`, left-aligned fixed width
- Auto-scroll with "pinned to bottom" indicator

### Config Editor
- Form mode: grouped sections with clear labels
- JSON mode: CodeMirror with matching dark theme
- Toggle between form/JSON in top-right

## shadcn/ui Customization

When installing shadcn/ui components, override the default theme to match:
- Set CSS variables for the amber dark theme in `globals.css`
- Ensure all shadcn components inherit the warm palette
- Don't use the default slate/gray — use zinc throughout

## Anti-Patterns (Don't Do These)

- No light mode — dark only
- No large hero sections or marketing-style layouts
- No rounded-full buttons (use rounded-md or rounded-lg)
- No excessive shadows on internal elements
- No blue accent — amber is the brand color
- No px-8 py-6 padding on cards — keep it tight
- No gray-* colors — use zinc-* exclusively
- No gradient backgrounds
