# Copilot instructions (Thinkering Mode / Logseq plugin)

## Project overview
- This repo is a Logseq plugin that enhances the **right sidebar** into a multi-pane workspace (tabs, reordering, resizing, keyboard nav, dashboard/multi-column modes).
- The runtime is the Logseq plugin sandbox; most UI work manipulates **Logseq’s host DOM** via `parent.document` / `parent.window`.

## Build & dev workflow
- `npm run dev` → webpack watch build (writes `build/index.js`).
- `npm run build` → production bundle into `build/index.js`.
- Entry is `src/index.ts` → `src/thinkeringMode.ts`.
- CSS: `.scss` imports compile to **strings** (webpack rule `type: 'asset/source'`), then injected at runtime.

## Architecture & data flow
- Orchestrator: `src/thinkeringMode.ts`
  - Registers toolbar buttons via `logseq.App.registerUIItem(... template ...)`.
  - Wires click handlers through `logseq.provideModel({ ... })` (templates use `data-on-click`).
  - Activates/deactivates the mode, and performs **full cleanup** on disable (`cleanupThinkeringMode`).
  - Uses observers (ResizeObserver + MutationObserver) to keep panes/tabs in sync.
- Shared state: `src/core/state.ts`
  - `globalState` is a mutable singleton; features coordinate via `globalState.cachedPanes`, `currentActivePaneIndex`, and `expectedMutations`.
- DOM + selectors: `src/core/constants.ts` + `src/core/dom.ts`
  - Prefer `SELECTORS` and helpers like `getScrollablePanesContainer()`, `getPageIdFromPane()`, `getPaneTitle()`.
- Persistence: `src/core/storage.ts` + `src/features/panes/panePersistence.ts`
  - Pane order + “last active panes” stored in `localStorage` keys under `thinkeringMode.*`.

## Conventions & gotchas (important)
- Use `parent.document` / `parent.window` for Logseq chrome; the plugin iframe’s `document` is not where panes live.
- When doing any **intentional DOM mutations** (reorder/move panes), push a label into `globalState.expectedMutations` first.
  - The mutation observer in `src/features/observers/paneMutations.ts` uses this stack to ignore “expected” changes and avoid feedback loops.
- Keep `globalState.cachedPanes` accurate.
  - Use `getSidebarPanes(true)` / `refreshPanesElementsCache(...)` after structural DOM changes.
- Style injection:
  - Aggregate CSS strings in `src/styles/index.ts` and inject with `injectCssStyles()` from `src/features/layout/layout.ts`.

## Where to implement changes
- Lifecycle / main wiring: `src/thinkeringMode.ts`
- Layout & style injection / left-side hiding: `src/features/layout/layout.ts`
- Pane list + cache: `src/features/panes/paneCache.ts`
- Tabs UI (includes drag/drop reorder): `src/features/tabs/tabs.ts`
- Keyboard shortcuts: `src/features/keyboard/keyboard.ts`
- Pane switcher modal: `src/features/paneSwitcher/paneSwitcher.ts`
- Mutation observer coordination: `src/features/observers/paneMutations.ts`

## Existing prompt files
- Additional human-written guidance lives in `.github/instructions/*.instructions.md` (project context + Logseq API notes).
