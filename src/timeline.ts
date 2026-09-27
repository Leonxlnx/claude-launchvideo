// Single source of truth for timing. 60 fps, 120 BPM → 1 beat = 30 frames, 1 bar = 120 frames.
// Picture reads these cues; the soundtrack generator reads the exported JSON (scripts/export-cues.ts).

export const FPS = 60;
export const W = 1920;
export const H = 1080;

const b = (bar: number, beat = 0, sub = 0) => Math.round(((bar - 1) * 4 + beat) * 30 + sub * 7.5);

// Acts (absolute frames)
export const ACT = {
  fit: { from: 0, dur: b(4) }, // 0.0s  "Your week doesn't fit."
  mark: { from: b(4), dur: b(6) - b(4) }, // 6.0s  mark + wordmark, fly into app
  prompt: { from: b(6), dur: b(8) - b(6) }, // 10.0s prompt + send
  plan: { from: b(8), dur: b(10) - b(8) }, // 14.0s the fitting
  feat: { from: b(10), dur: b(13) - b(10) }, // 18.0s three features
  end: { from: b(13), dur: b(17) - b(13) }, // 24.0s everything fits + lockup
};

export const TOTAL = b(17); // 32.0s

// Musical/visual cues the sound design locks to (absolute frames).
export const CUE = {
  dotIn: b(1, 1),
  lineDraw: b(1, 2),
  gridDraw: b(1, 3),
  yourWeek: b(2),
  rainStart: b(2, 1),
  doesntFit: b(3),
  implodeStart: b(3, 3),
  silence: b(3, 3, 2),
  drop1: b(4), // mark assembles
  lockup: b(4, 1, 2),
  descriptor: b(5),
  flyIn: b(5, 2),
  appSettle: b(6),
  zoomBar: b(6, 1),
  typeStart: b(6, 2),
  typeEnd: b(7, 2),
  click: b(7, 3),
  redFill: b(7, 3, 0.5),
  drop2: b(8), // the fitting
  landingsFrom: b(8, 1),
  landingsTo: b(9, 1),
  straighten: b(9, 1),
  toast: b(9, 3),
  feat1: b(10),
  feat2: b(11),
  feat3: b(12),
  pullBack: b(13),
  converge: b(14),
  everything: b(14, 2),
  fits: b(15),
  lockupEnd: b(15, 2),
  url: b(16),
  final: b(16, 3),
};
