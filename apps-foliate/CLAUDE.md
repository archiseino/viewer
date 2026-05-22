# CLAUDE.md

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:
- /office-hours
- /plan-ceo-review
- /plan-eng-review
- /plan-design-review
- /design-consultation
- /design-shotgun
- /design-html
- /review
- /ship
- /land-and-deploy
- /canary
- /benchmark
- /browse
- /connect-chrome
- /qa
- /qa-only
- /design-review
- /setup-browser-cookies
- /setup-deploy
- /setup-gbrain
- /retro
- /investigate
- /document-release
- /document-generate
- /codex
- /cso
- /autoplan
- /plan-devex-review
- /devex-review
- /careful
- /freeze
- /guard
- /unfreeze
- /gstack-upgrade
- /learn

## Project Context

**Foliate Reader** — Next.js 16 App Router e-book reader (EPUB + PDF) using `foliate-js` web components.

## Build commands

```bash
pnpm --filter apps-foliate dev     # start dev server
pnpm --filter apps-foliate build   # production build
pnpm --filter apps-foliate lint    # run eslint
```

## Project structure

```
src/
  types/              # Shared type definitions
    reader.ts         → LocationData, TocItem
    FoliateView.ts    → global FoliateView HTMLElement declaration
    settings.ts       → ColorScheme
  store/              # Zustand state management
    settings-store.ts → persisted color scheme, font, size, margins, line height
    progress-store.ts → persisted per-book reading position
    reader-store.ts   → ephemeral session state (view ref, TOC, location)
  hooks/              # React hooks wiring stores to lifecycle
    use-progress.ts   → debounced progress save + load
    use-reader-events.ts → relocate + load events, theme injection
  context/
    ThemeProvider.tsx  → toggles .dark / .sepia / system theme on <html>
  services/
    theme-css.ts      → inject/update <style> inside EPUB iframe documents
  components/
    ReaderView.tsx       → foliate-view lifecycle, keyboard nav, theme re-injection
    ReaderSidebar.tsx    → left Sheet with TOC tree + progress slider
    SettingsPanel.tsx    → right Sheet with color/font/size/margins/line-height controls
  app/
    layout.tsx           → wraps with ThemeProvider
    read/page.tsx        → orchestrates file picker, reader, sidebar, settings
  styles/
    globals.css          → Tailwind v4, light/dark/sepia themes
```

## Architecture decisions

- **Zustand** for state management (no Redux, no Context for data)
- **Types extracted** to `src/types/` — stores, hooks, and components all import shared types
- **Store split**: persisted (`settings-store`, `progress-store`) vs ephemeral (`reader-store`)
- **`useShallow`** from `zustand/react/shallow` required for all object-literal selectors to avoid infinite re-renders in dev
- **FoliateView** declared globally via `declare global` in `src/types/FoliateView.ts` — import `@/types/FoliateView` once per file
- **Theme injection**: CSS is injected via `<style id="foliate-theme">` inside each EPUB iframe document (light-DOM CSS vars don't cross iframe boundaries)
- **Progress**: debounced at 1s, `range` stripped before serialization (DOM refs can't serialize), `fraction` is the universal cross-format key (EPUB + PDF)
- **Styling**: Tailwind v4 with `@import "tailwindcss"`, no PostCSS config needed (Turbopack handles it natively)

## Key patterns

- Subscribe to individual store fields with selectors: `useSettingsStore((s) => s.colorScheme)`
- Object selectors must use `useShallow`: `useSettingsStore(useShallow((s) => ({ a: s.a, b: s.b })))`
- Never call `useSettingsStore()` with no selector (returns new object ref every render → infinite loop)
- For DOM side effects (theme class, CSS vars), use `useEffect` in context/component
- For pure non-React logic, use `src/services/` (theme-css.ts)

## Conventions

- `postcss.config.mjs` is NOT needed — deleted. Tailwind v4 + Turbopack.
- `.npmrc` at root with `shamefully-hoist=true` and `node-linker=hoisted` — required for pnpm monorepo native deps (sharp, etc.)