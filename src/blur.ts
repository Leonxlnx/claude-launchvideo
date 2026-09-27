import { ACT, TOTAL } from './timeline';

// Temporal motion blur, the way a film camera does it: a frame is the average of n renders spread
// across the shutter, centred on the frame's time. n comes from how fast things move on screen in
// that frame (scripts/measure-speed.py, optical flow on the sharp render), so fast moves smear
// instead of stamping copies and still frames render once.
//
// The averaging happens outside the browser (scripts/accumulate.py, in floating point, quantized
// once). Compositing the samples in Chromium quantizes every layer to 8 bits, which turns smooth
// gradients into contour rings, tints light greys and darkens the frame a little per sample.

export const SHUTTER = 240; // degrees (scripts/measure-speed.py assumes the same)

const ACTS = Object.values(ACT);

/** The n sub-frame times that make up output frame f (never crossing into another act). */
export const sampleTimes = (f: number, n: number): number[] => {
  if (n <= 1) return [f];
  const a = ACTS.find((x) => f >= x.from && f < x.from + x.dur)!;
  const span = SHUTTER / 360;
  const lo = a.from;
  const hi = a.from + a.dur - 1e-3;
  return Array.from({ length: n }, (_, i) => Math.min(hi, Math.max(lo, f + span * ((i + 0.5) / n - 0.5))));
};

export type SubFrame = { f: number; t: number };

/** Every sub-frame of the blurred master, in order, for per-frame sample counts `groups`. */
export const subframes = (groups: number[]): SubFrame[] => {
  const out: SubFrame[] = [];
  for (let f = 0; f < TOTAL; f++) for (const t of sampleTimes(f, groups[f] ?? 1)) out.push({ f, t });
  return out;
};
