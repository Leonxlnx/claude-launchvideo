// Exports every sync point of the film to out/cues.json for the soundtrack generator.
// Run: npx tsx scripts/export-cues.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { ACT, CUE, FPS, TOTAL } from '../src/timeline';
import { RAIN } from '../src/acts/act1-data';
import { KEY_FRAMES } from '../src/acts/Act3Prompt';
import { LANDINGS } from '../src/acts/Act4Plan';
import { BEFORE } from '../src/app/data';

const cascade = BEFORE.map((ev) => Math.round(ACT.prompt.from + 2 + ev.day * 3 + (ev.start - 9) * 1.6 + 6)).sort((a, b) => a - b);
const F = (abs: number) => abs;
const feat = ACT.feat.from;
const F1 = CUE.feat1 - feat;
const F2 = CUE.feat2 - feat;
const F3 = CUE.feat3 - feat;
const endFrom = ACT.end.from;
const asm = CUE.lockupEnd - endFrom;

const cues = {
  fps: FPS,
  total: TOTAL,
  bpm: 120,
  acts: ACT,
  cue: CUE,
  rain: RAIN.map((b) => b.land).sort((a, b) => a - b),
  keys: KEY_FRAMES,
  cascade,
  landings: LANDINGS.sort((a, b) => a.f - b.f),
  sfx: {
    markSnapA: F(ACT.mark.from + 18),
    markSnapB: F(ACT.mark.from + 24),
    wordmark: F(CUE.lockup + 14),
    flyWhoosh: F(CUE.flyIn),
    zoomWhoosh: F(CUE.zoomBar),
    macroWhoosh: F(CUE.typeEnd - 6),
    click: F(CUE.click),
    flood: F(CUE.redFill - 2),
    straighten: F(CUE.straighten),
    toast: F(CUE.toast),
    cardMorph: F(feat),
    f1Lift: F(feat + F1 + 30),
    f1Land: F(feat + F1 + 76),
    f1Checks: [0, 1, 2, 3].map((i) => F(feat + F1 + 48 + i * 6 + 4)),
    drum2: F(CUE.feat2 - 10),
    drum3: F(CUE.feat3 - 10),
    f2Invite: F(feat + F2 + 16),
    f2Bounce: F(feat + F2 + 44),
    f2Reply: F(feat + F2 + 58),
    f3Late: F(feat + F3 + 26),
    f3Shift: F(feat + F3 + 34),
    backToWeek: F(feat + ACT.feat.dur - 34),
    pullBack: F(endFrom + 4),
    wordsIn: F(CUE.fits - 22),
    fitsSnap: F(CUE.fits),
    markSnap2A: F(endFrom + asm + 10 + 16),
    markSnap2B: F(endFrom + asm + 16 + 16),
    lockup2: F(CUE.url - 16),
    finalBlink: F(CUE.final),
  },
};
mkdirSync('out', { recursive: true });
writeFileSync('out/cues.json', JSON.stringify(cues, null, 1));
console.log('wrote out/cues.json', Object.keys(cues.sfx).length, 'sfx cues,', cues.rain.length, 'rain,', cues.keys.length, 'keys,', cues.landings.length, 'landings');
