import { Easing, interpolate, spring, SpringConfig } from 'remotion';

export const FPS = 60;
export const BPM = 120;
export const BEAT = (60 / BPM) * FPS; // 30 frames
export const BAR = BEAT * 4; // 120 frames
export const sec = (s: number) => Math.round(s * FPS);
export const beats = (b: number) => Math.round(b * BEAT);

// Easing library (named after how they feel, not the math)
export const E = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // expo-out: arrivals, reveals
  outSoft: Easing.bezier(0.22, 1, 0.36, 1), // quint-out: gentle settles
  in: Easing.bezier(0.7, 0, 0.84, 0), // expo-in: departures, implosions
  inOut: Easing.bezier(0.87, 0, 0.13, 1), // expo-in-out: camera whips
  smooth: Easing.bezier(0.65, 0, 0.35, 1), // cubic-in-out: drifts
  swift: Easing.bezier(0.4, 0, 0.2, 1), // material standard: UI
  cam: Easing.bezier(0.48, 0.1, 0.0, 0.9), // house camera curve: slow start, early peak, long settle
  glide: Easing.bezier(0.47, 0.2, 0.15, 1), // short snappy moves with a soft landing
  linear: (t: number) => t,
};

type Ease = (t: number) => number;

/** Clamped tween between two frames. */
export const tw = (
  frame: number,
  from: number,
  to: number,
  a: number,
  b: number,
  ease: Ease = E.out,
) =>
  interpolate(frame, [from, to], [a, b], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** 0..1 progress between two frames. */
export const prog = (frame: number, from: number, to: number, ease: Ease = E.out) =>
  tw(frame, from, to, 0, 1, ease);

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;


export const SPR: Record<string, Partial<SpringConfig>> = {
  snap: { damping: 18, stiffness: 260, mass: 0.7 }, // locks into place w/ a small overshoot
  pop: { damping: 11, stiffness: 180, mass: 0.6 }, // playful overshoot
  soft: { damping: 26, stiffness: 120, mass: 1 }, // no overshoot, weighty
  heavy: { damping: 30, stiffness: 90, mass: 1.4 },
};

export const spr = (frame: number, start: number, cfg: Partial<SpringConfig> = SPR.snap, fps = FPS) =>
  spring({ frame: frame - start, fps, config: cfg });

/** Deterministic pseudo-random in [0,1) from an integer/string seed. */
export const rand = (seed: number | string) => {
  let h = typeof seed === 'number' ? seed * 2654435761 : 0;
  if (typeof seed === 'string') for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
