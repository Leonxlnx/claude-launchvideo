# Tessel — launch film

A 32-second launch film for **Tessel**, a fictional product: *the calendar that plans itself.*
Everything you see and hear is generated from code in this repo. The picture is built with
[Remotion](https://www.remotion.dev) (React → frames), and the soundtrack is synthesized in Python.
It uses no stock footage, no samples and no templates.

**Watch:** [`video/tessel-launch.mp4`](video/tessel-launch.mp4) (1920×1080, 60 fps, stereo AAC).

---

## The idea

Your week doesn't fit. Tessel fits it.

The film is one continuous relay. A single red dot, the calendar's *now* marker, is handed from
shot to shot and never leaves the screen:

| Time | Act | What happens |
| --- | --- | --- |
| 0:00 | **Doesn't fit** | The dot draws a day. Meetings rain in. "doesn't fit." slams in too big for the frame, then everything implodes back into the dot. |
| 0:06 | **Mark** | The dot's shockwave floods the frame black. Two blocks snap around it to form the Tessel mark, and the wordmark slides out from behind it. |
| 0:09 | **Logo becomes product** | The tall block morphs into the app's sidebar, the square into the calendar, and the dot into the red *now* line. |
| 0:10 | **Prompt** | The overbooked week loads and seven clashes flash. The camera dives into the command bar, *"Protect my mornings. Gym Tue + Thu. Ship the deck by Friday."* is typed, and the red send button floods the screen. |
| 0:14 | **The fitting** | The red field collapses into *now* on a tabletop view of the week. Every block lifts, flies and lands on the beat. Declined meetings drift off to next week, and ink focus blocks drop in heavy. The camera straightens on a clean week. |
| 0:18 | **Features** | The window shrinks into a live crop of the same week while a time-picker of lines rolls: *Moves meetings. / Guards your focus. / Replans in real time.* |
| 0:24 | **Everything fits.** | Pull back into a quilt of perfectly packed weeks. The two words slide in and lock together. The red period becomes the mark's dot, and the lockup resolves. |

## Brand

- **Name:** Tessel, from *tessellation*: pieces that fit together with no gaps.
- **Mark:** three pieces that tile one square. A tall block, a square block, and the red *now* dot.
  It has one fully rounded corner, which makes it read at 16 px.
- **Palette:** ink `#0B0B0C`, paper `#FFFFFF`, cool neutrals, and one accent, red `#F0282D`,
  used only for *now* and for things that just happened.
- **Type:** Geist (sans) and Geist Mono. No serif, no italics.

## Sound

`scripts/soundtrack.py` synthesizes the whole score and every sound effect from oscillators and
noise (PolyBLEP saws, FM bells, filtered noise, convolution reverb, sidechain, limiter).
It reads `out/cues.json`, which is exported from the **same timeline the picture uses**,
so every tick, snap, key click and block landing sits on its exact frame.

- 120 BPM, A♭ major (IV – I/3 – vi – V), one bar per chord.
- A soft Swiss-clock tick-tock is the sonic signature (intro and breakdown).
- The drops sit on the ink flood (0:06) and on the fitting (0:14). The resolution lands on the "fits." snap (0:28).
- Mastered to −14 LUFS integrated with a −1 dBFS ceiling.

## Run it

```bash
npm install
npm run studio                          # interactive preview
npx tsx scripts/export-cues.ts          # timeline → out/cues.json
python3 scripts/soundtrack.py           # cues → public/audio/soundtrack.wav
npx remotion render Launch out/launch.mp4 --crf=16
```

Python needs `numpy scipy soundfile pyloudnorm`. Rendering uses headless Chromium
(configured in `remotion.config.ts`).

## Layout

```
src/
  timeline.ts          single source of truth: acts + beat-locked cues (60 fps, 120 BPM)
  Launch.tsx           the film (acts in sequence, grain, audio)
  brand/               tokens, the mark
  app/                 the Tessel calendar UI (real, data-driven components) + week data
  acts/                Act1Fit … Act6End
  fx/                  camera, word reveals, cursor, grain, windowed motion blur
  lib/                 easing library, springs, font gate, DOM text measurement
scripts/
  export-cues.ts       exports every sync point for the soundtrack
  soundtrack.py        score + sound design synthesizer
  audio_balance.py     octave-band spectrum comparison
  sheet.sh             contact sheets for frame-by-frame review
```

Tessel is fictional. Any resemblance to a real product is unintended.
