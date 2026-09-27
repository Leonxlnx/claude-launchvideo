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
// A block that would come to rest under "Your week" is re-rolled (deterministically) elsewhere.
export const RAIN: RainBlock[] = [];
for (let i = 0; i < RAIN_N; i++) {
  const r = (n: number) => rand(`rain-${i}-${n}`);
  const dur = [0.5, 0.75, 1, 1, 1.5][Math.floor(r(3) * 5)];
  const jx = (r(7) - 0.5) * 70;
  let place = { day: 0, start: 5, depth: 0 };
  for (let attempt = 0; attempt < 40; attempt++) {
    const q = (n: number) => rand(attempt ? `rain-${i}-${n}-${attempt}` : `rain-${i}-${n}`);
    const onTop = i > 10 && attempt < 30 && q(9) < 0.7 ? RAIN[Math.floor(q(10) * i)] : undefined;
    const cand = onTop
      ? { day: onTop.day, start: onTop.start + (q(11) < 0.5 ? 0 : 0.5), depth: onTop.depth + 1 }
      : { day: Math.floor(q(1) * 7), start: 5 + Math.floor(q(2) * 16) * 0.5, depth: 0 }; // 05:00 .. 12:30
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
