import React from 'react';
import { AbsoluteFill, Easing, spring, SpringConfig, useCurrentFrame } from 'remotion';
import { C, FONT } from '../brand/tokens';
import { E, FPS, mix, prog, spr, SPR } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, CalendarApp, COL, EvStyle, evRect, GRID, HOUR, ICON } from '../app/CalendarApp';
import { AFTER, Ev, FINAL, fmt, H0, NOW } from '../app/data';
import { APP_VIEW } from './Act2Mark';

// ACT 5 — the app opens on its spine. The sidebar widens into a mist type column while the week
// swings open toward the lens on a vertical hinge at that seam and dives full-bleed. A reel of
// lines clicks one statement home per bar; every payoff lands on the eye line (y540) on the clap,
// its consequence on the kick. At the end the week swings shut, the column narrows back onto the
// real sidebar, and the frame lands exactly on Act 6's first frame.

const L = (abs: number) => abs - ACT.feat.from;
const F1 = L(CUE.feat1); // 0
const F2 = L(CUE.feat2); // 120
const F3 = L(CUE.feat3); // 240
const END = ACT.feat.dur; // 360 (= Act 6 f0)
const LAST = END - 1; // the close lands here, so the act's last frame is exactly Act 6's first

export const A5 = {
  SPLIT: Easing.bezier(0.33, 0, 0.1, 1),
  WHIP: Easing.bezier(0.6, 0, 0.15, 1),
  APPROACH: Easing.bezier(0.45, 0, 0.9, 0.55),
  CLOSE: Easing.bezier(0.55, 0, 0.15, 1),
  DETENT: { damping: 24, stiffness: 380, mass: 0.6 },
  CHECK: { damping: 12, stiffness: 220, mass: 0.5 },
  CLOSE_AT: 326,
  YAW: -12,
  PERSP: 2400,
};

const STACKS = [
  ['Moves', 'meetings.'],
  ['Guards', 'your focus.'],
  ['Replans', 'in real time.'],
];
export const LINES = STACKS.map((s) => s.join(' '));

// beat sheet (act-local frames; kick on 0 and +75, clap on +60 of each bar)
const DETENT_AT = [F1 + 20, F2 - 10, F3 - 10, END - 40]; // reel springs: land 30 / 120 / 240 / 330
const CHECK_AT = [F1 + 67, F1 + 75, F1 + 82, F1 + 90]; // attendee checks: hit 75 / 83 / 90 / 98
const LATE_AT = F3 + 52; // "+30 min" spring: hits the clap (300)

// ---- sync points for the soundtrack ------------------------------------------------------------
type Ease = (t: number) => number;
const peakOf = (a: number, b: number, ease: Ease) => {
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
const hitOf = (start: number, cfg: Partial<SpringConfig>) => {
  for (let f = 0; f < 120; f++) if (spring({ frame: f, fps: FPS, config: cfg }) >= 1) return start + f;
  return start + 30;
};
/** Act-local frames the sound design locks to. */
export const FEAT_CUES = {
  split: peakOf(0, 42, A5.SPLIT), // velocity peak of the split (on the kick)
  whipAB: peakOf(F2 - 16, F2 + 12, A5.WHIP),
  whipBC: peakOf(F3 - 16, F3 + 12, A5.WHIP),
  detentStarts: DETENT_AT, // the reel starts to roll
  ratchet: DETENT_AT.map((t) => t + 4), // first ratchet tick of each roll (ticks every 3 frames into the detent)
  detents: DETENT_AT.map((t) => hitOf(t, A5.DETENT)), // the reel clicks home
  f1Lift: F1 + 30,
  f1Land: F1 + 60, // Roadmap lands on Fri 15:00 (clap)
  f1Checks: CHECK_AT.map((t) => hitOf(t, A5.CHECK)),
  inviteIn: F2 + 20, // invite card starts its fall
  invite: F2 + 56, // fall whoosh crest, just before contact
  f2Bounce: F2 + 60, // invite contacts Deep work (clap)
  f2Reply: F2 + 75, // pill flips to "Moved to Fri 13:30" (kick)
  inviteExit: peakOf(F2 + 90, F2 + 108, E.in),
  f3Late: hitOf(LATE_AT, A5.CHECK), // "+30 min" (clap)
  f3LateSettle: F3 + 68, // review end settles at 14:30
  f3ShiftSettle: F3 + 75, // the chain lands (kick)
  close: peakOf(A5.CLOSE_AT, LAST, A5.CLOSE),
};

// ---- geometry ----------------------------------------------------------------------------------
type Box = { x: number; y: number; w: number; h: number };
const FULL: Box = { x: APP_VIEW.x, y: APP_VIEW.y, w: APP.W * APP_VIEW.s, h: APP.H * APP_VIEW.s };
const FRAME: Box = { x: 0, y: 0, w: 1920, h: 1080 };
const lerpB = (a: Box, b: Box, t: number): Box => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

const TILE_W = 756; // the type column; the week gets the rest of the frame
const EYE = 540; // eye line: the anchor row, level with the type
const K = (1920 - TILE_W) / (2 * COL); // 2.3775: two day columns fill the frame right of the column
const SIDE_X = APP_VIEW.x + APP.side * APP_VIEW.s; // the real sidebar border on screen at APP_VIEW
const ay = (h: number) => GRID.y + (h - H0) * HOUR;
const ZOOM = K * 1.04; // layout scale of the app between the split and the close (see Z below)
type Shot = { x0: number; yc: number };
const SHOT: Record<'A' | 'B' | 'C', Shot> = {
  A: { x0: GRID.x + 3 * COL, yc: 15.0 }, // Thu day line on the seam; 12:00-17:59
  B: { x0: APP.side, yc: 10.757 }, // gutter docked on the seam; frame top = day header
  C: { x0: APP.side, yc: 14.6 },
};

// camera (anchor model): app point (ax, ay) sits at screen (sx, sy), scale k, hinge through it
type Cam = { ax: number; ay: number; sx: number; sy: number; k: number };
const shot = (s: Shot): Cam => ({ ax: s.x0, ay: ay(s.yc), sx: TILE_W, sy: EYE, k: K });
const full = (s: Shot): Cam => ({ ax: APP.side, ay: ay(s.yc), sx: SIDE_X, sy: APP_VIEW.y + ay(s.yc) * APP_VIEW.s, k: APP_VIEW.s });
const lc = (a: Cam, b: Cam, t: number): Cam => ({
  ax: mix(a.ax, b.ax, t),
  ay: mix(a.ay, b.ay, t),
  sx: mix(a.sx, b.sx, t),
  sy: mix(a.sy, b.sy, t),
  k: Math.exp(mix(Math.log(a.k), Math.log(b.k), t)),
});

// ---- story state as functions of time (evaluated at f for motion, at round(f) for labels) -------
const r5 = (h: number) => Math.round(h * 12) / 12; // labels roll in 5-minute steps
const nowAt = (t: number) =>
  t < F3 + 12
    ? mix(NOW, 13.6, prog(t, F3 - 16, F3 + 12, A5.WHIP)) // the clock races with the descent
    : 13.6 + 0.7 * (1 - (1 - clamp01((t - F3 - 12) / (END - F3 - 12))) ** 2); // then eases to 14:18 (Act 6's clock)
const roadMove = (t: number) => prog(t, F1 + 36, F1 + 60, E.smooth);
const designEnd = (t: number) => mix(Math.max(14, nowAt(t) + 0.02), 14.5, prog(t, F3 + 60, F3 + 72, E.glide));
const chainShift = (t: number) => prog(t, F3 + 62, F3 + 75, E.glide);
const CHAIN = ['mo-maya', 'mo-road', 'mo-metric', 'mo-int'];
/** EventBlock switches layout at 40 / 26 px tall: decide that per whole frame so sub-samples agree. */
const keepLayout = (h: number, hd: number) => {
  for (const th of [40, 26]) {
    if (hd < th && h >= th) h = th - 0.01;
    else if (hd >= th && h < th) h = th;
  }
  return h;
};

// --------------------------------------------------------------------------------------------------
const Avatar: React.FC<{ i: string; check: number; x: number; z: number }> = ({ i, check, x, z }) => (
  <div style={{ position: 'absolute', left: x, top: 0, width: 26, height: 26, zIndex: z }}>
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        background: '#E4E5E9',
        border: '2px solid #F0F1F3',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT.sans,
        fontSize: 9.5,
        fontWeight: 650,
        color: C.mute2,
      }}
    >
      {i}
    </div>
    <div
      style={{
        position: 'absolute',
        right: -3,
        bottom: -3,
        width: 13,
        height: 13,
        borderRadius: 7,
        background: C.ink,
        border: '1.5px solid #F0F1F3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${Math.max(0, check)})`,
        zIndex: 20,
      }}
    >
      <svg width={8} height={8} viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON.check} />
      </svg>
    </div>
  </div>
);

/** The calendar's now pill, drawn here so its text follows the whole frame and its position the exact time. */
const NowPill: React.FC<{ now: number; label: string }> = ({ now, label }) => (
  <div
    style={{
      position: 'absolute',
      left: APP.side + 10,
      top: GRID.y + (now - H0) * HOUR - 10,
      background: C.red,
      color: '#fff',
      fontFamily: FONT.sans,
      fontVariantNumeric: 'tabular-nums',
      fontSize: 11.5,
      fontWeight: 600,
      borderRadius: 6,
      padding: '3px 6px',
      opacity: 1,
      transform: 'translateX(0px)',
    }}
  >
    {label}
  </div>
);

type Styled = { ev: Ev; s: EvStyle; key?: string; extra?: React.ReactNode };

export const Act5Features: React.FC = () => {
  const f = useCurrentFrame();
  // discrete UI state (rolling labels, the clock, text swaps) is decided per whole frame, so every
  // motion-blur sub-sample of a frame agrees; continuous motion stays on f
  const fd = Math.round(f);

  // ---- camera ------------------------------------------------------------------------------------
  const split = prog(f, 0, 42, A5.SPLIT);
  const wAB = prog(f, F2 - 16, F2 + 12, A5.WHIP);
  const wBC = prog(f, F3 - 16, F3 + 12, A5.WHIP);
  const close = prog(f, A5.CLOSE_AT, LAST, A5.CLOSE);
  const cam = lc(lc(lc(lc(full(SHOT.A), shot(SHOT.A), split), shot(SHOT.B), wAB), shot(SHOT.C), wBC), full(SHOT.C), close);
  const dip = 1 - 0.18 * Math.sin(Math.PI * wAB) ** 2; // zoom-out hop on the first whip
  const breath =
    1 +
    0.025 *
      (prog(f, 42, F2 - 16, E.smooth) * (1 - wAB) +
        prog(f, F2 + 12, F3 - 16, E.smooth) * (1 - wBC) +
        prog(f, F3 + 12, A5.CLOSE_AT, E.smooth) * (1 - close));
  const bump = (at: number) => (f >= at && f < at + 12 ? Math.sin(((f - at) / 12) * Math.PI) : 0);
  const punch = 1 + 0.012 * (bump(F1 + 60) + bump(F2 + 60) + bump(F3 + 60));
  const k = cam.k * dip * breath * punch;
  const yaw = A5.YAW * split * (1 - close);
  // Chromium rasters layers under perspective at a capped, rounded scale (large layers at 1x), so the
  // app is laid out at shot scale with CSS zoom and the camera scales by k / Z (z by 1 / Z): same
  // geometry, native-resolution text. Z switches on the split / close velocity peaks, whole frames.
  const Z = fd >= FEAT_CUES.split && fd < FEAT_CUES.close ? ZOOM : 1;

  // ---- window + column ---------------------------------------------------------------------------
  const win = lerpB(lerpB(FULL, FRAME, split), FULL, close);
  const on = split * (1 - close);
  const rad = APP.R * APP_VIEW.s * (1 - on);
  const bgO = 1 - prog(f, 0, 36, E.smooth);
  const tileA = prog(f, 0, 10, E.linear) * (1 - prog(f, 348, LAST, E.smooth));
  const isFrame = win.x <= 0 && win.y <= 0 && win.w >= 1920 && win.h >= 1080;
  const ins = (v: number) => `${Math.max(0, v).toFixed(3)}px`;
  const clip = `inset(${ins(win.y)} ${ins(1920 - win.x - win.w)} ${ins(1080 - win.y - win.h)} ${ins(win.x)} round ${ins(rad)})`;

  // ---- reel ----------------------------------------------------------------------------------------
  const reel = -1 + DETENT_AT.reduce((a, t) => a + spr(f, t, A5.DETENT), 0);
  const A_REST = 0.5 * 0.2211;
  const rows = STACKS.flatMap((st, i) =>
    st.map((txt, j) => {
      const v = 4 * i + j - 4 * reel - 0.5;
      if (Math.abs(v) > 4.8) return null;
      const a = Math.max(-1.45, Math.min(1.45, v * 0.2211));
      const cy = 220 + 500 * Math.sin(a);
      if (cy < -70 || cy > 510) return null;
      return (
        <div
          key={txt}
          style={{
            position: 'absolute',
            left: 96,
            top: 0,
            height: 120,
            lineHeight: '120px',
            fontFamily: FONT.sans,
            fontSize: 120,
            fontWeight: 600,
            letterSpacing: '-0.05em',
            color: C.ink,
            whiteSpace: 'nowrap',
            transformOrigin: '0 50%',
            transform: `translateY(${cy - 60}px) scaleY(${Math.cos(a) / Math.cos(A_REST)})`,
          }}
        >
          {txt}
        </div>
      );
    }),
  );

  // ---- events --------------------------------------------------------------------------------------
  const ev = (id: string) => AFTER.find((e) => e.id === id)!;
  const styled: Styled[] = [];
  let design: Styled | undefined;
  for (const e of AFTER) {
    const r = evRect(e);
    if (e.id === 'th-road') {
      // F1: Roadmap lifts off Thu 14:00, arcs to Fri 15:00 and lands on the eye line on the clap
      const lift1 = prog(f, F1 + 30, F1 + 40, E.out);
      const move1 = roadMove(f);
      const land1 = prog(f, F1 + 52, F1 + 60, E.in);
      const target = evRect({ ...e, day: 4, start: 15, end: 16 });
      const bounce = f > F1 + 60 ? Math.exp(-(f - F1 - 60) / 4) * Math.sin((f - F1 - 60) / 1.6) * 0.035 : 0;
      const st = r5(mix(14, 15, roadMove(fd)));
      const avO = prog(f, F1 + 20, F1 + 30) * (1 - prog(f, F2 - 16, F2 - 4));
      const checks = CHECK_AT.map((t) => spr(f, t, A5.CHECK));
      styled.push({
        ev: { ...e, start: st, end: st + 1 },
        s: {
          rect: lerpB(r, target, move1),
          z: (90 * lift1 + 60 * Math.sin(Math.PI * move1)) * (1 - land1),
          scale: (1 + 0.04 * lift1 * (1 - land1)) * (1 - bounce),
          rot: -2.5 * lift1 * (1 - land1),
          ring: prog(f, F1 + 58, F1 + 62) * (1 - prog(f, F1 + 74, F1 + 96, E.smooth)),
        },
        // attendees ride inside the block (bottom-left: the hinge crops Fri's right edge)
        extra:
          avO > 0 ? (
            <div style={{ position: 'absolute', left: 11, bottom: 6, width: 92, height: 26, opacity: avO }}>
              {['MR', 'JL', 'PS', 'AK'].map((a, i) => (
                <Avatar key={a} i={a} check={checks[i]} x={i * 22} z={10 - i} />
              ))}
            </div>
          ) : undefined,
      });
    } else if (e.id === 'mo-focus') {
      // F2: the invite hits Deep work on the clap; the block pulses and shows its lock
      const pulse = f >= F2 + 60 && f < F3 ? 1 + 0.015 * Math.exp(-(f - F2 - 60) / 5) : 1;
      const chipO = prog(f, F2 + 60, F2 + 66) * (1 - prog(f, F2 + 108, F3));
      styled.push({
        ev: e,
        s: { rect: r, ...(pulse !== 1 ? { scale: pulse } : {}) },
        extra:
          chipO > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: 11,
                bottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 9px 4px 7px',
                borderRadius: 7,
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 560,
                opacity: chipO,
                transformOrigin: '0 100%',
                transform: `scale(${mix(0.6, 1, spr(f, F2 + 60, SPR.pop))})`,
              }}
            >
              <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x={3.5} y={7} width={9} height={7} rx={1.6} />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
              Protected
            </div>
          ) : undefined,
      });
    } else if (e.id === 'mo-design') {
      // F3: the review runs over; its end rides the now line, then settles at 14:30 on the clap
      const end = designEnd(f);
      const lateS = spr(f, LATE_AT, A5.CHECK);
      const pillO = Math.min(1, lateS) * (1 - prog(f, 336, 352));
      const rect = evRect({ ...e, start: 13, end });
      rect.h = keepLayout(rect.h, evRect({ ...e, start: 13, end: designEnd(fd) }).h);
      design = {
        ev: { ...e, start: 13, end: r5(designEnd(fd)) },
        s: { rect, glow: prog(f, F3 + 47, F3 + 53) * (1 - prog(f, F3 + 78, F3 + 96)) },
        extra:
          pillO > 0 ? (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                padding: '3px 8px',
                borderRadius: 6,
                background: C.red,
                color: '#fff',
                fontFamily: FONT.sans,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 11.5,
                fontWeight: 600,
                opacity: pillO,
                transformOrigin: '100% 0',
                transform: `scale(${mix(0.8, 1, lateS)})`,
              }}
            >
              +30 min
            </div>
          ) : undefined,
      };
    } else if (CHAIN.includes(e.id)) {
      // ...and the rest of Monday is shoved down as one chain, landing on the kick
      const fin = FINAL.find((x) => x.id === e.id)!;
      const at = (t: number) => ({ start: mix(e.start, fin.start, chainShift(t)), end: mix(e.end, fin.end, chainShift(t)) });
      const a = at(f);
      const ad = at(fd);
      const rect = evRect({ ...e, ...a });
      rect.h = keepLayout(rect.h, evRect({ ...e, ...ad }).h);
      styled.push({
        ev: { ...e, start: r5(ad.start), end: r5(ad.end) },
        s: { rect, ring: prog(f, F3 + 73, F3 + 77) * (1 - prog(f, F3 + 82, F3 + 100, E.smooth)) },
      });
    } else styled.push({ ev: e, s: { rect: r } });
  }
  // the overrunning review draws over 1:1 · Maya so the clash reads
  if (design) styled.push(design);
  const events = [...styled].sort((a, b) => (a.s.z ?? 0) - (b.s.z ?? 0));

  // ---- F2 invite: falls in Z from near the lens onto Deep work, bounces, is rebooked ---------------
  const FOC = evRect(ev('mo-focus'));
  const REST = { x: FOC.x + FOC.w - 150, y: FOC.y + 54 };
  const tIn = prog(f, F2 + 20, F2 + 60, E.linear);
  const xy = prog(f, F2 + 20, F2 + 60, E.swift);
  const away = prog(f, F2 + 90, F2 + 108, E.in);
  const hitT = f - F2 - 60;
  const invX = REST.x + 260 * (1 - xy) + 320 * away;
  const invY = REST.y + 240 * (1 - xy) + 180 * away;
  const invZ =
    (hitT < 0 ? mix(560, 30, A5.APPROACH(tIn)) : 30 + 110 * Math.exp(-hitT / 7) * Math.abs(Math.sin(hitT / 3.3))) + 500 * away;
  const invRot = hitT >= 0 ? 3.5 * Math.exp(-hitT / 7) * Math.sin(hitT / 2.2) : 0;
  const invO = prog(f, F2 + 16, F2 + 24) * (1 - prog(f, F2 + 100, F2 + 110));
  const replied = fd >= F2 + 75; // flips on the kick
  const zs = Math.min(1, invZ / 300);

  // ---- F3 clock ----------------------------------------------------------------------------------------
  const nowT = nowAt(f);

  const overlay = (
    <>
      <div style={{ position: 'absolute', left: GRID.x, top: GRID.y, width: GRID.w, height: GRID.h, pointerEvents: 'none', transformStyle: 'preserve-3d' }}>
        {invO > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 200,
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 12,
              background: '#fff',
              boxShadow: `0 0 0 1px rgba(11,11,12,0.06), 0 ${4 + 0.06 * invZ}px ${12 + 0.1 * invZ}px rgba(11,11,12,${0.1 + 0.08 * zs})`,
              fontFamily: FONT.sans,
              opacity: invO,
              transform: `translate3d(${invX}px, ${invY}px, ${invZ}px) rotate(${invRot}deg)`,
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>Quick sync?</div>
            <div style={{ fontFamily: FONT.sans, fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 460, color: C.mute, marginTop: 3 }}>Leo · Mon 10:30</div>
            <div
              style={{
                marginTop: 10,
                height: 26,
                borderRadius: 7,
                background: replied ? C.ink : '#F1F2F4',
                color: replied ? '#fff' : C.mute2,
                fontSize: 11.5,
                fontWeight: 560,
                display: 'flex',
                alignItems: 'center',
                padding: '0 9px',
                gap: 6,
              }}
            >
              {replied ? (
                <>
                  <svg width={10} height={10} viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICON.check} />
                  </svg>
                  Moved to Fri 13:30
                </>
              ) : (
                'Invite pending'
              )}
            </div>
          </div>
        )}
      </div>
      <NowPill now={nowT} label={fmt(nowAt(fd))} />
    </>
  );

  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      {/* Act 4's backdrop, fading out as the window opens to full bleed */}
      {bgO > 0 && (
        <>
          <AbsoluteFill style={{ background: '#E7E8EC', opacity: bgO }} />
          <AbsoluteFill style={{ background: 'radial-gradient(ellipse 65% 60% at 50% 40%, #F7F8FA, rgba(247,248,250,0) 75%)', opacity: bgO }} />
        </>
      )}
      {/* window shadow (the app's own, at APP_VIEW scale) */}
      {on < 1 && (
        <div
          style={{
            position: 'absolute',
            left: win.x,
            top: win.y,
            width: win.w,
            height: win.h,
            borderRadius: rad,
            boxShadow: [
              `0 0 0 ${APP_VIEW.s}px rgba(11,11,12,${0.06 * (1 - on)})`,
              `0 ${40 * APP_VIEW.s}px ${80 * APP_VIEW.s}px ${-20 * APP_VIEW.s}px rgba(11,11,12,${0.18 * (1 - on)})`,
              `0 ${12 * APP_VIEW.s}px ${30 * APP_VIEW.s}px ${-10 * APP_VIEW.s}px rgba(11,11,12,${0.1 * (1 - on)})`,
            ].join(', '),
          }}
        />
      )}
      {/* the window: a full-frame layer clipped to the window rect (anti-aliased, sub-pixel) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, background: '#fff', clipPath: isFrame ? undefined : clip }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: APP.W,
            height: APP.H,
            // all translation lives in the matrix, so slow moves never snap to pixels
            transformOrigin: '0 0',
            transform: `translate(${cam.sx}px, ${cam.sy}px) perspective(${A5.PERSP}px) rotateY(${yaw}deg) ${
              Z === 1 ? `scale(${k})` : `scale3d(${k / Z}, ${k / Z}, ${1 / Z})`
            } translate(${-cam.ax * Z}px, ${-cam.ay * Z}px)`,
            // from the close's velocity peak everything is coplanar again: render flat, the way Act 6 does
            transformStyle: fd >= FEAT_CUES.close ? 'flat' : 'preserve-3d',
          }}
        >
          <div style={{ zoom: Z, width: APP.W, height: APP.H, transformStyle: 'preserve-3d' }}>
          <CalendarApp
            events={events}
            overlay={overlay}
            shadow={false}
            clashes={12}
            clashO={1}
            resolved={1}
            status={1}
            prioIn={[1, 1, 1]}
            nowO={1}
            labelO={0}
            now={nowT}
          />
          </div>
        </div>
        {/* the mist column: starts as a veil exactly over the real sidebar, ends there too */}
        {tileA > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: Math.max(0, cam.sx),
              height: 1080,
              boxSizing: 'border-box',
              overflow: 'hidden',
              background: `rgba(244,245,247,${tileA})`,
              borderRight: `2px solid rgba(227,228,232,${tileA})`,
              boxShadow: `6px 0 22px -10px rgba(11,11,12,${0.08 * tileA})`,
            }}
          >
            {rows.some(Boolean) && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: EYE - 220,
                  width: TILE_W,
                  height: 440,
                  overflow: 'hidden',
                  maskImage: 'linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%)',
                }}
              >
                {rows}
              </div>
            )}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
