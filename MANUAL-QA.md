# Manual QA — verifying Tracer by using it

Every user-facing feature, checked by hand in a browser. No test scripts, no
terminal assertions — you click through the app and compare what you see with
what this document says you should see.

This complements `VERIFY.md` (static checks + engine smoke scripts) and
`DEPLOY.md` (shipping). If you only have five minutes, do §4 and §5 for one
module. A full pass is ~40 minutes.

Expected values below (step counts, header strings, card counts) were read off
the engines at commit `5c3c779`. They are exact for that build — a small drift
after an engine change is fine, a collapse from 136 strokes to 4 is not.

---

## 0. Set up the session

**Pick what you're testing.** All three behave identically except where noted:

| Target | How | URL |
| --- | --- | --- |
| Dev server (fastest loop) | `npm run dev` | http://localhost:5173 |
| Production bundle, locally | `npm run build && npm run preview` | http://localhost:4173 |
| Live site | — | https://tracer-137d2.web.app |

**Open DevTools and keep the Console visible for the whole pass** (⌥⌘J on Mac).
You'll also need the Network tab for the offline checks in §9.

**Have ready:** your normal account, a second throwaway email account (for the
cross-user isolation check in §7), and a Google account.

**Console noise that is expected, not failure:**
`Firestore listHistory failed/skipped: …`, `Firestore saveQuestion failed/skipped: …`
and similar. Every Firestore call in `src/lib/storage.ts` is wrapped in a 4 s
read / 6 s write timeout so a slow or offline database can never block the UI;
the warning is that guard firing. Anything else red — a React error, an uncaught
promise rejection, or the full-screen "Something went wrong" card — is a real bug.

---

## 1. Public pages and route guards  (~2 min)

Sign out first (sidebar footer → **Logout**).

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Visit `/` | Marketing home: sticky top bar with **Modules · Workflow · Sign in** and a **Start engineering** button |
| 2 | Scroll the whole page | Hero → "How it works" → three module sections in order (Engineering Graphics, Automata Theory, Control Systems), each with an animated visual → footer. Scroll-linked visuals animate as they enter |
| 3 | Click **Start engineering** | Goes to `/signup` |
| 4 | Click **Sign in** in the nav | Goes to `/login` |
| 5 | Type `/app/history` in the address bar | Brief `Loading…`, then bounced to `/login` |
| 6 | Type `/app/canvas/abc` | Also bounced to `/login` (the canvas route is protected too) |
| 7 | Type `/totally/unknown` | Redirected to `/` (home, because you're signed out) |
| 8 | Sign in, then visit `/` again | Redirected to `/app/history` — the marketing page is only for signed-out visitors |

The brief `Loading…` in steps 5–6 is Firebase resolving the auth session. If you
land on `/login` **without** it flickering, that's fine; if you get stuck on
`Loading…` for more than a couple of seconds, Firebase Auth isn't initialising.

---

## 2. Authentication  (~6 min)

### 2.1 Sign up

1. `/signup` → fill **Name**, **Email** (fresh address), **Password** (≥ 6 chars) → **Create account**.
2. Expect: button shows its loading state, then you land on `/app/history`.
3. Go to `/app/profile` — the name you typed is the heading, the email is below it,
   **Sign-in provider** reads `Email & Password`.
4. The sidebar footer shows the first two letters of your name, uppercased.

### 2.2 Error messages

Each of these must produce a readable sentence in the red box above the button —
never a raw Firebase code like `auth/invalid-credential`:

| Input | Expected message |
| --- | --- |
| Right email, wrong password | *Incorrect email or password.* |
| Email that already has an account (on `/signup`) | *An account with that email already exists. Try signing in instead.* |
| Email with no account (on `/login`) | *No account exists for that email.* |
| Many rapid failed attempts | *Too many failed attempts. Please wait a moment and try again.* |
| Wi-Fi off, then Sign in | *Network error — check your connection and try again.* |

Note: a short password is caught by the **browser** before Firebase sees it — the
password field has `minLength=6`, so you get the browser's own "Please lengthen
this text…" tooltip, not the app's *Password is too weak* message. Both are
correct behaviour; don't chase the missing app message.

### 2.3 Google sign-in

1. **Continue with Google** → popup → pick an account → you land on `/app/history`.
2. `/app/profile` now shows your Google avatar and **Sign-in provider: Google**.
3. Now block popups for the site (Chrome: the icon at the right of the address bar)
   and retry. It must fall back silently to a **full-page redirect** and still end
   up signed in. (Code path: `signInWithPopup` → `signInWithRedirect` → `getRedirectResult`.)
4. On the live site only: if you get *This domain is not authorised for Google
   sign-in…*, add the domain in Firebase console → Authentication → Settings →
   Authorized domains.

### 2.4 Session and logout

| # | Do this | Expect |
| --- | --- | --- |
| 1 | While signed in, hard-reload (⇧⌘R) | Short `Loading…`, then you stay signed in on the same page |
| 2 | Open the app in a second tab | Signed in there too |
| 3 | Profile → **Sign out** (or sidebar → **Logout**) | Lands on `/login` |
| 4 | Press the browser Back button | You are not let back into the app — you end up on `/login` again |
| 5 | Profile → **Switch account** | Same as sign out (it logs you out so you can sign in as someone else) |

---

## 3. App shell  (~1 min)

With the app open, check the left sidebar:

- **Workspace:** History · Saved · Profile
- **Modules:** Graphics · Automata · Control Systems
- **System:** Settings

Seven destinations, three labelled groups. Click each one: it loads without a
console error and the active item gets a boxed highlight. The footer shows your
initials, name, email, and **Logout**.

Visit `/app` with no sub-path → redirects to `/app/history`.

---

## 4. Module pages (the chat)  (~12 min)

Run this section three times: `/app/graphics`, `/app/automata`, `/app/control`.

### 4.1 Header

| Page | Title | Subtitle |
| --- | --- | --- |
| Graphics | Engineering Graphics | Projections, conics, curves, sectioning, and more |
| Automata | Automata Theory | DFA, NFA, regex, CFG, PDA, Turing machines |
| Control | Control Systems | Transfer functions, root locus, Bode, Nyquist, stability |

### 4.2 Example cards — a free regression test

On an empty chat you get a grid of example cards. Count them:

| Module | Cards |
| --- | --- |
| Graphics | **18** |
| Automata | **4** |
| Control | **3** |

These cards are built by **running the engines when the page loads**; any seed
the engine can no longer solve is silently dropped from the grid. A missing card
means an engine regression, even though nothing looks broken.

### 4.3 Open / Save on a card

- **Open** → navigates to the canvas for that example, and the item also appears
  in `/app/history` (opening an example makes a private copy under your account —
  intended, see Appendix A).
- **Save** → a small **Saved** toast slides up at the bottom centre and fades
  after ~2 s; the item then appears under `/app/saved`.

### 4.4 Asking a question

Check the input itself:

- Type text → the send button turns blue; empty/whitespace → it stays grey and does nothing.
- **Enter** sends. **Shift+Enter** inserts a newline (needed for the grammar and
  block-diagram prompts below, which are multi-line).
- While solving: the textarea is disabled and a three-dot loader appears under the
  last message.
- Then an assistant bubble appears, labelled **Solution Summary**, with an
  **Open** button (and a **Save** button that just toasts *Already saved to
  History* — see Appendix A).
- The view auto-scrolls to the newest message.

### 4.5 Known-good prompts

Paste these one at a time. "Header" is the grey line under the title in the
canvas top bar; "Steps" is the `/ N` total in the bottom-right of the canvas.

**Graphics** (`/app/graphics`) — header is always the sheet size, `420 × 297 mm`:

| Prompt | Steps |
| --- | --- |
| `Draw the projections of a point A which is 50mm above HP and 30mm in front of VP` | 13 |
| `Line AB 80mm long, inclined 30° to HP and 45° to VP, end A 15mm above HP and 20mm in front of VP.` | 17 |
| `Projection of a hexagonal pyramid of base side 25mm and axis 60mm, axis perpendicular to HP` | 35 |
| `Section of a cone of diameter 60mm and axis 80mm cut by a plane inclined 45° to HP through a point 30mm above the base` | 136 |
| `Development of the lateral surface of a cone of base diameter 60mm and axis 80mm` | 18 |
| `Draw an ellipse of major axis 100mm and minor axis 60mm` | 30 |
| `Draw a plain scale of R.F. 1:50 to read up to 6 metres and decimetres` | 38 |
| `Draw the isometric projection of a cube of side 40mm` | 19 |
| `Draw the orthographic views of a block of width 80mm, depth 50mm and height 40mm in first-angle projection` | 17 |

**Automata** (`/app/automata`):

| Prompt | Header | Steps |
| --- | --- | --- |
| `Construct an NFA accepting strings ending in 01` | `DFA · 3 states · |Σ|=2` | 21 |
| `Build a DFA for binary strings divisible by 3` | `DFA · 3 states · |Σ|=2` | 21 |
| `Minimize the DFA for strings ending in 01` | `DFA · 3 states · |Σ|=2` | 42 |
| `Simulate DFA on input 1101 for strings ending in 01` | `DFA · 3 states · |Σ|=2` | 21 |
| `Convert DFA for length divisible by 3 to a regex via state elimination` | `ε-NFA · 6 states · |Σ|=4` | 25 |
| `Build a Mealy machine that detects 01 edges` | `Mealy · 2 states · |Σ|=2` | 14 |
| `PDA for a^n b^n` | `PDA · 3 states · |Σ|=4` | 19 |
| `Turing machine for a^n b^n c^n on input aabbcc` | `TM · 6 states · |Σ|=15` | 254 (on an **A2** sheet) |
| `Convert to CNF:` ⏎ `S -> aSb | ε` ⏎ `A -> a` | `420 × 297 mm` | **0** — see §5.11 |

**Control** (`/app/control`):

| Prompt | Header | Steps |
| --- | --- | --- |
| `Pole-zero plot for G(s) = (s+2) / ((s+1)(s+3))` | `pole-zero · order 2 · type 0` | 28 |
| `Bode plot for G(s) = 10 / (s^2 + 2s + 10)` | `bode · order 2 · type 0` | 64 |
| `Step response of G(s) = 25 / (s^2 + 4s + 25)` | `step-response · order 2 · type 0` | 32 |
| `Root locus of G(s)H(s) = K / (s(s+2)(s+5))` | `root-locus · order 3 · type 1` | 76 |
| `Nyquist plot of G(s) = 10 / (s(s+1)(s+5))` | `nyquist · order 3 · type 1` | 10 |
| `PID controller with Kp=2, Ki=1, Kd=0.5` | `pid` | 62 |
| `Block diagram reduction:` ⏎ `G1 = 1/(s+1)` ⏎ `G2 = 10/(s+5)` ⏎ `H = 1` ⏎ `series: G1, G2` ⏎ `negative feedback STEP1 over H` | `block-reduction` | 39 |
| `Routh-Hurwitz stability for s^4 + 2s^3 + 3s^2 + 4s + 5` | `routh` | **0** — see §5.11 |
| `TF to state space for G(s) = (s+1) / (s^2 + 3s + 2)` | `tf-to-ss · order 2 · type 0` | **0** — see §5.11 |

### 4.6 The refusal path

Ask a question the engine can't serve:

- Graphics — `Where are my keys?` → refusal + **12** numbered manual steps
- Automata — `Where are my keys?` → refusal + **4** steps
- Control — `Explain how the loop works` → refusal + **5** steps

Expect a polite one-paragraph reason, then an amber-bordered **Manual Drawing
Steps** box with a numbered list tailored to that subject (HP/VP layout for
Graphics; state-drawing for Automata; G(s) = N(s)/D(s) for Control). A blank
bubble, a stack trace, or a generic list in the wrong subject is a bug.

### 4.7 Chat session state

Ask something in Graphics → switch to Automata → come back to Graphics. Your
messages are still there (chat is per-module and in memory). Reload the page:
the chat clears, but every question you asked is still in `/app/history`. Both
halves of that are intended.

---

## 5. Canvas workspace  (~12 min)

Open any solved question (`/app/canvas/:id`).

### 5.1 Load and header

- A spinner with **Loading canvas…** appears briefly (deliberately held ~300 ms).
- Top bar left → right: back arrow, question title, then a small caps line with
  the module name — **Drafting**, **Automata**, or **Control** — a `·`, and the
  meta string from §4.5.
- On **Graphics only**, a paper-size button sits next to the title (e.g. `A3 LANDSCAPE`).
- Top bar right: a **Search ⌘K** button (hidden on narrow windows), **Question**, **Export**.

### 5.2 Zoom and pan

Top-left of the drawing area: **−**, a percentage, **+**, and a reset button.

| Do this | Expect |
| --- | --- |
| Open a canvas | The sheet is fitted to the pane, and the readout says `100%` (100% = fit, not 1:1) |
| Click **+** / **−** | Zooms in 25 % steps, capped at 5× / floored at 0.25× of the raw scale |
| Ctrl+scroll or ⌘+scroll over the canvas | Same zoom, and the page itself must not scroll |
| Drag on empty space | Pans the sheet; the cursor becomes a grabbing hand |
| Drag starting on a stroke | Does **not** pan (strokes take the click) |
| Click the reset button | Back to fit, pan cleared |
| Resize the window | Re-fits automatically |

Zoom and pan are display-only — they never affect an export (§6).

### 5.3 Step navigator (footer)

- **◀ / ▶** move one step and stop any playback.
- The **tick ruler** has exactly one tick per stroke: short grey = not yet drawn,
  medium blue = already drawn, tall dark = the current step. Click any tick to
  jump there. Hovering a tick darkens it.
- The **Step** box accepts a typed number; press Enter or click away to commit.
  Type `-5` → clamps to `0`; type `9999` → clamps to the total. Garbage text
  reverts to the current value.
- **▶ play** advances one stroke every **600 ms** and stops on the last one.
  Pressing play when you're already at the end restarts from 0. The button
  becomes a pause icon while running.
- Pressing ◀ / ▶, clicking a tick, or typing a step **cancels** playback.

### 5.4 Draw & Show

Click **Draw & Show** (bottom right): it jumps to step 0 and replays the whole
construction from the beginning. The button reads **Showing…** with an outlined
style while running and reverts to blue **Draw & Show** when it reaches the end.

### 5.5 What the canvas should look like

| Situation | Expect |
| --- | --- |
| Step 0 | Empty sheet (a white rectangle with a hairline border) |
| Mid-construction | Only strokes up to the current step are visible; not-yet-drawn strokes are fully invisible, not greyed |
| The current stroke | Drawn in blue, slightly thicker, with a short draw-on animation (~460 ms) |
| Earlier strokes | Near-black. In automata, accepting-state circles are green and start markers blue |
| Hover any visible stroke | It turns light blue and thickens |
| Click a stroke | It stays selected; click it again to deselect. On Graphics the left panel pins to that stroke |

### 5.6 Left panel

- **Graphics — Stroke Analysis.** Shows the hovered stroke, else the selected
  stroke, else the current step's stroke: Step Order (`#12`), Required Tool
  (compass / set-square / …), the instruction sentence, start and end
  coordinates in mm, plus Radius and Layer when the stroke has them. With
  nothing hovered at step 0 it reads *Hover or click any stroke to inspect it.*
- **Automata.** Headline, then **Machine** (Type, States |Q|, Alphabet Σ, Start q₀,
  Accept F, Transitions, plus Stack/Tape rows for PDA/TM), a **Transition table**
  (collapsible, with its `rows×cols` count in the header), a **Simulation** trace
  for simulate-style questions, **Outputs** for Mealy/Moore, and **Conversions**.
  Verify against the question: for `binary strings divisible by 3` you should see
  3 states, Σ = {0, 1}, start q0, accept {q0}.
- **Control.** Headline, **System** (Topic, Order, Type, Poles, Zeros, and a green
  `stable` / red `unstable` pill), **Transfer function** (collapsible, with the
  pole and zero lists), plus **Reduction**, **Stability / Routh**, and **Mason**
  sections when the topic has them. For the Routh example the whole Routh array
  is here.

### 5.7 Right panel

- **Graphics — Progress:** `current / total`, a bar, and a percentage that tracks
  the step navigator exactly.
- **Control — Plots & progress:** one clickable row per plot; clicking scrubs the
  canvas to that plot's region.
- **Automata — State inspector:** it says *Hover or click a state on the canvas to
  inspect it*, but the canvas today reports **strokes**, not states — the way to
  fill this panel is the command palette (§5.8): ⌘K → `Select state q1`. Then you
  get Start / Accepting / In-degree / Out-degree / Self-loops for that state. An
  empty inspector after clicking a circle on the canvas is a known limitation,
  not a regression.

### 5.8 Command palette (⌘K / Ctrl-K)

| Check | Expect |
| --- | --- |
| Press ⌘K | Palette opens centred, search focused. Pressing ⌘K again closes it |
| Press ⌘K while typing in the Step box | Nothing happens (deliberate — the step field keeps working) |
| Groups, Graphics | **Playback** (2) · **Steps** (up to 50, each hinted with that stroke's instruction) · **Tools** (one per distinct drafting tool; running one jumps to the first stroke that uses it) |
| Groups, Automata | **Playback** · **Steps** · **States** (`Select state q0`, hinted `in N · out M`) · **Conversions** (e.g. *Minimize DFA*, *Convert to regex* — these copy a re-ask prompt to your clipboard; paste it into the chat to check) |
| Groups, Control | **Playback** · **Steps** · **Plots** · **Reduction** |
| Type `step 12` | Filters; Enter scrubs the canvas to step 12 |
| ↑ / ↓ | Moves the highlight and keeps it scrolled into view |
| Esc, or click the dimmed backdrop | Closes without running anything |

### 5.9 Paper size (Graphics only)

1. Click the paper button → choose from **A4 / A3 / A2** and **portrait / landscape**.
2. The sheet in the viewport immediately changes to those proportions and refits.
3. **Important:** the drawing does *not* rescale — strokes keep their millimetre
   coordinates. Going A3 → A2 adds blank margin; going A3 → A4 crops anything
   that now falls outside the smaller sheet. That is the current design; use A3
   landscape (the engine default) for a faithful export.
4. Reload the page (⌘R) and reopen the same canvas URL — your choice persists
   (it's written to Firestore). If you instead press Back and re-open the question
   inside the same session, you may see the original paper again: that's the
   in-memory session cache, not lost data. Reload to confirm.

### 5.10 Question modal, back, and bad ids

- **Question** → modal with the exact text you typed and the full solution summary; Esc or the close button dismisses it.
- Back arrow → returns to wherever you came from (chat, History, or Saved).
- Visit `/app/canvas/does-not-exist` → a **Question not found** card with
  *It may have been deleted or never saved.* and a **Back to History** button.
  A blank screen here is a bug.

### 5.11 Answers with an empty canvas

Some topics are text answers, not drawings: **Routh-Hurwitz**, **TF → state
space**, and the **CFG / CNF** conversions all legitimately produce **0 strokes**.
Expect: blank sheet, `0 / 0` in the step box, no ticks on the ruler, Draw & Show
does nothing visible — and the actual answer in the **left panel** (Routh array,
state-space matrices) and in the assistant bubble / **Question** modal. Exporting
one of these gives a blank sheet; that's consistent, not a failure.

---

## 6. Export  (~5 min)

**The one gotcha:** export rasterises the drawing *as currently displayed*, so
export at step 12 and you get a half-finished drawing. **Go to the last step
first** (⌘K → *Go to last step*, or let Draw & Show finish).

Then, for at least one question per module:

| # | Do this | Expect |
| --- | --- | --- |
| 1 | **Export → PNG image** | Menu item shows a small spinner, the Export button shows its loading state, then the file downloads |
| 2 | Open the PNG | White background, the full drawing, nothing clipped at the edges, text legible |
| 3 | Check its pixel size | 200 dpi for the selected sheet: A3 landscape = **3307 × 2339**, A4 landscape = 2339 × 1654, A2 landscape = 4677 × 3307 |
| 4 | **Export → PDF document** | Single page, page size equal to the sheet in mm (A3 landscape = 420 × 297 mm), orientation follows the paper |
| 5 | Check the filename | Slug of the question title, lowercase and hyphenated, ≤ 60 chars, e.g. `point-a-lies-50mm-above-hp-and-30mm-in-front-of-vp.png` |
| 6 | Zoom in to 300 %, pan, then export again | Output is identical — zoom/pan must not leak into the file |
| 7 | Export the Turing machine question (254 strokes, A2) | Everything fits inside the sheet; nothing is cut off |

If a browser blocks the download, allow multiple/automatic downloads for the site.

---

## 7. History and Saved  (~6 min)

### 7.1 The table

Both pages use the same layout: columns **Question · Module · Steps · Opened/Saved**,
and a `N questions` count at the bottom. Per row check:

- The sub-line under the title shows the sheet size, plus ` · saved` on Saved rows.
- **Steps** equals the stroke count you saw in the canvas.
- The action buttons (**Delete**/**Unsave** and **Open**) are invisible until you
  **hover the row** — that's styling, not a missing feature.
- Clicking anywhere else on the row opens the question.

### 7.2 Behaviour

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Ask a question, then go to `/app/history` | It's at the top (newest first) |
| 2 | Click a row | Its canvas opens |
| 3 | Hover a row → **Delete** | Row disappears immediately; reload → still gone |
| 4 | Save an example, go to `/app/saved` | It's listed, with the Saved date |
| 5 | **Unsave** it | Disappears; reload → still gone. It remains in History (unsave ≠ delete) |
| 6 | Sign in as the same user in another browser or device | Same History and Saved lists (they live in Firestore at `users/{uid}/questions`) |
| 7 | Sign in as your throwaway second account | History is empty — no cross-user leakage. Sign back in and yours is intact |
| 8 | With an empty account, look at the History empty state | "No history yet" card with three module shortcut buttons that navigate correctly |

---

## 8. Profile and Settings  (~2 min)

**`/app/profile`** — avatar (Google photo, else your two-letter initials), display
name, email, then four fields: User ID (monospace uid), Display name, Email,
Sign-in provider. Buttons: **Switch account** and **Sign out**, both of which log
you out and land on `/login`.

Provider is inferred from whether you have a photo, so a Google account with no
profile picture will read `Email & Password`. Cosmetic, and known.

**`/app/settings`** — informational only, nothing is clickable:
Storage → Cloud sync (green *Connected*) and Local cache (green *Connected*);
Appearance → Theme; About → Version `1.0.0` and the engines line.
Note the Theme row still reads **Tracer Dark** while the UI is the light
"Editorial Technical" design — stale copy, worth fixing, not a functional fault.

---

## 9. Resilience and edge cases  (~5 min)

| # | Do this | Expect |
| --- | --- | --- |
| 1 | DevTools → Network → **Offline**, reload `/app/history` | Empty-state card within ~4 s, a `Firestore listHistory failed/skipped` warning, and a UI that still navigates. This graceful degradation is intended |
| 2 | Still offline, open a question you solved earlier **in this session** | Still opens (served from the in-memory cache) |
| 3 | Still offline, ask a new question | It still solves and renders — the engines run entirely in the browser. Only the persistence warning appears |
| 4 | Back online, reload | History repopulates, including anything you asked while offline (writes retry through the SDK) |
| 5 | Reload while sitting on a canvas URL | The same drawing comes back at step 0 |
| 6 | Narrow the window below ~768 px | The ⌘K **Search** button hides; ⌘K itself still works |
| 7 | Ask a question with a very long prompt | The canvas title truncates with an ellipsis rather than breaking the header |
| 8 | Anywhere in the app | You should never see the red **Something went wrong** card. If you do, copy the stack from it — that's the ErrorBoundary and always a real bug |

---

## 10. Production pass (after a deploy)  (~5 min)

On https://tracer-137d2.web.app, hard-reload (⇧⌘R) and:

1. Sign in with email/password **and** with Google.
2. Ask one question per module and open each canvas.
3. Draw & Show one construction end to end.
4. Export one PNG and confirm it opens.
5. Confirm all three land in History, then delete one and reload.
6. Open a canvas URL directly in a fresh tab (deep link must not 404 — that's the
   SPA rewrite in `firebase.json`).
7. Check the console: only the Firestore warnings, nothing else.

If the site looks like the previous version, hard-reload — and if that fixes it,
check the cache headers per `VERIFY.md` Layer 5.

---

## Appendix A — Expected behaviour that looks like a bug

- **Opening an example clones it**, so History fills with copies of examples you
  viewed. Intended: examples are read-only, your copy is yours.
- **Save on an assistant answer** toasts *Already saved to History* rather than
  saving — the question was persisted the moment it was solved.
- **Chat messages vanish on reload.** Chat is session state; the solved questions
  live in History.
- **`Firestore … failed/skipped` console warnings.** By design — every call is
  timeout-guarded so the UI never blocks on the database.
- **Zero-step answers** (Routh, TF→SS, CNF) leave the canvas blank; §5.11.
- **A reopened example may render slightly differently from when you saved it** —
  questions stored without structured `meta` are re-solved by the engine on open,
  so they pick up the current layout code.
- **The automata state inspector stays empty when you click a state circle** —
  use ⌘K → *Select state …*; §5.7.
- **Changing paper size crops instead of rescaling**; §5.9.
- **A short password shows the browser's tooltip**, not the app's message; §2.2.
- **Settings says "Tracer Dark"** on a light UI; §8.

## Appendix B — Always a real bug

- The red **Something went wrong** ErrorBoundary card.
- Any React error, uncaught rejection, or `undefined is not a function` in the console.
- A refusal on a question from the §4.5 tables.
- A missing example card (fewer than 18 / 4 / 3).
- A stroke count that collapses (e.g. the cone section dropping from 136 to a handful).
- Drawing that runs off the sheet, or an export with content clipped at the edge.
- Being bounced to `/login` while signed in, or seeing another user's History.
- A deleted question reappearing after reload.

## Appendix C — 10-minute smoke (when you don't have 40)

1. Sign in. 2. `/app/graphics` → 18 cards. 3. Ask the point-projection prompt →
13 steps. 4. Draw & Show to the end. 5. ⌘K → *Go to last step* → Export PNG →
open it. 6. `/app/automata` → ask the divisible-by-3 DFA → check the left panel
says 3 states, Σ = {0, 1}. 7. `/app/control` → ask the Bode prompt → 64 steps.
8. `/app/history` → all three are listed → delete one → reload → still gone.
9. Console clean apart from Firestore warnings.

---

### A note on `VERIFY.md`

Two details in its Layer 4 have drifted from the app: the example-card buttons
read **Open** / **Save** (not *View*), and changing paper size does **not**
rescale the drawing (§5.9). Everything else there still holds.
