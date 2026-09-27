import { ACT, TOTAL } from './timeline';

// Temporal motion blur, the way a film camera does it: inside the windows below (act-local frames,
// where things move fast) a frame is the average of `samples` renders spread across the shutter,
// centred on the frame's time. Everything else renders once.
//
// The averaging happens outside the browser (scripts/accumulate.py, in floating point, quantized
// once). Compositing the samples in Chromium quantizes every layer to 8 bits, which turns smooth
// gradients into contour rings, tints light greys and darkens the frame a little per sample.

export const SHUTTER = 240; // degrees
export const DEFAULT_SAMPLES = 10;

type Win = [number, number] | [number, number, number]; // [from, to, samples?]
export const WINDOWS: Record<keyof typeof ACT, Win[]> = {
  fit: [[150, 329, 8], [330, 359]],
  mark: [[0, 36], [176, 240]],
  prompt: [[30, 86], [176, 239]],
  plan: [[0, 26, 16], [27, 160, 16], [161, 239]],
  feat: [[0, 44], [106, 136], [226, 256], [324, 359]],
  end: [[0, 150], [214, 242], [300, 380]],
};

const ACTS = Object.entries(ACT) as [keyof typeof ACT, { from: number; dur: number }][];

/** Sub-frame times that make up output frame f (never crossing into another act). */
export const samplesAt = (f: number): number[] => {
  const [id, a] = ACTS.find(([, x]) => f >= x.from && f < x.from + x.dur)!;
  const local = f - a.from;
  const w = WINDOWS[id].find(([p, q]) => local >= p && local <= q);
  if (!w) return [f];
  const n = w[2] ?? DEFAULT_SAMPLES;
  const span = SHUTTER / 360;
  const lo = a.from;
  const hi = a.from + a.dur - 1e-3;
  return Array.from({ length: n }, (_, i) => Math.min(hi, Math.max(lo, f + span * ((i + 0.5) / n - 0.5))));
};

/** Every sub-frame the blurred render needs, in order: output frame f and the time t to draw. */
export const SUBFRAMES: { f: number; t: number }[] = (() => {
  const out: { f: number; t: number }[] = [];
  for (let f = 0; f < TOTAL; f++) for (const t of samplesAt(f)) out.push({ f, t });
  return out;
})();
