# Build prompt: "Tone by tone" — odds hero motion piece

## Creative direction (user brief, verbatim)

```
i think the music metaphor could be cooler as an animation

- scene 1 is showing: "all prompts can sounds the same to the frontier models.."
- scene 2: they tone by tone light up (or tone down), hence being classified pre-frontier.. turning into music
- ? idk make this work. you can turn it into more of a presentation / visual metaphor.

make it a dynamic at least 15-second motion graphics video/animation that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.
```

## Your role

Be the motion director. Make it quiet and exact: an engraved score that comes to life.

## Ground truth (read before you build)

- `odds/site/src/Docs.svelte`: the hero score. Reuse its geometry: `STAFF_TOP=120`, `LINE_GAP=22`, `LEFT=150`, `RIGHT=1440`, viewBox `0 0 1500 330`, `x = LEFT + step*(i+0.5)`, `y = STAFF_BOTTOM + LINE_GAP - urgent*(LINE_GAP*6)`. `filled` = frustration tone is not `none`. Rest = `injection > 0.5`.
- `odds/site/src/app.css`: tokens `--color-paper #f3ecdc`, `--color-paper-deep #e9dfc9`, `--color-ink #1b1712`, `--color-faded #6d6253`, `--color-seal #a3271b`. Fonts: EB Garamond (`--font-serif`), IBM Plex Mono (`--font-mono`), Noto Music (`--font-music`). Reuse paper grain and the `draw-line`/`ink-in`/`playhead` keyframes.
- `odds/site/src/demo-data.ts`: the real recorded Clef run. **Import `DEMO_QUEUE`.** Check: OD-112 urgent .981; OD-110 .9456 hollow; OD-116 injection .9727 (rest).
- `odds/README.md`: odds is a Pi extension. One codemode script sends each item to Clef. Clef returns probabilities and never prose. The frontier model reads only the short result.

## Stack constraints

Svelte 5, Tailwind v4, SVG with CSS or WAAPI, in the existing svelte-hono Worker. No WebGL, video, Lottie, GSAP, or new runtime deps. CSP is strict (`script-src 'self' 'unsafe-inline'`, no external connects), so self-host every font. Build `ScoreFilm.svelte`. It replaces the hero `<figure>`; its final frame must equal the current hero.

Start only when `document.visibilityState === 'visible'` and the figure is at least 50% in view (IntersectionObserver). Pause when hidden. Play once, then show a mono "replay" link.

## Storyboard (18 000 ms total)

Easing tokens: `out = cubic-bezier(.16,1,.3,1)`, `inOut = cubic-bezier(.65,0,.35,1)`, `snap = cubic-bezier(.34,1.56,.64,1)` (use it only on note heads), `linear` (only for the playhead).

**Scene 1 — The hum (0–4 500 ms)**
- 0–600: Paper and grain fade in (opacity 0 to .6, `out`).
- 300–2 400: All 16 real ticket titles type in. Use IBM Plex Mono 13px, `--color-faded`, opacity .55, in one row-stacked column of identical grey lines at a 90 ms stagger.
- 1 200–4 500: Under each title, a flat waveform (±2px, all in phase, one shared clock). Opacity .4.
- 2 600–4 200: Caption C1 fades up.
- 4 200–4 500: The titles compress toward the vertical centre (translateY, `inOut`). They become 16 grey dots on one horizontal line.

**Scene 2 — Clef listens (4 500–7 000 ms)**
- 4 500–5 300: A short seal-red mono label `clef` appears at left. A thin red scan line sweeps left to right across the 16 dots (`linear`, 800 ms).
- 5 000–6 800: The five staff lines draw from the single line outward (top and bottom lines split from the centre line, `out`, 60 ms stagger). The treble clef `𝄞` (Noto Music, 128px) inks in at 6 200 ms. Probability labels (`0%…100%`, mono 13px) ink in at 6 500.
- Caption C2 at 5 200.

**Scene 3 — Tone by tone (7 000–13 600 ms)**
- Each ticket gets 380 ms, in data order. Each dot does the following:
  1. Rises or falls to its real `y` (420 ms, `out`).
  2. Morphs from a grey dot to a note head (scale 1.0, 1.25, 1; `snap`). It fills ink if the tone is `mild` or `high`, and stays hollow if the tone is `none`. Stem and ledger lines draw after it in 160 ms.
  3. Its waveform segment above it changes amplitude in proportion to `urgent` (high = tall, low = nearly flat), then fades.
- OD-116 (index 15, 12 700 ms): the dot starts to rise toward .50. At the midpoint it shudders (3 × 2px x-jitter, 180 ms), then turns seal red and drops into the staff as a rest `𝄽` (54px). The italic serif word `injection` inks in above it.
- Captions C3 at 7 200, C4 at 12 600.

**Scene 4 — Only the short result (13 600–16 200 ms)**
- 13 600–15 000: The seal-red playhead sweeps `LEFT` to `RIGHT` (`linear`, 1 400 ms). As it crosses each note with urgent > .5 or each rest, that note pulses once (scale 1.08, 200 ms). The other notes dim to opacity .45.
- 15 000–16 200: The six returned items (use the same `returned` sort as Docs.svelte) slide out from the right edge as a compact mono list. Next to it, show two stacked counter lines (no arrows): `clef read 5 936 tokens` and `frontier read 1 176`. Numbers count up (`out`).
- Caption C5 at 14 000.

**Scene 5 — Resolve (16 200–18 000 ms)**
- The list and the counters fade out. All notes return to full opacity. The heading text "Example: 16 support tickets…" inks in. The final bar line thickens. Hold.
- At 18 000 the DOM matches the static hero exactly. The animation layers are removed from the DOM.

## Caption track (ASD-STE100: short sentences, active voice, simple words)

EB Garamond italic 22px, ink, centred below the staff, cross-fade 300 ms `inOut`.
- C1: "To a large model, many messages sound the same."
- C2: "Clef listens to each message first."
- C3: "Clef gives each one a number. High notes need an engineer today."
- C4: "This message tries to give orders. Clef marks it as a rest."
- C5: "The large model reads only these few notes."

## Reduced motion

With `prefers-reduced-motion: reduce`, render the final frame at once with no timeline. Add a static `<figcaption>` with C1–C5 as one paragraph.


## Performance

Animate only `transform` and `opacity`, plus `stroke-dashoffset` for line draws. Use one timeline clock (WAAPI `document.timeline` or one rAF) and per-element `delay`s. Do not run a timer per note. Added JS must be **≤ 6 KB gzipped**. Report it from the build diff.

## Acceptance criteria (the builder must verify and attach evidence)

1. `npm run build` passes; no new `dependencies`.
2. Use the cmux browser at `localhost` dev. Capture PNGs at **1 000, 4 400, 6 800, 10 000, 12 900, 14 500, 18 500 ms**. Name each file `t{ms}.png`. Each shows its beat (hum, line, staff, notes, rest, playhead, final).
3. `t18500.png` matches a capture of the current hero.
4. Emulate reduced motion and capture at 0 ms. It must equal the final frame, with no animations in `document.getAnimations()`.
5. In a background tab for 5 s, the timeline stays at 0.
6. Use a DevTools Performance trace on a laptop with no CPU throttle. The trace must hold 60 fps with no long tasks > 50 ms. At 4× throttle, it must not drop below 50 fps.
7. Note positions and fills match `DEMO_QUEUE`.
8. No CSP violations or third-party requests.
9. Final-state hover and focus work as now.
