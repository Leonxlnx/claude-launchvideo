import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { measureTracked } from '../lib/measure';
import { RackFocus } from '../fx/RackFocus';
import { C, FONT } from '../brand/tokens';
import { MARK } from '../brand/Mark';
import { E, mix, prog, rand, spr } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, CalendarApp, COL, evRect, GRID, HOUR } from '../app/CalendarApp';
import { FINAL, H0 } from '../app/data';
import { APP_VIEW, WORD } from './Act2Mark';

// ACT 6 — pull back into a quilt of perfectly packed weeks; "Everything fits." snaps together;
// its red period becomes the mark's dot; lockup.

const L = (abs: number) => abs - ACT.end.from;

// ---- quilt of weeks -------------------------------------------------------------------
const PITCH = { x: GRID.w + 150, y: GRID.h + 150 };
const COLS = 9;
const ROWS = 7;

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

const Quilt: React.FC = () => {
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
      {TILES.map((t, ti) => (
        <g key={ti} transform={`translate(${t.cx} ${t.cy})`}>
          <rect x={-22} y={-4} width={GRID.w + 44} height={GRID.h + 44} rx={30} fill="rgba(11,11,12,0.05)" />
          <rect x={-22} y={-22} width={GRID.w + 44} height={GRID.h + 44} rx={30} fill="#fff" stroke="rgba(11,11,12,0.07)" strokeWidth={2} />
          {t.rects.map((q, qi) => (
            <rect
              key={qi}
              x={q.x}
              y={q.y}
              width={q.w}
              height={q.h}
              rx={9}
              fill={q.k === 1 ? C.ink : q.k === 2 ? 'url(#hatch)' : '#EEEFF2'}
              stroke={q.k === 2 ? C.line2 : 'none'}
            />
          ))}
        </g>
      ))}
    </svg>
  );
};

// ---- the scene --------------------------------------------------------------------------
type R = { x: number; y: number; w: number; h: number };
const lerpR = (a: R, b: R, t: number): R => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });

export const Act6End: React.FC = () => {
  const f = useCurrentFrame();

  // pull back: app (APP_VIEW) → quilt, zooming in log space so the speed feels even
  const pb = prog(f, 0, L(CUE.converge) + 50, E.outSoft);
  const s = Math.exp(mix(Math.log(APP_VIEW.s), Math.log(0.2), pb));
  const rx = mix(0, 22, pb);
  const rz = mix(0, -7, pb);
  const O = { x: mix(APP.W / 2, GRID.x + GRID.w / 2, pb), y: mix(APP.H / 2, GRID.y + GRID.h / 2, pb) };
  // the window becomes a tile before its neighbours appear
  const chrome = 1 - prog(f, 4, 34, E.smooth);
  const quiltIn = prog(f, 26, 64, E.smooth);

  // rack focus to the line (cross-faded so it never snaps)
  const rack = prog(f, L(CUE.everything) - 20, L(CUE.everything) + 30, E.smooth);
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
  const fill = prog(f, asm - 4, asm + 8, E.out); // words fill with ink → two blocks
  const morph = prog(f, asm + 6, asm + 40, E.inOut); // blocks → mark pieces
  const M1 = 140;
  const wm = useMemo(() => ({ width: measureTracked('tessel', WORD.size, WORD.weight, WORD.track) }), []);
  const gap = 34;
  const lockW = M1 + gap + wm.width;
  const lockX = 960 - lockW / 2;
  const lk = prog(f, asm + 38, asm + 74, E.inOut);
  const MS = 230;
  const size = mix(MS, M1, lk);
  const mx = mix(960 - MS / 2, lockX, lk);
  const my = 540 - size / 2 - 38 * lk;
  const u = size / 100;
  const top = baseY - SIZE * 0.74;
  const bh = SIZE * 0.94;
  const wordA: R = { x: lx + w1x - 10, y: top - 6, w: m1.width + 16, h: bh };
  const wordB: R = { x: lx + m1.width + space + w2x - 10, y: top - 6, w: m2.width + 16, h: bh };
  const pieceA: R = { x: mx + MARK.A.x * u, y: my + MARK.A.y * u, w: MARK.A.w * u, h: MARK.A.h * u };
  const pieceB: R = { x: mx + MARK.B.x * u, y: my + MARK.B.y * u, w: MARK.B.w * u, h: MARK.B.h * u };
  const A = lerpR(wordA, pieceA, morph);
  const B = lerpR(wordB, pieceB, morph);
  const rad = mix(16, MARK.r * u, morph);

  // the red period slides into the mark's dot slot
  const px = lx + m1.width + space + m2.width + dotD * 0.62 + w2x;
  const py = baseY - SIZE * 0.078 - dotD / 2;
  const periodPos = { x: 960 + (px - 960) * punch, y: 540 + (py - 540) * punch };
  const markDot = { x: mx + MARK.D.cx * u, y: my + MARK.D.cy * u, r: MARK.D.r * u };
  const final = L(CUE.final);
  const blink = f > final ? 1 + 0.16 * Math.sin(Math.min(1, (f - final) / 16) * Math.PI) : 1;
  const dot = {
    x: mix(periodPos.x, markDot.x, morph),
    y: mix(periodPos.y, markDot.y, morph),
    r: mix((dotD / 2) * punch, markDot.r, morph) * blink,
  };
  const wordIn = prog(f, asm + 50, asm + 86, E.out);
  const urlIn = prog(f, asm + 78, asm + 104, E.out);
  const endPush = mix(1, 1.035, prog(f, asm + 60, ACT.end.dur, E.smooth));

  const events = FINAL.map((ev) => ({ ev, s: { rect: evRect(ev) } }));
  const world = () => (
    <div
      style={{
        position: 'absolute',
        left: 960 - O.x,
        top: 540 - O.y,
        width: APP.W,
        height: APP.H,
        transformOrigin: `${O.x}px ${O.y}px`,
        transform: `perspective(2400px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s})`,
      }}
    >
      <div style={{ position: 'absolute', left: GRID.x, top: GRID.y, opacity: quiltIn }}>
        <Quilt />
      </div>
      <CalendarApp events={events} chrome={chrome} frame={chrome} nowO={1} shadow prioIn={[1, 1, 1]} clashes={12} clashO={1} resolved={1} status={1} now={14.3} />
    </div>
  );

  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: '#EEEFF2', opacity: prog(f, 10, 60, E.smooth) * (1 - rack) }} />
      {quiltGone < 1 && <RackFocus t={rack} blur={9} render={world} style={{ opacity: 1 - quiltGone }} />}
      <AbsoluteFill style={{ background: '#fff', opacity: rack * 0.82 * (1 - quiltGone) }} />

      {/* Everything fits. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${punch})`, transformOrigin: '960px 540px', opacity: morph > 0.5 ? 0 : 1 }}>
        {[
          { t: 'Everything', x: lx + w1x },
          { t: 'fits', x: lx + m1.width + space + w2x },
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
              opacity: wordsO,
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
          [A, B].map((r, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: r.x,
                top: r.y,
                width: r.w,
                height: r.h,
                borderRadius: rad,
                background: C.ink,
                opacity: fill,
                transform: morph === 0 ? `scale(${punch})` : undefined,
              }}
            />
          ))}
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
            opacity: wordsO,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
