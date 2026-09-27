import { rand } from '../lib/anim';
import { CUE } from '../timeline';

// The opening "rain" of meetings. Landing frames accelerate like a drum roll,
// so the soundtrack can place one tick per landing (exported with the cues).

const TITLES = [
  'Sync', 'Standup', '1:1', 'Review', 'Planning', 'Interview', 'Roadmap', 'Check-in',
  'Budget', 'Retro', 'Kickoff', 'Hiring panel', 'Customer call', 'All-hands', 'Design crit',
  'QBR prep', 'Vendor call', 'Offsite', 'Onboarding', 'Pricing', 'Demo', 'Board prep',
  'Quick chat', 'Follow-up', 'Metrics', 'Handoff', 'Launch sync', 'Catch-up',
];

export const RAIN_N = 46;
export const ACT1 = {
  colW: 1920 / 7,
  hourH: 120,
  nowY: 540,
  now: 10.4,
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

// accelerating schedule: t in [0,1] → frame, dense toward the end
const schedule = (k: number) => {
  const t = k / (RAIN_N - 1);
  const eased = 1 - Math.pow(1 - t, 0.55);
  return Math.round(CUE.rainStart + eased * (CUE.implodeStart - 8 - CUE.rainStart));
};

export const RAIN: RainBlock[] = Array.from({ length: RAIN_N }, (_, i) => {
  const r = (n: number) => rand(`rain-${i}-${n}`);
  const day = Math.floor(r(1) * 7);
  const start = 6.5 + Math.floor(r(2) * 16) * 0.5; // 06:30 .. 14:00
  const dur = [0.5, 0.75, 1, 1, 1.5][Math.floor(r(3) * 5)];
  return {
    i,
    title: TITLES[Math.floor(r(4) * TITLES.length)],
    day,
    start,
    dur,
    land: schedule(i),
    ink: r(5) < 0.08,
    outline: r(6) < 0.14,
    jx: (r(7) - 0.5) * 70,
    rot: (r(8) - 0.5) * 16,
  };
});
