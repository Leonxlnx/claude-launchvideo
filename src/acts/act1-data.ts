import { rand } from '../lib/anim';
import { CUE } from '../timeline';
import { NOW } from '../app/data';

// The opening "rain" of meetings. Landing frames accelerate like a drum roll,
// so the soundtrack can place one tick per landing (exported with the cues).

const TITLES = [
  'Sync', 'Standup', '1:1', 'Review', 'Planning', 'Interview', 'Roadmap', 'Check-in',
  'Budget', 'Retro', 'Kickoff', 'Hiring panel', 'Customer call', 'All-hands', 'Design crit',
  'QBR prep', 'Vendor call', 'Offsite', 'Onboarding', 'Pricing', 'Demo', 'Board prep',
  'Quick chat', 'Follow-up', 'Metrics', 'Handoff', 'Launch sync', 'Catch-up',
];

export const RAIN_N = 60;
export const ACT1 = {
  colW: 1920 / 7,
  hourH: 120,
  nowY: 540,
  now: NOW,
};

/** px a piled block sits above the one it landed on, per level of the pile */
export const STACK_LIFT = 12;
/** "Your week" (world px): no block may come to rest under it, so no card is ever hidden by the type */
export const HEADLINE_BOX = { x0: 600, x1: 1320, y0: 280, y1: 470 };

export type RainBlock = {
  i: number;
  title: string;
  day: number;
  start: number;
  dur: number;
  land: number; // frame it lands
  ink: boolean;
  outline: boolean;
  jx: number; // horizontal jitter px
  rot: number; // deg, while falling
  depth: number; // 0 = on the grid, n = n blocks deep in a pile
};

/** resting box of a block in world px (before rotation) */
export const restBox = (b: Pick<RainBlock, 'day' | 'start' | 'dur' | 'jx' | 'depth'>) => {
  const x = b.day * ACT1.colW + 6 + b.jx * 0.6;
  const y = ACT1.nowY + (b.start - ACT1.now) * ACT1.hourH - STACK_LIFT * b.depth;
  return { x, y, w: ACT1.colW - 12, h: b.dur * ACT1.hourH - 6 };
};

// accelerating schedule: t in [0,1] → frame; gaps shrink toward the implosion (a drum roll)
const schedule = (k: number) => {
  const t = k / (RAIN_N - 1);
  const eased = Math.pow(t, 0.8);
  return Math.round(CUE.rainStart + eased * (CUE.implodeStart - 2 - CUE.rainStart));
};

const HEAD_MARGIN = 12; // piled blocks sit askew: keep their corners clear of the type too
const underHeadline = (b: Parameters<typeof restBox>[0]) => {
  const r = restBox(b);
  const H = HEADLINE_BOX;
  return r.x < H.x1 + HEAD_MARGIN && r.x + r.w > H.x0 - HEAD_MARGIN && r.y < H.y1 + HEAD_MARGIN && r.y + r.h > H.y0 - HEAD_MARGIN;
};

// Blocks fill the whole visible day, and from early on the later ones land on top of slots that
// are already taken, so the week visibly piles up (overlapping, askew) before the headline says so.
// Fresh slots are dealt out evenly over the visible week: a shuffled cycle of the seven days runs
// against a shuffled cycle of four bands of the morning, so every seven fresh blocks visit every
// day, every four visit every band, and every 28 visit every (day, band) cell once. Each lands at a
// random half hour inside its band (05:00..12:30), so the rain covers the whole day instead of
// clumping. A block that would come to rest under "Your week" (or below 12:30) is re-rolled
// deterministically: another pile, another start, or the next cell.
const BANDS = [
  [5, 6],
  [6.5, 8],
  [8.5, 10],
  [10.5, 12.5],
];
const shuffled = (n: number, key: string) => [...Array(n).keys()].sort((a, b) => rand(`${key}-${a}`) - rand(`${key}-${b}`));
const DAY_ORDER = shuffled(7, 'rain-day');
const BAND_ORDER = shuffled(BANDS.length, 'rain-band');
let dealt = 0;
const dealCell = () => {
  const k = dealt++;
  return { day: DAY_ORDER[k % 7], band: BANDS[BAND_ORDER[k % BANDS.length]] };
};
export const RAIN: RainBlock[] = [];
const onDay = (d: number) => RAIN.filter((x) => x.day === d).length;
const pickParent = (q: (n: number) => number) =>
  [10, 12, 13]
    .map((n) => RAIN[Math.floor(q(n) * RAIN.length)])
    .filter((x) => x.depth < 4)
    .sort((a, b) => onDay(a.day) - onDay(b.day))[0];
for (let i = 0; i < RAIN_N; i++) {
  const r = (n: number) => rand(`rain-${i}-${n}`);
  const dur = [0.5, 0.75, 1, 1, 1.5][Math.floor(r(3) * 5)];
  const jx = (r(7) - 0.5) * 70;
  let place = { day: 0, start: 5, depth: 0 };
  let cell: ReturnType<typeof dealCell> | undefined;
  for (let attempt = 0; attempt < 60; attempt++) {
    const q = (n: number) => rand(attempt ? `rain-${i}-${n}-${attempt}` : `rain-${i}-${n}`);
    // a pile grows on one of three random earlier blocks: the one on the emptiest day, so piles
    // spread over the week instead of all growing on the first few blocks
    const onTop = i > 10 && attempt < 4 && q(9) < 0.7 ? pickParent(q) : undefined;
    // a fresh block whose cell sits under the headline gets a new cell after a few tries
    if (!onTop && (cell === undefined || attempt % 6 === 5)) cell = dealCell();
    const [lo, hi] = cell ? cell.band : [5, 12.5];
    const cand = onTop
      ? { day: onTop.day, start: onTop.start + (q(11) < 0.5 ? 0 : 0.5), depth: onTop.depth + 1 }
      : { day: cell!.day, start: lo + Math.floor(q(2) * ((hi - lo) * 2 + 1)) * 0.5, depth: 0 };
    place = cand;
    if (cand.start <= 12.5 && !underHeadline({ ...cand, dur, jx })) break;
  }
  RAIN.push({
    i,
    title: TITLES[Math.floor(r(4) * TITLES.length)],
    ...place,
    dur,
    land: schedule(i),
    ink: r(5) < 0.16,
    outline: r(6) < 0.12,
    jx,
    rot: (r(8) - 0.5) * 16,
  });
}
