# Using Tracer — a 15-minute tour

Tracer answers engineering questions by *drawing* them, stroke by stroke, the way
you'd build the construction on paper. This is the user's path through it.

---

## 1. Get in

Open the app → **Start engineering** (or **Sign in** if you already have an account).
Sign up with an email and a password of at least 6 characters, or use
**Continue with Google**. You land on **History**, which is empty at first.

## 2. Pick a module

The left sidebar has three:

| Module | Ask it about |
| --- | --- |
| **Graphics** | Projections of points/lines/planes/solids, sections, developments, conics and curves, scales, isometric and orthographic views |
| **Automata** | DFA/NFA construction, minimisation, regex conversion, simulation, Mealy/Moore, grammars (CNF, FIRST/FOLLOW, LL(1)), PDA, Turing machines |
| **Control Systems** | Pole-zero, Routh-Hurwitz, Bode, Nyquist, root locus, time response, PID and compensators, block diagrams, state space |

## 3. Start with an example

Each module opens with a grid of example questions. **Open** draws one straight
away; **Save** bookmarks it to your **Saved** list without opening it. Opening an
example makes your own copy of it, so anything you do to it is yours.

## 4. Ask your own question

Type it in the box at the bottom and press **Enter** (**Shift+Enter** for a new
line — grammars and block diagrams need several lines). Write it the way it
appears in a textbook, with the numbers in it:

> Line AB 80mm long, inclined 30° to HP and 45° to VP, end A 15mm above HP and 20mm in front of VP.

You get a short **Solution Summary** and an **Open** button that takes you to the
drawing. See §9 for more phrasings you can copy.

If Tracer can't work out what you're asking, it says so and gives you a numbered
list of **manual steps** for that subject instead — useful on its own when your
question is outside what the engines cover.

## 5. Watch it being drawn

The canvas is where the actual work is. Bottom bar, left to right:

- **◀ ▶** — one stroke at a time.
- **▶ play** — plays the construction, one stroke every 0.6 s.
- **The tick strip** — one tick per stroke. Click anywhere on it to jump there.
- **Step box** — type a number to go straight to that stroke.
- **Draw & Show** — restarts from a blank sheet and replays the whole thing.

The stroke being drawn right now is blue; everything already drawn is black;
what's still to come is invisible. That order *is* the answer — it's the sequence
you'd follow with compass and set-square.

## 6. Read the panels

- **Hover any line on the drawing** → the left panel tells you which stroke it is,
  which tool you'd use for it, what it's for, and its start/end coordinates in mm.
- **Automata** left panel: the machine's states, alphabet, start and accepting
  states, and the full transition table. **Control**: the transfer function, poles,
  zeros, and a stable/unstable verdict.
- Some answers are text, not drawings — Routh-Hurwitz, TF→state-space, grammar
  conversions. The sheet stays blank on purpose and the answer is in the left panel.
- **Question** (top right) reopens the exact question and the full summary.

## 7. Move around the sheet

Zoom with **+ / −** at the top-left of the sheet or ⌘/Ctrl + scroll, drag empty
space to pan, and hit the reset button to fit the sheet again.

Press **⌘K** (Ctrl-K) for the command palette: jump to any step by name, jump to
the first stroke that uses a given drafting tool, select a state in an automaton,
or jump to a specific plot in a control answer.

On Graphics you can also change the **sheet size** (A4/A3/A2, portrait or
landscape) from the button next to the title. The drawing keeps its real
millimetre sizes, so a smaller sheet crops it — A3 landscape is the default and
the safe choice.

## 8. Take it with you

**Export → PNG** or **PDF**, top right.

> **Go to the last step first** (⌘K → *Go to last step*, or let Draw & Show
> finish). The export captures the sheet exactly as it looks right now, so
> exporting mid-construction gives you a half-finished drawing.

The PDF comes out at the real sheet size, so it prints properly.

Everything you open is listed under **History**; anything you Save is under
**Saved**. Hover a row for **Open** and **Delete**/**Unsave**. Both lists follow
your account, so signing in on another device brings them with you.

---

## 9. Phrasings that work

Swap the numbers and letters — the shape of the sentence is what matters.

**Graphics**

- `Draw the projections of a point A which is 50mm above HP and 30mm in front of VP`
- `Line AB 80mm long, inclined 30° to HP and 45° to VP, end A 15mm above HP and 20mm in front of VP.`
- `Projection of a pentagon of side 30mm inclined 45° to HP and perpendicular to VP`
- `Projection of a hexagonal pyramid of base side 25mm and axis 60mm, axis perpendicular to HP`
- `Section of a cone of diameter 60mm and axis 80mm cut by a plane inclined 45° to HP through a point 30mm above the base`
- `Development of the lateral surface of a cone of base diameter 60mm and axis 80mm`
- `Draw an ellipse of major axis 100mm and minor axis 60mm`
- `Draw a cycloid for a circle of diameter 50mm`
- `Draw a plain scale of R.F. 1:50 to read up to 6 metres and decimetres`
- `Draw the isometric projection of a cube of side 40mm`
- `Draw the orthographic views of a block of width 80mm, depth 50mm and height 40mm in first-angle projection`

**Automata**

- `Construct an NFA accepting strings ending in 01`
- `Build a DFA for binary strings divisible by 3`
- `Minimize the DFA for strings ending in 01`
- `Simulate DFA on input 1101 for strings ending in 01`
- `Thompson construction for (a|b)*abb`
- `Build a Mealy machine that detects 01 edges`
- `PDA for a^n b^n`
- `Turing machine for a^n b^n c^n on input aabbcc`
- `FIRST and FOLLOW for:` + the grammar on the following lines

**Control Systems**

- `Pole-zero plot for G(s) = (s+2) / ((s+1)(s+3))`
- `Routh-Hurwitz stability for s^4 + 2s^3 + 3s^2 + 4s + 5`
- `Bode plot for G(s) = 10 / (s^2 + 2s + 10)`
- `Step response of G(s) = 25 / (s^2 + 4s + 25)`
- `Root locus of G(s)H(s) = K / (s(s+2)(s+5))`
- `Nyquist plot of G(s) = 10 / (s(s+1)(s+5))`
- `PID controller with Kp=2, Ki=1, Kd=0.5`
- `Mass-spring-damper system m=1, b=2, k=5`
- `TF to state space for G(s) = (s+1) / (s^2 + 3s + 2)`

## 10. Worth knowing

- **Your chat clears when you reload** — but every question you solved is still in
  History, drawing and all.
- **Tracer isn't a chatbot.** It doesn't explain in conversation; it solves the
  question and shows the construction. Ask one question at a time, with its numbers.
- **It works offline** once loaded — the solving happens in your browser. Only
  syncing to your account needs the network.
