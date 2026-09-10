# Verifying Tracer

How to confirm the app actually works — from the fastest automated checks to a
full manual pass over every feature, then production.

- **Live app:** https://tracer-137d2.web.app
- **Local dev:** http://localhost:5173
- **Deploy docs:** see `DEPLOY.md`
- **Last full run:** 2026-09-04 against commit `5c3c779` — Layers 1, 2 and 5
  all pass; live bundle `index-DESNU45U.js` matches the local build.

Work top-down. Layers 1–2 take ~3 minutes and catch most regressions; only
run the full manual sweep (Layer 4) before a release or after a UI change.

---

## Layer 1 — Static checks (~60s)

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # tsc -b && vite build
```

**Pass looks like:**

| Command | Expected |
| --- | --- |
| `typecheck` | no output at all after the two npm banner lines |
| `lint` | `✖ 21 problems (0 errors, 21 warnings)` — the warnings are all `react-refresh/only-export-components`; **errors must be 0** |
| `build` | `✓ built in ~2s`, plus a `chunks are larger than 500 kB` warning (known, bundle is ~1.46 MB / 420 kB gzip) |

Any TS error, any ESLint **error**, or a failed build = stop and fix. These are
the same three steps CI runs (`.github/workflows/ci.yml`), so a green run here
means the push will pass CI.

---

## Layer 2 — Engine smoke tests (~30s)

The three solvers are pure functions, so they can be verified without a
browser. `scripts/smoke-*.ts` run ~96 real questions through them.

The file headers say `npx tsx`, but `tsx` is not a dependency of this repo.
Use the bundled esbuild instead — no install, works offline:

```bash
for e in graphics automata control; do
  ./node_modules/.bin/esbuild scripts/smoke-$e.ts \
    --bundle --platform=node --format=esm \
    --outfile=/tmp/smoke-$e.mjs --log-level=error \
  && echo "=== $e ===" && node /tmp/smoke-$e.mjs
done
```

**Pass looks like** (last line of each):

| Script | Expected final line |
| --- | --- |
| `smoke-graphics.ts` | `--- Summary: 34 success, 2 refusal ---` |
| `smoke-automata.ts` | `Pass: 25, refuse: 1, total: 26` |
| `smoke-control.ts` | `=== 34/34 passed, 0 failed ===` |

How to read the output:

- `OK  |` — solved. The stroke count and summary print next to it; a stroke
  count that collapses to a handful on a construction that used to emit dozens
  is a regression even though the line says OK.
- `NO  |` / `refuse:` — the engine declined. **The refusals in these lists are
  intentional** (`Where are my keys?`, `Explain how the loop works`, etc.).
  A refusal on a real question is a failure.
- `OFF |` (graphics only) — the construction drew outside the paper rect. The
  canvas clips to the sheet, so those strokes are invisible on screen *and* in
  the PNG/PDF export. Treat every `OFF` line as a bug (this is exactly what
  commit `5c3c779` fixed).

When you add an engine feature, add a question for it to the `cases` array in
the matching script — that is how coverage grows.

---

## Layer 3 — Boot the app

```bash
npm run dev          # http://localhost:5173
```

Open DevTools → Console and keep it open for the whole manual pass.

- A clean console is expected, **except** `Firestore <op> failed/skipped: …`
  warnings. Those are deliberate: every Firestore call in `src/lib/storage.ts`
  is wrapped in a 4s read / 6s write timeout so a slow or offline database can
  never block the UI. They are informational, not failures.
- Any React error, uncaught promise rejection, or the full-screen ErrorBoundary
  fallback = a real bug.

To test the *production* bundle rather than the dev server:

```bash
npm run build && npm run preview   # http://localhost:4173
```

---

## Layer 4 — Feature-by-feature manual checklist

### 4.1 Auth and route protection

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Log out, visit `/` | Marketing home page with a **Sign in** link |
| 2 | While logged out, go to `/app/history` | Brief `Loading…`, then redirect to `/login` |
| 3 | `/signup` with a fresh email, password ≥ 6 chars, and a name | Lands on `/app/history`; the name shows on `/app/profile` |
| 4 | Sign in with a wrong password | Inline error: *"Incorrect email or password."* — not a raw Firebase code |
| 5 | Sign up with a 3-char password | *"Password is too weak — use at least 6 characters."* |
| 6 | Sign up with an email that already exists | *"An account with that email already exists. Try signing in instead."* |
| 7 | **Continue with Google** | Popup completes sign-in. Now block popups in the browser and retry: it must silently fall back to a full-page redirect and still land signed in (`signInWithPopup` → `signInWithRedirect` → `getRedirectResult`) |
| 8 | Reload the page while logged in | Short `Loading…`, then stays logged in — never bounced to `/login` |
| 9 | Profile → **Log out**, then press Back | Returns to `/login`, not the app |
| 10 | Visit `/nonsense` | Redirects to `/` |
| 11 | Log out and visit `/` | Home page again (`/` redirects to `/app/history` only when signed in) |

Turn off Wi-Fi and try to sign in → *"Network error — check your connection
and try again."*

### 4.2 Shell navigation

Sidebar must expose exactly seven destinations, each loading without a console
error: History, Saved, Profile, Graphics, Automata, Control Systems, Settings.
`/app` with no sub-path redirects to `/app/history`.

### 4.3 Chat / solving — run this for all three modules

Pages: `/app/graphics`, `/app/automata`, `/app/control`.

**a) Example cards.** With an empty chat you should see:

| Module | Example cards |
| --- | --- |
| Graphics | 18 |
| Automata | 4 |
| Control | 3 |

This count is a free regression test: the cards are *built by running the
engines at load time*, and any seed the engine can no longer solve is silently
dropped from the grid. A missing card means an engine regression.

**b) View / Save on a card.** *View* opens the canvas for that example. *Save*
shows a "Saved" toast and the item then appears under `/app/saved`.

**c) Ask a question.** Type one and press Enter — a three-dot loader appears,
then an assistant bubble with the solution summary and a **View** button that
opens the canvas. Known-good prompts:

- Graphics — `Draw the projections of a point A which is 50mm above HP and 30mm in front of VP`
- Graphics — `Line AB 80mm long, inclined 30° to HP and 45° to VP, end A 15mm above HP and 20mm in front of VP.`
- Graphics — `Development of the lateral surface of a cone of base diameter 60mm and axis 80mm`
- Automata — `Build a DFA for binary strings divisible by 3`
- Automata — `Minimize the DFA for strings ending in 01`
- Automata — `Simulate DFA on input 1101 for strings ending in 01`
- Control — `Routh-Hurwitz stability for s^4 + 2s^3 + 3s^2 + 4s + 5`
- Control — `Root locus of G(s)H(s) = K / (s(s+2)(s+5))`
- Control — `Step response of G(s) = 25 / (s^2 + 4s + 25)`

**d) Refusal path.** Ask `Where are my keys?` in each module. Expect a polite
refusal *plus* a list of manual steps tailored to that subject (HP/VP layout
for Graphics, state-drawing steps for Automata, G(s) = N(s)/D(s) steps for
Control). A blank bubble or a stack trace is a bug.

**e) Session state.** Chat history is per-module and in-memory: navigate
Graphics → Automata → back to Graphics and your messages are still there; a
full page reload clears them (the solved questions themselves survive in
History).

### 4.4 Canvas workspace (`/app/canvas/:id`)

| # | Check | Expect |
| --- | --- | --- |
| 1 | Header | Question title, module name (Drafting / Automata / Control), and a meta line — `420 × 297 mm` for graphics on the default A3 landscape sheet, `DFA · 3 states · |Σ|=2` for the divisible-by-3 automaton, `bode · order 2 · type 0` for the Bode example |
| 2 | Step navigator (footer) | ◀ / ▶ move one step; the step field accepts a typed number and clamps to `0…total`; play advances one stroke every 600 ms and stops at the end |
| 3 | **Draw & Show** | Jumps to step 0 and replays the whole construction; the button reads `Showing…` while running and reverts when it finishes |
| 4 | Canvas rendering | Only strokes up to the current step are painted; the current stroke is highlighted; hovering a stroke highlights it, clicking selects it (click again to deselect) |
| 5 | **Question** button | Modal with the original question text and the summary |
| 6 | ⌘K / Ctrl-K | Command palette opens. Groups: *Playback* + *Steps* (up to 50) always; *Tools* in graphics; *States* + *Conversions* in automata; *Plots* + *Reduction* in control. Typing filters, ↑↓ moves, Enter runs, Esc closes. Selecting "Step 12" scrubs the canvas to step 12 |
| 7 | Left panel | Graphics: stroke analysis for the hovered/selected/current stroke. Automata: machine info, alphabet, transition table. Control: system info, transfer function, stability |
| 8 | Right panel | Graphics: progress. Automata/Control: inspector contents for the selection |
| 9 | Paper size (graphics only, in the header) | A4 / A3 / A2 × portrait / landscape. The drawing rescales to the new sheet. Reload the same canvas URL — the choice persists (written to Firestore) |
| 10 | Back arrow | Returns to the previous page |
| 11 | Open `/app/canvas/does-not-exist` | "Question not found" card with a **Back to History** button — not a blank screen |

**Export — the one gotcha.** PNG and PDF rasterise the SVG *as currently
displayed*, at 200 dpi on the selected paper size. If you export at step 12 you
get a half-finished drawing. **Set the step to the end (or let Draw & Show
finish) before exporting.** Then:

- Export PNG → file opens, the drawing fills the sheet, nothing is cut off at
  the edges, text is legible.
- Export PDF → single page, page size matches the selected paper (engines default to A3
  landscape = 420×297 mm; A4 = 297×210 landscape / 210×297 portrait), and the
  orientation follows the paper.
- The filename is derived from the question title.

Do the export check on at least one question per module, and on a busy one
(e.g. the Turing machine example, ~254 strokes) to confirm nothing is clipped.

### 4.5 Persistence (History / Saved)

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Ask a question, go to `/app/history` | It's at the top (sorted newest first) |
| 2 | Click **Open** on a row | Canvas loads that question |
| 3 | **Delete** a row, then reload | It stays gone |
| 4 | Save an example, go to `/app/saved` | Listed there; **Unsave** removes it and it stays gone after reload |
| 5 | Log in as the same user in another browser/device | Same History and Saved lists (Firestore `users/{uid}/questions`) |
| 6 | Log in as a *different* user | Empty History — no cross-user leakage |
| 7 | DevTools → Network → **Offline**, then reload `/app/history` | Empty-state card, console warns `Firestore listHistory failed/skipped`, and the UI stays responsive — this graceful-degradation path is intended behaviour, not a failure |
| 8 | While still offline, open a question you solved this session | Still opens (served from the in-memory cache) |

### 4.6 Settings and Profile

`/app/settings` is informational: Storage (cloud sync / local cache), Theme,
Version 1.0.0, and the engines line. `/app/profile` shows the avatar (or
initials), display name, email, and the logout button.

---

## Layer 5 — Production verification (after a deploy)

```bash
# 1. Did the deploy run and pass?
gh run list --repo CodeMaster747/Tracer --limit 5
gh run watch --repo CodeMaster747/Tracer
```

```bash
# 2. Is the live site serving the bundle you just built?
npm run build
ls dist/assets/index-*.js
curl -s https://tracer-137d2.web.app/ | grep -o '/assets/index-[^"]*\.js'
```

The two hashes must match. If the live hash is older, the deploy did not
finish (or you're looking at a cached page — hard-reload).

```bash
# 3. Caching headers — the fix from commit ca19c0a
curl -sI https://tracer-137d2.web.app/ | grep -i cache-control
#   → cache-control: no-cache, no-store, must-revalidate

curl -sI https://tracer-137d2.web.app/assets/index-<hash>.js | grep -i cache-control
#   → cache-control: public, max-age=31536000, immutable
```

If the document ever comes back with `max-age=3600`, the header rules in
`firebase.json` have regressed and users will be pinned to a stale bundle for
an hour after every deploy.

```bash
# 4. SPA rewrite — deep links must not 404
curl -s -o /dev/null -w "%{http_code}\n" https://tracer-137d2.web.app/app/history   # 200
```

**5. Sign in on the live URL**, including Google. `auth/unauthorized-domain`
means the domain is missing from Firebase console → Authentication → Settings →
Authorized domains.

**6. Run a two-minute smoke on production:** ask one question per module, open
the canvas, Draw & Show, export a PNG, and confirm the item lands in History.

---

## Expected behaviour that looks like a bug

Don't chase these:

- **21 ESLint warnings** and the **500 kB chunk warning** — known and accepted.
- **`Firestore … failed/skipped` console warnings** — by design; every call is
  timeout-guarded so the UI never blocks on the database.
- **Save on an assistant answer just toasts "Already saved to History"** — the
  question was persisted the moment it was solved.
- **Opening an example clones it** with a new id under your account, so History
  fills with copies of examples you viewed. Intended.
- **A reopened example or an old saved question may render slightly differently
  from when you saved it** — questions without structured `meta` are re-solved
  by the engine on open (`hydrateMeta` in `src/pages/CanvasPage.tsx`), so they
  pick up the current layout code.
- **Chat messages disappear on reload** — chat is session state; the solved
  questions live in History.

## What is *not* covered by any of this

There is no unit-test framework, no component tests, and no end-to-end browser
tests in the repo. The smoke scripts cover engine correctness at the "does it
solve and stay on the sheet" level, not geometric accuracy — verifying that a
construction is *correct engineering drawing* still requires eyeballing the
canvas.
