import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { measureTracked } from '../lib/measure';
import { C, FONT } from '../brand/tokens';
import { MARK } from '../brand/Mark';
import { E, mix, prog, spr } from '../lib/anim';
import { Words } from '../fx/Words';
import { ACT, CUE } from '../timeline';
import { APP, CalendarApp, GRID, HOUR, COL } from '../app/CalendarApp';
import { H0, NOW, TODAY } from '../app/data';

// ACT 2 — the dot becomes the mark, the mark becomes the product.
// The tall block turns into the sidebar, the square into the calendar, the dot into "now".

const L = (abs: number) => abs - ACT.mark.from; // absolute cue → local frame

// App framing at the end of this act (Act 3 starts from exactly here)
export const APP_VIEW = { s: 0.94, x: 960 - (APP.W * 0.94) / 2, y: 540 - (APP.H * 0.94) / 2 };

type R = { x: number; y: number; w: number; h: number };
const lerpR = (a: R, b: R, t: number): R => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });

export const WORD = { size: 190, weight: 620, track: -0.055 };
const DOT_APP = {
  x: (GRID.x + TODAY * COL) / APP.W,
  y: (GRID.y + (NOW - H0) * HOUR) / APP.H,
};

export const Act2Mark: React.FC = () => {
  const f = useCurrentFrame();

  // --- stage: ink flood from the dot -------------------------------------------------
  const flood = prog(f, 0, 18, E.out);
  const floodR = mix(0, 1250, flood);

  // --- mark geometry ------------------------------------------------------------------
  const M0 = 240; // assembled size at center
  const M1 = 140; // lockup size: top on the ascender, bottom on the baseline
  const wm = { width: measureTracked('tessel', WORD.size, WORD.weight, WORD.track) };
  const gap = 34;
  const lockW = M1 + gap + wm.width;
  const lockX = 960 - lockW / 2;

  const lk = prog(f, L(CUE.lockup), L(CUE.lockup) + 34, E.inOut);
  const hold = prog(f, L(CUE.lockup) + 34, L(CUE.flyIn), E.smooth); // slow drift while we read
  const size = mix(M0, M1, lk) * mix(1, 1.025, hold);
  const mx = mix(960 - M0 / 2, lockX, lk) - (size - M1) * 0.5 * lk;
  const my = 540 - size / 2 - 8 * lk;
  const u = size / 100; // px per mark unit

  // impact punch when the pieces lock (whole mark)
  const pt = (f - 20) / 16;
  const punch = pt > 0 && pt < 1 ? 1 + 0.04 * Math.sin(pt * Math.PI) : 1;

  // piece entry springs
  const sa = spr(f, 4, { damping: 17, stiffness: 210, mass: 0.8 });
  const sb = spr(f, 10, { damping: 17, stiffness: 210, mass: 0.8 });

  // --- fly into the app ---------------------------------------------------------------
  const flyS = L(CUE.flyIn);
  const fly = prog(f, flyS, ACT.mark.dur - 14, E.inOut);
  const appIn = prog(f, ACT.mark.dur - 18, ACT.mark.dur - 1, E.smooth);
  const V = APP_VIEW;
  const winR: R = { x: V.x, y: V.y, w: APP.W * V.s, h: APP.H * V.s };
  const sideR: R = { x: V.x, y: V.y, w: APP.side * V.s, h: APP.H * V.s };
  const mainR: R = { x: V.x + APP.side * V.s, y: V.y, w: (APP.W - APP.side) * V.s, h: APP.H * V.s };
  const markR: R = { x: mx, y: my, w: size, h: size };

  const A0: R = { x: mx + MARK.A.x * u, y: my + MARK.A.y * u, w: MARK.A.w * u, h: MARK.A.h * u };
  const B0: R = { x: mx + MARK.B.x * u, y: my + MARK.B.y * u, w: MARK.B.w * u, h: MARK.B.h * u };
  const A = lerpR(A0, sideR, fly);
  const B = lerpR(B0, mainR, fly);
  const U = lerpR(markR, winR, fly);
  const rPiece = MARK.r * u;
  const rWin = APP.R * V.s;

  // dot: center → mark slot → app "now" (tracked inside the morphing window so it never strays)
  const sd = spr(f, 2, { damping: 16, stiffness: 190, mass: 0.7 });
  const inMark = {
    x: U.x + mix(MARK.D.cx / 100, DOT_APP.x, fly) * U.w,
    y: U.y + mix(MARK.D.cy / 100, DOT_APP.y, fly) * U.h,
    r: mix(MARK.D.r * u, 5 * V.s, fly),
  };
  const dot = {
    x: mix(960, inMark.x, sd),
    y: mix(540, inMark.y, sd),
    r: mix(17.5, inMark.r, sd),
  };

  // wordmark + descriptor
  const wordOut = prog(f, flyS - 6, flyS + 12, E.in);
  const wordIn = prog(f, L(CUE.lockup) + 14, L(CUE.lockup) + 50, E.out);
  const sideTone = mix(255, 250, fly);

  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      {/* ink flood */}
      <div
        style={{
          position: 'absolute',
          left: 960 - floodR,
          top: 540 - floodR,
          width: floodR * 2,
          height: floodR * 2,
          borderRadius: '50%',
          background: C.ink,
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.075), rgba(255,255,255,0) 70%)',
          opacity: flood,
        }}
      />

      {/* wordmark: slides out from behind the mark (drawn first, so the mark covers it) */}
      <div
        style={{
          position: 'absolute',
          left: lockX + M1 + gap - 6,
          top: 540 - WORD.size * 0.66,
          height: WORD.size * 1.25,
          width: wm.width + 60,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          opacity: 1 - wordOut,
          filter: `blur(${wordOut * 12}px)`,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontFamily: FONT.sans,
            fontSize: WORD.size,
            fontWeight: WORD.weight,
            letterSpacing: `${WORD.track + (1 - wordIn) * 0.03}em`,
            color: '#fff',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            paddingLeft: 6,
            transform: `translateX(${(1 - wordIn) * -(wm.width + 30)}px) scale(${mix(1, 1.012, hold)})`,
            transformOrigin: 'left center',
            filter: `blur(${(1 - wordIn) * 5}px)`,
          }}
        >
          tessel
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: 1920,
          top: 540 + 116,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontSize: 44,
          fontWeight: 460,
          letterSpacing: '-0.025em',
          color: '#8E9098',
          opacity: 1 - wordOut,
        }}
      >
        <Words text="The calendar that plans itself." frame={f} start={L(CUE.lockup) + 22} stagger={5} dur={24} blur={10} />
      </div>

      {/* the mark (punch applies to the whole assembly) */}
      <AbsoluteFill style={{ transform: `scale(${punch})`, transformOrigin: '960px 540px' }}>
        {/* piece A (tall) → sidebar */}
        <div
          style={{
            position: 'absolute',
            left: A.x,
            top: A.y,
            width: A.w,
            height: A.h,
            background: `rgb(${sideTone},${sideTone},${mix(255, 251, fly)})`,
            borderRadius: `${mix(rPiece, rWin, fly)}px ${mix(rPiece, 0, fly)}px ${mix(rPiece, 0, fly)}px ${mix(rPiece, rWin, fly)}px`,
            transform: `translate(${(1 - sa) * -760}px, ${(1 - sa) * 140}px) rotate(${(1 - sa) * -18}deg)`,
          }}
        />
        {/* piece B (square) → calendar */}
        <div
          style={{
            position: 'absolute',
            left: B.x,
            top: B.y,
            width: B.w,
            height: B.h,
            background: '#fff',
            borderRadius: `${mix(rPiece, 0, fly)}px ${mix(rPiece, rWin, fly)}px ${mix(rPiece, rWin, fly)}px ${mix(rPiece, 0, fly)}px`,
            transform: `translate(${(1 - sb) * 150}px, ${(1 - sb) * -760}px) rotate(${(1 - sb) * 10}deg)`,
            boxShadow: fly > 0 ? `0 ${40 * fly}px ${90 * fly}px rgba(0,0,0,${0.4 * fly})` : 'none',
          }}
        />

        {/* the product fades up inside the two pieces */}
        {appIn > 0 && (
          <div
            style={{
              position: 'absolute',
              left: V.x,
              top: V.y,
              width: APP.W,
              height: APP.H,
              transform: `scale(${V.s})`,
              transformOrigin: '0 0',
              opacity: appIn,
            }}
          >
            <CalendarApp events={[]} nowO={0} shadow={false} />
          </div>
        )}

        {/* the dot, always on top */}
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
