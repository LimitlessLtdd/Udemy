# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

A Udemy course workspace. This directory (`Project1/`) holds the only application — `index.html`, `style.css`, `script.js`, sitting next to this file; the sibling `../Temp/` is an empty scratch directory. There is no git repository, no `package.json`, and no README.

## Commands

There is **no build step, no bundler, no dependency install, no linter, and no test suite**. the app is three static files opened directly from disk:

```bash
xdg-open index.html        # or open the file in the IDE preview
```

The only real check that exists:

```bash
node --check script.js     # plain ES5, one IIFE, no modules
```

### Rendering the page headlessly

Playwright's Chromium is present under `~/.cache/ms-playwright/chromium-1228/` but **cannot launch** — `ldd` on its `chrome` binary reports `libnspr4.so`, `libnss3.so`, `libnssutil3.so`, `libsmime3.so`, and `libasound.so.2` missing. Screenshots and DOM-level verification are unavailable until someone runs:

```bash
sudo apt install -y libnss3 libnspr4 libasound2t64
```

Until then verification is static: `node --check` for the JS, and ad-hoc Python for the CSS/HTML (brace balance, `background-*` layer-count parity, `urllib.parse.unquote` + `ElementTree` on the embedded SVG `data:` URIs, `html.parser` for tag balance — override `handle_startendtag` so `<meta />` is not double-counted).

## Architecture

A single-page, dependency-free time-capsule app: write a letter, pick an unlock date, it stays sealed behind a live countdown until that moment, then opens with a celebration overlay. Everything is client-side.

`script.js` is one ES5 IIFE under `"use strict"`. State is a module-level `capsules` array persisted to `localStorage`. Boot order at the bottom of the file: `initTheme()` → `showQuote()` → `setMinDate()` → `load()` → mark stale unlocks announced → `render()` → two `setInterval`s (`tick` 1s, `setMinDate` 30s) → `storage` listener.

### Four constraints that are easy to break

**1. The class-name contract spans two files.** `index.html` supplies the static shell; capsule cards are built as an HTML string assigned to `card.innerHTML` inside `buildCard()` (`script.js:260`). `.capsule`, `.cap-top`, `.cap-name`, `.cap-date`, `.badge.locked` / `.badge.unlocked`, `.cap-body`, `.locked-note`, `.message-text`, `.countdown`, `.unit` (+ `.unit b`), `.progress .bar`, `.progress-label`, `.pct`, `.left`, `.cap-actions`, `.icon-btn` exist **only** in that string. A structural rename must land in the markup, the template string, `cardRefs` (built from the same selectors at `script.js:297`), and `style.css` together.

**2. The ticker patches the DOM in place — never re-render from it.** `render()` builds each card once and stashes element references in `cardRefs[id]`. `tick()` runs every second and writes directly into those references, comparing against `ref.prev[i]` so only changed digits are touched (and re-trigger the `.pulse` animation). Re-rendering would restart the `cardIn` / `unfold` entrance animations every second. Call `render()` only on genuine state changes: create, delete, filter change, unlock, cross-tab `storage`.

`tick()` bails with `if (!ref || !ref.bar) return;` — that is how it tolerates unlocked cards and capsules hidden by the active filter, which have no refs. Keep that guard if you touch the loop.

**3. `STORAGE_KEY` (`futureMe.capsules.v1`) and `THEME_KEY` (`futureMe.theme`) are a compatibility boundary.** Changing either orphans capsules already saved in a user's browser. The `storage` listener keys off both to sync multiple tabs. `load()` defensively drops entries lacking a string `message` / numeric `unlockAt`. Capsules that unlocked while the page was closed get `announced = true` at boot so the overlay only celebrates live unlocks. The progress bar derives its span from `createdAt`, falling back to `unlockAt - 86400000` for records written before that field existed — keep such fallbacks when extending the shape.

**4. `escapeHtml()` guards the `innerHTML` path.** Name, message, and formatted date all flow into the `buildCard()` string. Anything new added there must go through it. (The overlay and toast use `textContent` and are safe by construction.)

### Theming

Two themes driven by a `data-theme` attribute on `<html>`, toggled by `#themeToggle` and persisted. `initTheme()` falls back to `prefers-color-scheme`, defaulting to dark.

Nearly all color and typography funnels through CSS custom properties on `:root` (light, `style.css:8`) overridden by `[data-theme="dark"]` (`style.css:42`). A palette change is mostly a two-block edit — **but a token swap alone is never sufficient.** These bypass the tokens and must be updated by hand:

- the confetti palette, `script.js:420` (five hex literals)
- `.brand-mark` wax seal — radial-gradient highlight + three `box-shadow` layers (`style.css:181`)
- `.locked-note .lock` seal — same treatment, smaller (`style.css:542`)
- `.badge.locked` / `.badge.unlocked` background and inset ring (`style.css:520`, `526`)
- `.quote` background gradient — two rules, one per theme (`style.css:421`, `430`)
- `input.invalid` focus ring (`style.css:357`)
- `.overlay` scrim (`style.css:683`)
- `.btn-glow` sheen, and the `rgba(255, 240, 230, …)` highlights on `.site-header::before`, `.btn-primary`, and `.chip.active`

`--radius` is intentionally defined only on `:root`; the dark theme inherits it.

The panel frame (`.panel, .overlay-card`, `style.css:263`) stacks **nine** background layers — eight one-pixel gradients drawing the corner brackets, plus a repeating paper-grain gradient. `background-repeat`, `-size`, and `-position` must each keep exactly nine comma-separated entries in the same order, or the corners drift.

Decorative background patterns (`.damask`, `.flourish`) are inline SVG `data:` URIs in the CSS — `#` percent-encoded as `%23`. No image, font, or icon files exist on disk; the only external resource is the Google Fonts stylesheet (Playfair Display, EB Garamond, Pinyon Script).

A `@media (prefers-reduced-motion: reduce)` block at the end of `style.css` neutralizes the animations; new motion should stay inside its reach.

## UI text

The app is French (`lang="fr"`), Belle Époque styling. **UI strings live in two places** — static copy in `index.html`, generated copy in `script.js` (validation errors, toasts, badge labels, countdown unit labels, stat line, empty-state text, overlay meta, `window.confirm` text). A wording or language change must cover both.

French specifics worth preserving: `toLocaleString("fr-FR", …)` in `formatDate()`, comma decimal separator (`.replace(".", ",")` on the percentage), non-breaking ` ` before `%` and `?`, typographic apostrophes (`’`) throughout, and singular/plural ternaries on the stat line and the "jours restants" label.

Note: this app has been fully re-themed twice (it began as an English "Future Me", passed through a Chinese imperial design). Some internal comments — including the `script.js` header block — still say "Future Me".
