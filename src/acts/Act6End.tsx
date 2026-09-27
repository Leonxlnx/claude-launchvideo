import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { measureTracked } from '../lib/measure';
import { RackFocus } from '../fx/RackFocus';
import { C, FONT } from '../brand/tokens';
import { MARK } from '../brand/Mark';
import { E, mix, prog, rand, spr } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, CalendarApp, COL, evRect, GRID, HOUR } from '../app/CalendarApp';
import { FINAL, H0, TODAY } from '../app/data';
import { APP_VIEW, WORD } from './Act2Mark';

// ACT 6 — pull back into a quilt of perfectly packed weeks; "Everything fits." snaps together;
// its red period becomes the mark's dot; lockup.

const L = (abs: number) => abs - ACT.end.from;

// ---- quilt of weeks -------------------------------------------------------------------
const PITCH = { x: GRID.w + 150, y: GRID.h + 150 };
const COLS = 11;
const ROWS = 9;

type Tile = { cx: number; cy: number; rects: { x: number; y: number; w: number; h: number; k: 0 | 1 | 2 }[] };

const makeWeek = (seed: number) => {
  const r = (n: number) => rand(`w${seed}-${n}`);
  const rects: Tile['rects'] = [];
  const y = (h: number) => (h - H0) * HOUR;
  for (let d = 0; d < 5; d++) {
    const x = d * COL + 4;
    const w = COL - 8;
    rects.push({ x, y: y(9) + 1.5, w, h: 0.5 * HOUR - 3, k: 0 });
    const focusEnd = 11.5 + Math.floor(r(d) * 2) * 0.5;
    if (r(d + 10) < 0.85) rects.push({ x, y: y(9.5) + 1.5, w, h: (focusEnd - 9.5) * HOUR - 3, k: 1 });
    let t = focusEnd + (r(d + 20) < 0.5 ? 0.5 : 1);
    if (r(d + 30) < 0.4) {
      rects.push({ x, y: y(12) + 1.5, w, h: HOUR - 3, k: 2 });
      t = 13;
    }
    let guard = 0;
    while (t < 17 && guard++ < 8) {
      const dur = [0.5, 0.75, 1, 1, 1.25][Math.floor(r(d * 7 + guard + 40) * 5)];
      const end = Math.min(17.25, t + dur);
      rects.push({ x, y: y(t) + 1.5, w, h: (end - t) * HOUR - 3, k: 0 });
      t = end;
    }
    if (r(d + 60) < 0.3) rects.push({ x, y: y(17.25) + 1.5, w, h: HOUR - 3, k: 2 });
  }
  return rects;
};

const TILES: Tile[] = (() => {
  const out: Tile[] = [];
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const di = i - (COLS - 1) / 2;
      const dj = j - (ROWS - 1) / 2;
      // the real app sits in the centre tile: same card as its neighbours, no random blocks
      out.push({ cx: di * PITCH.x, cy: dj * PITCH.y, rects: di === 0 && dj === 0 ? [] : makeWeek(j * COLS + i) });
    }
  return out;
})();

// The neighbouring weeks tessellate in as a wave that spreads out from ours: each card slides in
// along its ray from the centre and snaps into the grid, then its blocks pack themselves.
export const TILE_SPR = { damping: 15, stiffness: 150, mass: 0.7 };
export const tileDist = (t: Pick<Tile, 'cx' | 'cy'>) => Math.hypot(t.cx, t.cy) / PITCH.x;
export const tileDelay = (t: Pick<Tile, 'cx' | 'cy'>) => 22 + tileDist(t) * 21;
export const QUILT_TILES = TILES.filter((t) => t.cx !== 0 || t.cy !== 0).map((t) => ({ cx: t.cx, cy: t.cy, dist: tileDist(t), delay: tileDelay(t) }));

// Once the wave is in, the gutters close: the quilt snaps shut into one continuous surface.
export const SHUT_AT = 140; // act-local frame the gutters start closing
export const SHUT_SPR = { damping: 18, stiffness: 170, mass: 1 };

const Quilt: React.FC<{ f: number }> = ({ f }) => {
  const shut = spr(f, SHUT_AT, SHUT_SPR);
  const g = mix(150, 50, shut); // gutter between cards (cards carry a 22-unit margin each side)
  const cardR = mix(30, 12, shut);
  // one SVG, in grid-space coordinates centered on the real week's grid
  const x0 = -((COLS - 1) / 2) * PITCH.x;
  const y0 = -((ROWS - 1) / 2) * PITCH.y;
  const W = (COLS - 1) * PITCH.x + GRID.w;
  const Hh = (ROWS - 1) * PITCH.y + GRID.h;
  return (
    <svg width={W} height={Hh} viewBox={`${x0} ${y0} ${W} ${Hh}`} style={{ position: 'absolute', left: x0, top: y0, overflow: 'visible' }}>
      <defs>
        <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#fff" />
          <rect width="5" height="10" fill="#EEF0F2" />
        </pattern>
      </defs>
      {TILES.map((t, ti) => {
        const centre = t.cx === 0 && t.cy === 0;
        const D = tileDelay(t);
        // the centre card only appears as the window chrome fades, so it never peeks out under the window
        const o = centre ? prog(f, 8, 34, E.smooth) : prog(f, D - 3, D + 7, E.smooth);
        if (o <= 0) return null;
        const k = centre ? 1 : spr(f, D, TILE_SPR);
        const d = Math.max(1e-6, Math.hypot(t.cx, t.cy));
        const push = (1 - k) * PITCH.x * 0.34;
        const gx = (t.cx / PITCH.x) * (GRID.w + g);
        const gy = (t.cy / PITCH.y) * (GRID.h + g);
        const tx = gx + (t.cx / d) * push;
        const ty = gy + (t.cy / d) * push;
        const rot = (1 - k) * (rand(`tile-${ti}`) - 0.5) * 12;
        const sc = mix(0.84, 1, k);
        const cx = GRID.w / 2;
        const cy = GRID.h / 2;
        return (
          <g key={ti} opacity={o} transform={`translate(${tx} ${ty}) rotate(${rot} ${cx} ${cy}) translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`}>
            <rect x={-22} y={-4} width={GRID.w + 44} height={GRID.h + 44} rx={cardR} fill={`rgba(11,11,12,${0.05 * (1 - shut)})`} />
            <rect x={-22} y={-22} width={GRID.w + 44} height={GRID.h + 44} rx={cardR} fill="#fff" stroke="rgba(11,11,12,0.07)" strokeWidth={2} />
            {t.rects.map((q, qi) => {
              // the week packs itself: day by day, top to bottom, focus blocks last
              const at = D + 8 + Math.floor(q.x / COL) * 2.2 + (q.y / HOUR) * 0.8 + (q.k === 1 ? 5 : 0);
              const qo = prog(f, at, at + 9, E.out);
              if (qo <= 0) return null;
              return (
                <rect
                  key={qi}
                  x={q.x}
                  y={q.y - (1 - qo) * 40}
                  width={q.w}
                  height={q.h}
                  rx={9}
                  opacity={qo}
                  fill={q.k === 1 ? C.ink : q.k === 2 ? 'url(#hatch)' : '#EEEFF2'}
                  stroke={q.k === 2 ? C.line2 : 'none'}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

// ---- camera ---------------------------------------------------------------------------------
export const PULL_EASE = Easing.bezier(0.5, 0, 0.12, 1);
// finale timing (act-local frames), shared with the cue export
const ASM = L(CUE.lockupEnd);
export const STRIKE = { a: ASM - 16, b: ASM - 10 };
export const MORPH = { from: ASM + 10, to: ASM + 30 }; // lands on the beat after the strike
export const MORPH_EASE = Easing.bezier(0.55, 0, 0.9, 0.55); // accelerates in, arrives with velocity
export const HOP = { from: L(CUE.fits) - 30, to: L(CUE.fits) };
const HOP_LAUNCH = Easing.bezier(0.35, 0, 0.75, 1);
const HOP_EASE = Easing.bezier(0.45, 0, 0.25, 1); // dot radius during the hop
export const PULL_END = L(CUE.converge) + 60;
const PERSP = 2400;
const camAt = (f: number) => {
  const pb = prog(f, 0, PULL_END, PULL_EASE);
  const drift = f / 300;
  return {
    s: Math.exp(mix(Math.log(APP_VIEW.s), Math.log(0.2), pb) - 0.1 * drift),
    rx: mix(0, 22, pb),
    rz: mix(0, -7, pb) - 1.8 * drift,
    O: { x: mix(APP.W / 2, GRID.x + GRID.w / 2, pb), y: mix(APP.H / 2, GRID.y + GRID.h / 2, pb) },
  };
};
/** Screen position + local scale of an app-space point under the pull-back camera (matches the CSS transform). */
export const project = (f: number, p: { x: number; y: number }) => {
  const { s, rx, rz, O } = camAt(f);
  const a = (rz * Math.PI) / 180;
  const b = (rx * Math.PI) / 180;
  const vx = (p.x - O.x) * s;
  const vy = (p.y - O.y) * s;
  const x1 = vx * Math.cos(a) - vy * Math.sin(a);
  const y1 = vx * Math.sin(a) + vy * Math.cos(a);
  const y2 = y1 * Math.cos(b);
  const z2 = y1 * Math.sin(b);
  const k = PERSP / (PERSP - z2);
  return { x: 960 + x1 * k, y: 540 + y2 * k, s: s * k };
};
const NOW_END = 14.3; // the replanned Monday's clock at the end of the features act
export const NOW_PT = { x: GRID.x + TODAY * COL, y: GRID.y + (NOW_END - H0) * HOUR };

// ---- the scene --------------------------------------------------------------------------
type R = { x: number; y: number; w: number; h: number };
const lerpR = (a: R, b: R, t: number): R => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });

export const Act6End: React.FC = () => {
  const f = useCurrentFrame();

  // pull back: app (APP_VIEW) → quilt, zooming in log space so the speed feels even.
  // The previous shot lands at rest, so this one starts from rest; a slow constant drift keeps
  // the camera alive through the hold.
  const { s, rx, rz, O } = camAt(f);
  // the window becomes a tile before its neighbours appear
  const chrome = 1 - prog(f, 4, 34, E.smooth);

  // rack focus to the line (cross-faded so it never snaps)
  const rack = prog(f, L(CUE.everything) + 6, L(CUE.fits) - 4, E.smooth);
  const quiltGone = prog(f, L(CUE.lockupEnd) - 30, L(CUE.lockupEnd), E.smooth);

  // "Everything fits." — two words slide in and lock (no overshoot past the lock)
  const SIZE = 176;
  const m1 = useMemo(() => ({ width: measureTracked('Everything', SIZE, 600, -0.05) }), []);
  const m2 = useMemo(() => ({ width: measureTracked('fits', SIZE, 600, -0.05) }), []);
  const space = SIZE * 0.22;
  const dotD = SIZE * 0.155;
  const lineW = m1.width + space + m2.width + dotD * 1.25;
  const lx = 960 - lineW / 2;
  const baseY = 540 + SIZE * 0.34;
  const meetAt = L(CUE.fits);
  const sl = spr(f, meetAt - 22, { damping: 20, stiffness: 170, mass: 0.9 });
  const w1x = Math.min(0, mix(-m1.width - 260, 0, sl));
  const w2x = Math.max(0, mix(1920 - lx + 120, 0, sl));
  const wordsO = prog(f, meetAt - 22, meetAt - 12);
  const tp = (f - meetAt) / 14;
  const punch = tp > 0 && tp < 1 ? 1 + 0.018 * Math.sin(tp * Math.PI) : 1;

  // the words become blocks, the blocks become the mark
  const asm = L(CUE.lockupEnd);
  // each word is struck through with an ink line, left to right; the line then swells into a block
  const fillA = prog(f, STRIKE.a, STRIKE.a + 16, E.inOut);
  const fillB = prog(f, STRIKE.b, STRIKE.b + 14, E.inOut);
  const swellA = prog(f, STRIKE.a + 14, STRIKE.a + 26, E.out);
  const swellB = prog(f, STRIKE.b + 12, STRIKE.b + 24, E.out);
  const fill = fillA;
  // a slow push while the line holds, so it never sits dead still before the strike
  const k = punch * mix(1, 1.03, prog(f, meetAt, asm - 4, E.linear));
  const sc = (r: R): R => ({ x: 960 + (r.x - 960) * k, y: 540 + (r.y - 540) * k, w: r.w * k, h: r.h * k });
  // blocks → mark pieces: they accelerate into place and land with an impact on the beat
  const morph = prog(f, MORPH.from, MORPH.to, MORPH_EASE);
  const impact = (f - MORPH.to) / 16;
  const markPunch = impact > 0 && impact < 1 ? 1 + 0.035 * Math.sin(impact * Math.PI) : 1;
  const M1 = 140;
  const wm = useMemo(() => ({ width: measureTracked('tessel', WORD.size, WORD.weight, WORD.track) }), []);
  const gap = 34;
  const lockW = M1 + gap + wm.width;
  const lockX = 960 - lockW / 2;
  const lk = prog(f, asm + 38, asm + 74, E.inOut);
  const MS = 230;
  const size = mix(MS, M1, lk) * markPunch;
  const mx = mix(960 - MS / 2, lockX, lk);
  const my = 540 - size / 2 - 38 * lk;
  const u = size / 100;
  // the block covers every glyph (ascenders to descenders); the line sits on the x-height
  const blockTop = baseY - SIZE * 0.8;
  const blockH = SIZE * 1.04;
  const lineH = SIZE * 0.11;
  const lineTop = baseY - SIZE * 0.36 - lineH / 2;
  const strikeBox = (x: number, w: number, sw: number): R => ({ x, y: mix(lineTop, blockTop, sw), w, h: mix(lineH, blockH, sw) });
  const wordA: R = sc(strikeBox(lx + w1x - 10, m1.width + 16, swellA));
  // B stops short of the period so the dot never overlaps it
  const wordB: R = sc(strikeBox(lx + m1.width + space + w2x - 10, m2.width + 11, swellB));
  const pieceA: R = { x: mx + MARK.A.x * u, y: my + MARK.A.y * u, w: MARK.A.w * u, h: MARK.A.h * u };
  const pieceB: R = { x: mx + MARK.B.x * u, y: my + MARK.B.y * u, w: MARK.B.w * u, h: MARK.B.h * u };
  const A = lerpR(wordA, pieceA, morph);
  const B = lerpR(wordB, pieceB, morph);
  const rad = mix(mix(lineH / 2, 16, Math.min(swellA, swellB)), MARK.r * u, morph);

  // the red period slides into the mark's dot slot
  const px = lx + m1.width + space + m2.width + dotD * 0.62 + w2x;
  const py = baseY - SIZE * 0.078 - dotD / 2;
  const periodPos = { x: 960 + (px - 960) * k, y: 540 + (py - 540) * k };
  const markDot = { x: mx + MARK.D.cx * u, y: my + MARK.D.cy * u, r: MARK.D.r * u };
  const final = L(CUE.final);
  const blink = f > final ? 1 + 0.16 * Math.sin(Math.min(1, (f - final) / 16) * Math.PI) : 1;
  // before that it is still the calendar's now dot: it never shrinks with the pull back, and it
  // hops across to become the period exactly as "fits" locks
  const nowP = project(f, NOW_PT);
  const periodRest = { x: 960 + (px - w2x - 960) * k, y: 540 + (py - 540) * k };
  // a ballistic hop: it eases off the line, arcs over the incoming word and drops into the slot
  // from above-right just after "fits" locks (the bow keeps it clear of the 's')
  const hop = prog(f, HOP.from, HOP.to, HOP_LAUNCH);
  const nowR = Math.max(5.6, 6 * nowP.s) * mix(1, 1.55, prog(f, 30, 150, E.smooth));
  const hx = 1 - Math.pow(1 - hop, 2.2);
  const period = {
    x: mix(nowP.x, periodRest.x, hx) + 60 * Math.sin(Math.PI * hop),
    y: mix(nowP.y, periodRest.y, hop * hop) - 190 * 4 * hop * (1 - hop),
    r: mix(nowR, dotD / 2, HOP_EASE(hop)),
  };
  if (hop >= 1) Object.assign(period, { x: periodPos.x, y: periodPos.y, r: (dotD / 2) * k });
  // the dot follows a few frames behind the blocks so B clears its path, and lands with them
  const dmorph = prog(f, MORPH.from + 5, MORPH.to, MORPH_EASE);
  const dot = {
    x: mix(period.x, markDot.x, dmorph),
    y: mix(period.y, markDot.y, dmorph),
    r: mix(period.r, markDot.r, dmorph) * blink,
  };
  const wordIn = prog(f, asm + 50, asm + 86, E.out);
  const urlIn = prog(f, asm + 78, asm + 104, E.out);
  const endPush = mix(1, 1.035, prog(f, asm + 60, ACT.end.dur, E.smooth));

  const textO = 1 - prog(f, 20, 70, E.smooth);
  const events = FINAL.map((ev) => ({ ev, s: { rect: evRect(ev), textO } }));
  const world = () => (
    <div
      style={{
        position: 'absolute',
        left: 960 - O.x,
        top: 540 - O.y,
        width: APP.W,
        height: APP.H,
        transformOrigin: `${O.x}px ${O.y}px`,
        transform: `perspective(${PERSP}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s})`,
      }}
    >
      <div style={{ position: 'absolute', left: GRID.x, top: GRID.y }}>
        <Quilt f={f} />
      </div>
      <CalendarApp events={events} chrome={chrome} frame={chrome} nowO={1} shadow prioIn={[1, 1, 1]} clashes={12} clashO={1} resolved={1} status={1} now={NOW_END} />
    </div>
  );

  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: '#EEEFF2', opacity: prog(f, 10, 60, E.smooth) * (1 - rack) }} />
      {quiltGone < 1 && <RackFocus t={rack} blur={9} render={world} style={{ opacity: 1 - quiltGone }} />}
      <AbsoluteFill style={{ background: '#fff', opacity: rack * 0.66 * (1 - quiltGone) }} />

      {/* Everything fits. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: '960px 540px' }}>
        {[
          { t: 'Everything', x: lx + w1x, gone: swellA >= 1 },
          { t: 'fits', x: lx + m1.width + space + w2x, gone: swellB >= 1 },
        ].map((w) => (
          <div
            key={w.t}
            style={{
              position: 'absolute',
              left: w.x,
              top: baseY - SIZE * 0.93,
              fontFamily: FONT.sans,
              fontSize: SIZE,
              fontWeight: 600,
              letterSpacing: '-0.05em',
              lineHeight: 1,
              color: C.ink,
              whiteSpace: 'nowrap',
              opacity: w.gone ? 0 : wordsO,
            }}
          >
            {w.t}
          </div>
        ))}
      </div>

      <AbsoluteFill style={{ transform: `scale(${endPush})`, transformOrigin: '960px 520px' }}>
        {/* wordmark, revealed from behind the mark's live edge */}
        {wordIn > 0 &&
          (() => {
            const finalLeft = lockX + M1 + gap;
            const cl = Math.max(finalLeft - 6, mx + size + gap * (size / M1) - 6);
            const right = finalLeft + wm.width + 60;
            return (
              <div
                style={{
                  position: 'absolute',
                  left: cl,
                  top: 540 - 30 - WORD.size * 0.66,
                  height: WORD.size * 1.25,
                  width: Math.max(0, right - cl),
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: finalLeft - cl,
                    top: 0,
                    height: WORD.size * 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: FONT.sans,
                    fontSize: WORD.size,
                    fontWeight: WORD.weight,
                    letterSpacing: `${WORD.track}em`,
                    color: C.ink,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    transform: `translateX(${(1 - wordIn) * -(wm.width + 90)}px)`,
                    filter: `blur(${(1 - wordIn) * 5}px)`,
                  }}
                >
                  tessel
                </span>
              </div>
            );
          })()}
        {/* the two word-blocks → the mark's tall block and square */}
        {fill > 0 &&
          [A, B].map((r, i) => {
            const w = (i === 0 ? fillA : fillB) * r.w;
            if (w <= 0) return null;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y,
                  width: w,
                  height: r.h,
                  borderRadius: Math.min(rad, w / 2),
                  background: C.ink,
                }}
              />
            );
          })}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1920,
            top: 540 + 110,
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: C.mute2,
            opacity: urlIn,
            transform: `translateY(${(1 - urlIn) * 14}px)`,
            filter: `blur(${(1 - urlIn) * 6}px)`,
          }}
        >
          tessel.app
        </div>
        {/* the dot: the period, then the mark's dot */}
        <div
          style={{
            position: 'absolute',
            left: dot.x - dot.r,
            top: dot.y - dot.r,
            width: dot.r * 2,
            height: dot.r * 2,
            borderRadius: '50%',
            background: C.red,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
