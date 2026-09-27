import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { measureTracked } from '../lib/measure';
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
const HOUSE = E.cam;
const OV = 80; // overscan for blurred layers

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
      if (di === 0 && dj === 0) continue; // the real app sits here
      out.push({ cx: di * PITCH.x, cy: dj * PITCH.y, rects: makeWeek(j * COLS + i) });
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
export const Act6End: React.FC = () => {
  const f = useCurrentFrame();

  // pull back: app (APP_VIEW) → quilt
  const pb = prog(f, 4, L(CUE.converge) + 20, HOUSE);
  const s = mix(APP_VIEW.s, 0.2, pb);
  const tilt = prog(f, 20, L(CUE.converge) + 40, E.smooth);
  const rx = mix(0, 22, tilt);
  const rz = mix(0, -7, tilt);
  // origin: app center → grid center (in app space)
  const O = { x: mix(APP.W / 2, GRID.x + GRID.w / 2, pb), y: mix(APP.H / 2, GRID.y + GRID.h / 2, pb) };
  const chrome = 1 - prog(f, 16, 70, E.smooth);

  // rack focus to the line
  const rack = prog(f, L(CUE.everything) - 20, L(CUE.everything) + 30, E.smooth);
  const quiltGone = prog(f, L(CUE.lockupEnd) - 30, L(CUE.lockupEnd), E.smooth);

  // "Everything fits." — two words slide in and lock together
  const SIZE = 176;
  const m1 = useMemo(() => ({ width: measureTracked('Everything', SIZE, 620, -0.05) }), []);
  const m2 = useMemo(() => ({ width: measureTracked('fits', SIZE, 620, -0.05) }), []);
  const space = SIZE * 0.22;
  const dotD = SIZE * 0.155;
  const lineW = m1.width + space + m2.width + dotD * 1.25;
  const lx = 960 - lineW / 2;
  const baseY = 540 + SIZE * 0.34; // baseline
  const meetAt = L(CUE.fits);
  const sl = spr(f, meetAt - 22, { damping: 20, stiffness: 170, mass: 0.9 });
  const w1x = mix(-m1.width - 260, 0, sl);
  const w2x = mix(1920 - lx + 120, 0, sl);
  const wordsO = prog(f, meetAt - 22, meetAt - 12);
  const tp = (f - meetAt) / 14;
  const punch = tp > 0 && tp < 1 ? 1 + 0.018 * Math.sin(tp * Math.PI) : 1;
  const wordsOut = prog(f, L(CUE.lockupEnd) - 6, L(CUE.lockupEnd) + 12, E.in);

  // red period → mark dot → lockup
  const M1 = 140;
  const wm = useMemo(() => ({ width: measureTracked('tessel', WORD.size, WORD.weight, WORD.track) }), []);
  const gap = 34;
  const lockW = M1 + gap + wm.width;
  const lockX = 960 - lockW / 2;
  const asm = L(CUE.lockupEnd);
  const toMark = prog(f, asm - 2, asm + 26, E.inOut);
  const lk = prog(f, L(CUE.url) - 30, L(CUE.url) + 6, E.inOut);
  const MS = 230; // assembled mark at center
  const size = mix(MS, M1, lk);
  const mx = mix(960 - MS / 2, lockX, lk);
  const my = 540 - size / 2 - 38 * lk;
  const u = size / 100;
  const sa = spr(f, asm + 10, { damping: 17, stiffness: 220, mass: 0.8 });
  const sb = spr(f, asm + 16, { damping: 17, stiffness: 220, mass: 0.8 });
  const px = lx + m1.width + space + m2.width + dotD * 0.62 + w2x;
  const py = baseY - dotD / 2;
  const periodPos = { x: 960 + (px - 960) * punch, y: 540 + (py - 540) * punch };
  const markDot = { x: mx + MARK.D.cx * u, y: my + MARK.D.cy * u, r: MARK.D.r * u };
  const final = L(CUE.final);
  const blink = f > final ? 1 + 0.16 * Math.sin(Math.min(1, (f - final) / 16) * Math.PI) : 1;
  const dot = {
    x: mix(periodPos.x, markDot.x, toMark),
    y: mix(periodPos.y, markDot.y, toMark),
    r: mix((dotD / 2) * punch, markDot.r, toMark) * blink,
  };
  const wordIn = prog(f, L(CUE.url) - 16, L(CUE.url) + 22, E.out);
  const urlIn = prog(f, L(CUE.url) + 16, L(CUE.url) + 44, E.out);
  const endPush = mix(1, 1.035, prog(f, L(CUE.url), ACT.end.dur, E.smooth));

  // central app events (end state of the feature section)
  const events = FINAL.map((ev) => ({ ev, s: { rect: evRect(ev) } }));

  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: '#EEEFF2', opacity: prog(f, 10, 60, E.smooth) * (1 - prog(f, L(CUE.everything) - 20, L(CUE.everything) + 30, E.smooth)) }} />
      {/* world */}
      <div style={{ position: 'absolute', left: -OV, top: -OV, width: 1920 + OV * 2, height: 1080 + OV * 2, opacity: 1 - quiltGone, overflow: 'hidden', filter: rack > 0.01 ? `blur(${rack * 9}px)` : undefined }}>
        <div
          style={{
            position: 'absolute',
            left: 960 - O.x + OV,
            top: 540 - O.y + OV,
            width: APP.W,
            height: APP.H,
            transformOrigin: `${O.x}px ${O.y}px`,
            transform: `perspective(2400px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s})`,
          }}
        >
          <div style={{ position: 'absolute', left: GRID.x, top: GRID.y, opacity: prog(f, 10, 50, E.smooth) }}>
            <Quilt />
          </div>
          <CalendarApp events={events} chrome={chrome} nowO={1} shadow={chrome > 0.5} prioIn={[1, 1, 1]} clashes={0} clashO={1} resolved={1} now={14.3} />
        </div>
      </div>
      <AbsoluteFill style={{ background: '#fff', opacity: rack * 0.82 * (1 - quiltGone) }} />

      {/* Everything fits. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${punch})`, transformOrigin: '960px 540px', opacity: 1 - wordsOut, filter: wordsOut > 0 ? `blur(${wordsOut * 12}px)` : undefined }}>
        <div
          style={{
            position: 'absolute',
            left: lx + w1x,
            top: baseY - SIZE * 0.93,
            fontFamily: FONT.sans,
            fontSize: SIZE,
            fontWeight: 620,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            color: C.ink,
            whiteSpace: 'nowrap',
            opacity: wordsO,
          }}
        >
          Everything
        </div>
        <div
          style={{
            position: 'absolute',
            left: lx + m1.width + space + w2x,
            top: baseY - SIZE * 0.93,
            fontFamily: FONT.sans,
            fontSize: SIZE,
            fontWeight: 620,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            color: C.ink,
            whiteSpace: 'nowrap',
            opacity: wordsO,
          }}
        >
          fits
        </div>
      </div>

      {/* mark pieces + wordmark + url */}
      <AbsoluteFill style={{ transform: `scale(${endPush})`, transformOrigin: '960px 520px' }}>
        {f > asm - 4 && (
          <>
            <div
              style={{
                position: 'absolute',
                left: lockX + M1 + gap - 6,
                top: 540 - 30 - WORD.size * 0.66,
                height: WORD.size * 1.25,
                width: wm.width + 60,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontFamily: FONT.sans,
                  fontSize: WORD.size,
                  fontWeight: WORD.weight,
                  letterSpacing: `${WORD.track + (1 - wordIn) * 0.03}em`,
                  color: C.ink,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  paddingLeft: 6,
                  transform: `translateX(${(1 - wordIn) * -(wm.width + 30)}px)`,
                  filter: `blur(${(1 - wordIn) * 5}px)`,
                }}
              >
                tessel
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                left: mx + MARK.A.x * u,
                top: my + MARK.A.y * u,
                width: MARK.A.w * u,
                height: MARK.A.h * u,
                borderRadius: MARK.r * u,
                background: C.ink,
                transform: `translate(${(1 - sa) * -620}px, ${(1 - sa) * 60}px) rotate(${(1 - sa) * -14}deg)`,
                opacity: sa > 0.001 ? 1 : 0,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: mx + MARK.B.x * u,
                top: my + MARK.B.y * u,
                width: MARK.B.w * u,
                height: MARK.B.h * u,
                borderRadius: MARK.r * u,
                background: C.ink,
                transform: `translate(${(1 - sb) * 120}px, ${(1 - sb) * -640}px) rotate(${(1 - sb) * 10}deg)`,
                opacity: sb > 0.001 ? 1 : 0,
              }}
            />
          </>
        )}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1920,
            top: 540 + 110,
            textAlign: 'center',
            fontFamily: FONT.mono,
            fontSize: 30,
            letterSpacing: '0.01em',
            color: C.mute,
            opacity: urlIn,
            transform: `translateY(${(1 - urlIn) * 14}px)`,
            filter: `blur(${(1 - urlIn) * 6}px)`,
          }}
        >
          tessel.app
        </div>
        {/* the dot (the period, then the mark's dot) */}
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
