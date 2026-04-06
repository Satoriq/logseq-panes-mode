<p align="center">
  <img src="./logo.svg" alt="Thinkering Mode" width="120" />
</p>

<h1 align="center">Panes mode</h1>

<p align="center">
  A tiling window manager for Logseq's right sidebar.<br/>
  Open multiple pages side-by-side with tabs, keyboard-driven navigation,<br/>
  drag-and-drop reordering, resizable panes, and project workspaces.
</p>

<p align="center">
  <a href="#installation">Installation</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#keyboard-shortcuts">Shortcuts</a> &bull;
  <a href="#proposed-workflow">Workflow</a> &bull;
  <a href="#faq">FAQ</a>
</p>

---

## Philosophy

To understand a complex problem, idea, or concept you need to understand its small pieces. To understand how to build a rocket, you need to understand every part of it. We take a system or concept and pull it downwards to the point of irreducibility — bullet points, Zettelkasten, atomic notes are perfect for that.

Panes mode allows you to manipulate these small pieces in wiki-style easily and see the big picture / find connections between panes to understand complex ideas.

In the LLM world we are dealing with more and more information every day, more and more abstractions. We need tools to see and operate more information at the same time.

<details>
<summary><b>Why not Logseq alone?</b></summary>
<br/>

Logseq is great at outlining but not perfect for further work with data. What's the point of outlining if you can't work with your outlined data?

</details>

<details>
<summary><b>Being a Polymath in the Age of LLM</b></summary>
<br/>

In the age of LLM an important skill is to be a polymath. Being a polymath today is more about systems thinking:

- We take a system or concept and pull it downwards to the point of irreducibility (bullet points are perfect for that) + First-principles thinking.
- Then you must try to combine parts from different domains, ideas, and items — interdisciplinary thinking.
</details>

<details>
<summary><b>On note-taking</b></summary>
<br/>

Always focus on understanding. We only write things down to help us understand — by removing stuff from our brain's RAM, having the whole picture, thinking about how to structure a sentence to imprint knowledge in our brain and make it less tangled. There is no point in collecting information; information is free and easily available with LLMs.

</details>

## Proposed Workflow

1. **Break down the problem** — Hide the left pane, open one pane or block for tasks. Open an LLM, ask it to divide a complex problem into parts. Create tasks for those parts.
2. **Dive into each part** — Start asking the LLM about individual parts. Create a pane for each part, write down important details and your understanding of it. Each individual part will require more panes for its smaller components. Create Anki cards when you understand pane and use Anki Sync.

## Features

| Feature                       | Description                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- |
| **Tabbed sidebar**            | Horizontal or vertical tab bar for all open panes                                 |
| **Keyboard-first navigation** | Switch, reorder, close, resize, and scroll panes without touching the mouse       |
| **Pane resizing**             | Drag handles at the bottom-right of panes                                         |
| **Drag-and-drop reordering**  | Rearrange panes by dragging the pane header                                       |
| **Collapsible panes**         | Minimize panes to save space                                                      |
| **Pane switcher**             | Fuzzy-search modal to jump to any open pane (`Cmd/Ctrl+S`)                        |
| **Projects**                  | Save and restore sets of panes as named workspaces (`Cmd/Ctrl+Shift+S`)           |
| **Auto-close**                | Optionally close the oldest pane when exceeding a configurable tab limit          |
| **Sticky headers**            | Keep pane headers pinned while scrolling                                          |
| **Light & dark theme**        | Fully customizable colors for tabs, panes, borders, and outlines                  |
| **Custom sides resizer**      | Adjustable splitter between left and right Logseq sides, removes min-width limits |
| **Multi-column layout**       | Toggle a pane into multi-column reading mode (`Cmd/Ctrl+Shift+M`)                 |
| **Block panes**               | Open separate blocks as individual panes                                          |
| **Auto "More..."**            | Automatically expands "More..." in panes so you never have to click it            |

## Keyboard Shortcuts

| Shortcut                          | Action                    |
| --------------------------------- | ------------------------- |
| `Shift+Scroll`                    | Horizontal scrolling      |
| `Cmd/Ctrl+Shift+Y`                | Toggle Panes Mode         |
| `Cmd/Ctrl+E`                      | Next pane                 |
| `Cmd/Ctrl+Q`                      | Previous pane             |
| `Cmd/Ctrl+W`                      | Close current pane        |
| `Cmd/Ctrl+Shift+C`                | Toggle pane collapse      |
| `Cmd/Ctrl+Shift+H`                | Move pane left            |
| `Cmd/Ctrl+Shift+L`                | Move pane right           |
| `Cmd/Ctrl+S`                      | Pane switcher             |
| `Cmd/Ctrl+Shift+S`                | Projects                  |
| `Cmd/Ctrl+Shift+B`                | Toggle tabs visibility    |
| `Cmd/Ctrl+Shift+M`                | Toggle multi-column       |
| `Cmd/Ctrl+Arrow Up/Down`          | Scroll active pane        |
| `Cmd/Ctrl+Shift+Arrow Left/Right` | Resize active pane        |
| `Cmd/Ctrl+G`                      | Jump to bottom of pane    |
| `Cmd/Ctrl+U`                      | Jump to top of pane       |
| `Cmd/Ctrl+Shift+T`                | Toggle tabs visibility    |
| `Cmd/Ctrl+Shift+F`                | Focus text in active pane |
| `Cmd/Ctrl+J` / `Cmd/Ctrl+K`       | Navigate search/selector  |
| `Cmd/Ctrl+1-9`                    | Jump to pane by number    |

## Details

- **New pane placement** — Every new pane opens to the right of the current active/selected one.
- **Persistent layout** — Size and order of panes is stored in localStorage and restored when toggling on/off. There are 2 size modes: "Fit content" (toggled by the arrow left of the close icon) and manual resize with the right bottom edge handle. Both are saved.
- **Projects** (`Cmd/Ctrl+Shift+S`) — Save and restore which panes are open, their order, size, and collapsed state. When you're deep into a project but need to switch to another subject/research, save the current panes state in a Project and restore it when needed.
- **Search navigation** — `Cmd/Ctrl+J` and `Cmd/Ctrl+K` work in both Logseq native search and the pane selector.
- **Max panes / Clean unused panes** — Mostly useful for the "Clean unused panes" button. It removes every pane except the last N (max panes number in settings) active panes. Click it when things start to feel laggy. When auto-close is ON (off by default), the plugin will auto-close panes until the max-panes number remains.

> **Tip — "Sync panes order" button:** If internal logic gets out of sync (active tab doesn't match active pane, right/left navigation is faulty), click this button to refresh all internal logic based on the current UI state.

> **Tip — Custom sidebar resizer:** The native side separator is replaced with a custom one, so you can make the left side as small as you want.

## Safety / Security / Privacy

- **No bloated dependencies** — All pure TypeScript, no millions of unchecked node modules.
- **No network requests** — Your data stays local. Your anime watchlist is safe.
- **Read-only on your data** — The plugin only makes UI changes, it never touches your notes or graph data. (It can occasionally break Logseq's UI — restart Logseq to reset.)

## Installation

### From Logseq Marketplace

1. Open Logseq
2. Go to **Settings > Plugins > Marketplace**
3. Search for **Panes Mode**
4. Click **Install**

### Manual

1. Download the latest release from the [Releases](https://github.com/user/logseq-panesMode/releases) page
2. Unzip to a folder
3. In Logseq, go to **Settings > Plugins**
4. Click **Load unpacked plugin** and select the release folder

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

## FAQ

**Will the DB version be supported?**

Yes, but only when `'effect': true` is added to DB by the Logseq team and the DB version is officially released. If the project gets enough attention (5k installs or 50 stars) I will update it for DB before official release — but you'll need to install the plugin manually from GitHub.

**Known issues:**

- _It's an MVP with a new UI concept_ — Expect bugs. Most are solved by the "Sync panes order" action button or toggling the plugin off and on.
- _Cursor disappears after editing without changing file state_ — Desync between custom UI and Logseq page state. Reopen the page or restart Logseq.
- _Tabs state doesn't match panes state_ — Use "Sync panes order". If that doesn't work, toggle the plugin off/on.

## Contributing

At least 60% of the code is written by agents. If something looks like unreadable nonsense, it most likely is — don't overthink it. Feel free to use agents on top, but no more than 500 lines of slop per PR and testing is on you.

## License

[MIT](./LICENSE)
