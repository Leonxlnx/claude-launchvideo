// Exports every sync point of the film to out/cues.json for the soundtrack generator.
// Camera whooshes are placed on measured velocity peaks and impacts on the exact frame a
// spring first reaches its target, so sound follows the picture rather than the beat grid.
// Run: npx tsx scripts/export-cues.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { spring, SpringConfig } from 'remotion';
import { ACT, CUE, FPS, TOTAL } from '../src/timeline';
import { RAIN } from '../src/acts/act1-data';
import { KEY_FRAMES, PROMPT } from '../src/acts/Act3Prompt';
import { LANDINGS, STRAIGHTEN_LEN } from '../src/acts/Act4Plan';
import { BEFORE } from '../src/app/data';
import { PULL_EASE, PULL_END, QUILT_TILES, TILE_SPR } from '../src/acts/Act6End';
import { samplesAt } from '../src/blur';
import { E } from '../src/lib/anim';

type Ease = (t: number) => number;
/** frame of peak velocity of a tween running from a to b with the given easing */
const peak = (a: number, b: number, ease: Ease) => {
  let best = a;
  let bestV = -1;
  for (let i = 0; i < 400; i++) {
    const t = i / 400;
    const v = ease(Math.min(1, t + 1 / 400)) - ease(t);
    if (v > bestV) {
      bestV = v;
      best = a + t * (b - a);
    }
  }
  return Math.round(best);
};
/** first frame where a spring started at `start` reaches its target */
const hit = (start: number, cfg: Partial<SpringConfig>) => {
  for (let f = 0; f < 120; f++) if (spring({ frame: f, fps: FPS, config: cfg }) >= 1) return start + f;
  return start + 30;
};

const cascade = BEFORE.map((ev) => Math.round(ACT.prompt.from + 2 + ev.day * 3 + (ev.start - 9) * 1.6 + 6)).sort((a, b) => a - b);
const P = ACT.prompt.from;
const feat = ACT.feat.from;
const F1 = CUE.feat1 - feat;
const F2 = CUE.feat2 - feat;
const F3 = CUE.feat3 - feat;
const endFrom = ACT.end.from;
const asm = CUE.lockupEnd - endFrom;
const markFrom = ACT.mark.from;
const flyS = CUE.flyIn - markFrom;

// word-start characters in the prompt (for typing accents)
const full = PROMPT.map((t) => t.text).join('');
const wordStarts = [...full].map((ch, i) => i === 0 || (full[i - 1] === ' ' && ch !== ' '));
const spaces = [...full].map((ch) => ch === ' ');

const cues = {
  fps: FPS,
  total: TOTAL,
  bpm: 120,
  acts: ACT,
  cue: CUE,
  rain: RAIN.map((b) => b.land).sort((a, b) => a - b),
  keys: KEY_FRAMES,
  keyWordStart: wordStarts,
  keySpace: spaces,
  cascade,
  clashes: [0, 2, 4, 6, 8, 10, 12].map((k) => P + 34 + k),
  landings: LANDINGS.sort((a, b) => a.f - b.f),
  // neighbouring weeks snapping into the quilt (the ones near enough to be seen)
  quilt: QUILT_TILES.filter((t) => t.dist < 3.6)
    .map((t) => ({ f: hit(endFrom + Math.round(t.delay), TILE_SPR), dist: +t.dist.toFixed(3), x: Math.sign(t.cx) }))
    .sort((a, b) => a.f - b.f),
  // camera velocity peaks (whoosh apex goes here)
  peaks: {
    fly: markFrom + peak(flyS, ACT.mark.dur - 14, E.inOut),
    zoom: P + peak(CUE.zoomBar - P, CUE.zoomBar - P + 54, E.cam),
    macro: P + peak(CUE.typeEnd - P - 4, CUE.click - P - 2, E.inOut),
    straighten: CUE.straighten + peak(0, STRAIGHTEN_LEN, E.cam),
    cardMorph: feat + peak(0, 44, E.inOut),
    invite: feat + peak(F2 + 16, F2 + 44, E.out),
    inviteExit: feat + peak(F2 + 70, F2 + 96, E.inOut),
    back: feat + peak(ACT.feat.dur - 36, ACT.feat.dur, E.glide),
    pullBack: endFrom + peak(0, PULL_END, PULL_EASE),
  },
  sfx: {
    markSnapA: hit(markFrom + 8, { damping: 17, stiffness: 230, mass: 0.8 }),
    markSnapB: hit(markFrom + 10, { damping: 17, stiffness: 210, mass: 0.8 }),
    wordmark: CUE.lockup + 20,
    click: CUE.click,
    flood: CUE.redFill,
    toast: CUE.toast,
    f1Lift: feat + F1 + 30,
    f1Land: feat + F1 + 76,
    f1Checks: [0, 1, 2, 3].map((i) => feat + F1 + 80 + i * 5),
    drum2: CUE.feat2 - 4,
    drum3: CUE.feat3 - 4,
    f2Bounce: feat + F2 + 44,
    f2Reply: feat + F2 + 54,
    f3Late: feat + F3 + 26,
    f3LateSettle: feat + F3 + 64,
    f3ShiftSettle: feat + F3 + 80,
    wordsIn: CUE.fits - 22,
    dotHop: CUE.fits - 28,
    fitsSnap: CUE.fits,
    wordsFill: endFrom + asm - 2,
    markMorph: endFrom + asm + 40,
    lockup2: endFrom + asm + 56,
    finalBlink: CUE.final,
  },
};
mkdirSync('out', { recursive: true });
writeFileSync('out/cues.json', JSON.stringify(cues, null, 1));
// how many sub-frames make up each output frame of the motion-blurred master (scripts/accumulate.py)
writeFileSync('out/subframes.json', JSON.stringify({ groups: Array.from({ length: TOTAL }, (_, f) => samplesAt(f).length) }));
console.log('wrote out/cues.json', Object.keys(cues.sfx).length, 'sfx cues;', 'peaks', JSON.stringify(cues.peaks));
