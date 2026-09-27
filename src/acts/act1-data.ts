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
};

// accelerating schedule: t in [0,1] → frame; gaps shrink toward the implosion (a drum roll)
const schedule = (k: number) => {
  const t = k / (RAIN_N - 1);
  const eased = Math.pow(t, 0.58);
  return Math.round(CUE.rainStart + eased * (CUE.implodeStart - 2 - CUE.rainStart));
};

// Blocks crowd the hours around "now", and the later ones land on top of slots that are already
// taken, so the week visibly piles up (overlapping, askew) before the headline says so.
export const RAIN: RainBlock[] = [];
for (let i = 0; i < RAIN_N; i++) {
  const r = (n: number) => rand(`rain-${i}-${n}`);
  const onTop = i > 22 && r(9) < 0.7 ? RAIN[Math.floor(r(10) * i)] : undefined;
  const day = onTop ? onTop.day : Math.floor(r(1) * 7);
  const start = onTop ? onTop.start + (r(11) < 0.5 ? 0 : 0.5) : 7 + Math.floor(r(2) * 11) * 0.5; // 07:00 .. 12:00
  RAIN.push({
    i,
    title: TITLES[Math.floor(r(4) * TITLES.length)],
    day,
    start,
    dur: [0.5, 0.75, 1, 1, 1.5][Math.floor(r(3) * 5)],
    land: schedule(i),
    ink: r(5) < 0.16,
    outline: r(6) < 0.12,
    jx: (r(7) - 0.5) * 70,
    rot: (r(8) - 0.5) * 16,
  });
}
