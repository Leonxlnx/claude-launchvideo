// Exports every sync point of the film to out/cues.json for the soundtrack generator.
// Camera whooshes are placed on measured velocity peaks and impacts on the exact frame a
// spring first reaches its target, so sound follows the picture rather than the beat grid.
// Run: npx tsx scripts/export-cues.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { spring, SpringConfig } from 'remotion';
import { ACT, CUE, FPS, TOTAL } from '../src/timeline';
import { RAIN } from '../src/acts/act1-data';
import { CLASH_AT, CLASH_DAYS, CLASH_STEP, KEY_FRAMES, PROMPT } from '../src/acts/Act3Prompt';
import { loadAt } from '../src/app/weekLoad';
import { HOLD_BEATS } from '../src/acts/Act2Mark';
import { LANDINGS, STRAIGHTEN, STRAIGHTEN_EASE } from '../src/acts/Act4Plan';
import { BEFORE } from '../src/app/data';
import { FEAT_CUES as FC } from '../src/acts/Act5Features';
import { HOP, MORPH, PULL_EASE, PULL_END, QUILT_TILES, SHUT_AT, SHUT_LEN, STRIKE, TILE_SPR, WORDS_LEAD } from '../src/acts/Act6End';
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
/** first frame where a spring started at `start` reaches `thr` of its travel (1 = its target) */
const hit = (start: number, cfg: Partial<SpringConfig>, thr = 1) => {
  for (let f = 0; f < 120; f++) if (spring({ frame: f, fps: FPS, config: cfg }) >= thr) return start + f;
  return start + 30;
};

const cascade = BEFORE.map((ev) => Math.round(loadAt(ev) + 6)).sort((a, b) => a - b);
const P = ACT.prompt.from;
const feat = ACT.feat.from;
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
  // each landing panned to the day column it lands in (same order as `rain`)
  rainPan: [...RAIN].sort((a, b) => a.land - b.land).map((b) => +((b.day * (1920 / 7) + 137 - 960) / 960).toFixed(2)),
  keys: KEY_FRAMES,
  keyWordStart: wordStarts,
  keySpace: spaces,
  cascade,
  clashes: CLASH_DAYS.map((d) => Math.round(P + CLASH_AT + d * CLASH_STEP)),
  landings: LANDINGS.sort((a, b) => a.f - b.f),
  // neighbouring weeks snapping into the quilt (the ones near enough to be seen)
  quilt: QUILT_TILES.filter((t) => t.dist < 3.6)
    .map((t) => ({ f: hit(endFrom + Math.round(t.delay), TILE_SPR, 0.92), dist: +t.dist.toFixed(3), x: Math.sign(t.cx) }))
    .sort((a, b) => a.f - b.f),
  // camera velocity peaks (whoosh apex goes here)
  peaks: {
    fly: markFrom + peak(flyS, ACT.mark.dur - 14, E.inOut),
    zoom: P + peak(CUE.zoomBar - P, CUE.zoomBar - P + 54, E.cam),
    macro: P + peak(CUE.typeEnd - P - 4, CUE.click - P - 2, E.inOut),
    straighten: ACT.plan.from + peak(STRAIGHTEN.from, STRAIGHTEN.to, STRAIGHTEN_EASE),
    cardMorph: feat + FC.split, // the window splits open on its sidebar seam
    featAB: feat + FC.whipAB,
    featBC: feat + FC.whipBC,
    invite: feat + FC.invite, // the invite falls toward the page
    inviteExit: feat + FC.inviteExit, // knocked aside, it accelerates off toward Friday
    back: feat + FC.close,
    pullBack: endFrom + peak(0, PULL_END, PULL_EASE),
    flood: P + ACT.prompt.dur - 4, // the red flood's edge is fastest just before it fills the frame
    lockup1: markFrom + peak(CUE.lockup - markFrom, CUE.lockup - markFrom + 34, E.inOut),
    lockup2: endFrom + peak(asm + 38, asm + 74, E.inOut),
    morph: endFrom + MORPH.to - 3, // the pieces accelerate into their landing
  },
  sfx: {
    markSnapA: hit(markFrom + 8, { damping: 17, stiffness: 230, mass: 0.8 }),
    markSnapB: hit(markFrom + 10, { damping: 17, stiffness: 210, mass: 0.8 }),
    wordmark: CUE.lockup + 20,
    click: CUE.click,
    flood: CUE.redFill,
    toast: CUE.toast,
    f1Lift: feat + FC.f1Lift,
    f1Land: feat + FC.f1Land,
    f1Checks: FC.f1Checks.map((x) => feat + x),
    ratchet: FC.ratchet.map((x) => feat + x), // the line reel starts to roll
    detents: FC.detents.map((x) => feat + x), // and clicks home
    reelExit: feat + FC.reelExit, // the last line rolls off before the window swings shut
    f2Bounce: feat + FC.f2Bounce,
    f2Reply: feat + FC.f2Reply,
    f3Late: feat + FC.f3Late,
    f3LateSettle: feat + FC.f3LateSettle,
    f3ShiftSettle: feat + FC.f3ShiftSettle,
    wordsIn: CUE.fits - WORDS_LEAD,
    periodLand: endFrom + HOP.to, // the now dot lands as the period, just after the words lock
    dotHop: endFrom + HOP.from + 1, // first frame the dot visibly leaves the line
    quiltShut: endFrom + SHUT_AT + SHUT_LEN, // the gutters close with velocity: contact frame
    strikeA: endFrom + STRIKE.a + 2,
    strikeB: endFrom + STRIKE.b + 2,
    fitsSnap: CUE.fits,
    wordsFill: endFrom + STRIKE.a + 14, // the lines start to swell into blocks
    markMorph: endFrom + MORPH.to, // the pieces land with velocity: impact frame
    lockup2: endFrom + asm + 56,
    finalBlink: CUE.final,
    finalTock: CUE.final + 30,
    holdBeats: HOLD_BEATS.map((x) => markFrom + x),
  },
};
mkdirSync('out', { recursive: true });
writeFileSync('out/cues.json', JSON.stringify(cues, null, 1));
console.log('wrote out/cues.json', Object.keys(cues.sfx).length, 'sfx cues;', 'peaks', JSON.stringify(cues.peaks));
