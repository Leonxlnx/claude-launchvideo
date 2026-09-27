import React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { C, FONT } from '../brand/tokens';
import { E, hitPulse, mix, prog, tw } from '../lib/anim';
import { Words } from '../fx/Words';
import { CUE } from '../timeline';
import { ACT1, RAIN, RainBlock, STACK_LIFT } from './act1-data';
import { fmt, NOW } from '../app/data';

// ACT 1 — "Your week doesn't fit."
// A red dot (now) draws the day, meetings rain in, the headline overflows the frame,
// then everything implodes back into the dot.

const { colW, hourH, nowY, now } = ACT1;
// Opening iris: the film opens on a full red frame (the now dot, 80x) that irises down onto the
// marker and lands on the first tick. Interpolated in log space, so the zoom rate is steady while
// the edge sweeps in fast and settles; it still has a little speed left when it lands on the tick.
const IRIS_FROM = 80; // 28px x 80 = 2240px: covers the frame diagonal
const IRIS = Easing.bezier(0.4, 0, 0.7, 0.92);
const yOf = (h: number) => nowY + (h - now) * hourH;

const Block: React.FC<{ b: RainBlock; f: number }> = ({ b, f }) => {
  const t = f - b.land;
  if (t < -16) return null;
  // fall: accelerate in over 16 frames, then a small damped settle
  const fall = t < 0 ? Math.pow((t + 16) / 16, 2.2) : 1;
  const settle = t >= 0 ? Math.exp(-t / 5) * Math.sin(t / 2.2) * 10 : 0;
  // piled blocks rest a little higher per level, so the pile reads as a stack
  const y0 = yOf(b.start) - STACK_LIFT * b.depth;
  const y = mix(-260 - (y0 + 60), 0, fall) - settle;
  // blocks keep a little of their tilt and offset, piled ones more: nothing lines up any more
  const rot = mix(b.rot * (b.depth > 0 ? 0.55 : 0.22), b.rot, 1 - fall);
  const x = b.day * colW + 6 + b.jx * 0.6;
  const h = b.dur * hourH - 6;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y0,
        width: colW - 12,
        height: h,
        transform: `translateY(${y}px) rotate(${rot}deg)`,
        borderRadius: 14,
        boxSizing: 'border-box',
        padding: '12px 16px',
        fontFamily: FONT.sans,
        background: b.ink ? C.ink : b.outline ? '#fff' : '#EFF0F2',
        border: b.outline ? `2px solid ${C.ink}` : b.ink ? 'none' : '1px solid rgba(11,11,12,0.05)',
        color: b.ink ? '#fff' : C.ink,
        boxShadow: '0 10px 24px -8px rgba(11,11,12,0.16)',
        overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 580, letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>{b.title}</div>
      {h > 60 && (
        <div style={{ fontFamily: FONT.sans, fontVariantNumeric: 'tabular-nums', fontWeight: 460, fontSize: 16, marginTop: 4, color: b.ink ? 'rgba(255,255,255,0.55)' : C.mute }}>
          {String(Math.floor(b.start)).padStart(2, '0')}:{b.start % 1 ? '30' : '00'}
        </div>
      )}
    </div>
  );
};

const HourLines: React.FC<{ f: number }> = ({ f }) => {
  const hours = [5, 6, 7, 8, 9, 10, 11, 12, 13];
  return (
    <>
      {hours.map((h) => {
        const y = yOf(h);
        const d = Math.abs(y - nowY);
        const start = CUE.gridDraw + d / 60;
        const p = prog(f, start, start + 40, E.out);
        return (
          <React.Fragment key={h}>
            <div
              style={{
                position: 'absolute',
                left: 960 - 960 * p,
                top: y,
                width: 1920 * p,
                height: 1.5,
                background: C.line,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 84,
                top: y + 10,
                fontFamily: FONT.sans,
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 460,
                fontSize: 18,
                color: C.mute,
                opacity: prog(f, start + 10, start + 34) * mix(1, 0.35, prog(f, CUE.rainStart, CUE.doesntFit, E.smooth)),
              }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          </React.Fragment>
        );
      })}
      {[1, 2, 3, 4, 5, 6].map((d) => {
        const start = CUE.gridDraw + 6 + Math.abs(d - 3.5) * 3;
        const p = prog(f, start, start + 50, E.out);
        return (
          <div
            key={d}
            style={{ position: 'absolute', left: d * colW, top: 540 - 540 * p, width: 1.5, height: 1080 * p, background: C.line }}
          />
        );
      })}
    </>
  );
};

export const Act1Fit: React.FC = () => {
  const f = useCurrentFrame();

  // implosion (everything collapses into the dot)
  const imp = prog(f, CUE.implodeStart, CUE.silence + 4, E.in);
  const worldScale = mix(1, 0.0, imp);
  const worldRot = mix(0, -14, imp);

  // the film opens on a full red frame: the now dot, irising down onto the marker by the first
  // tick (the camera pulls back with it), then a slow push-in over the act
  const open = Math.exp(Math.log(IRIS_FROM) * (1 - IRIS(prog(f, 0, CUE.dotIn, E.linear))));
  const push = tw(f, 0, CUE.implodeStart, 1, 1.07, E.smooth) * mix(1, 1.12, (open - 1) / (IRIS_FROM - 1));

  // dot
  // the dot ticks with the soundtrack on every beat (k = 1..7). The first tick is the iris landing:
  // the disc arrives at marker size on it and rebounds. hitPulse peaks 2 frames after the tick.
  let tick = 0;
  for (let k = 1; k < 8; k++) tick = Math.max(tick, hitPulse(f - k * 30) * (k <= 3 ? 0.3 : 0.18));
  const dotIn = 1 + tick;
  const lineP = prog(f, CUE.lineDraw, CUE.lineDraw + 40, E.out);
  const lineRetract = prog(f, CUE.implodeStart, CUE.silence, E.in);
  const lineW = 1920 * lineP * (1 - lineRetract);

  // headline 2 slam
  const slam = prog(f, CUE.doesntFit - 1, CUE.doesntFit + 14, E.out); // first new picture on the hit frame
  const bigScale = mix(1.32, 1, slam) * tw(f, CUE.doesntFit, CUE.implodeStart, 1, 1.05, E.smooth);
  const line1Y = tw(f, CUE.doesntFit - 6, CUE.doesntFit + 16, 0, -40, E.out);

  // rain blur grows as the pile gets dense (depth of field behind the type)
  // the pile stays sharp and messy until the headline takes over, then drops into depth of field
  const rainBlur = tw(f, CUE.doesntFit - 4, CUE.doesntFit + 18, 0, 2, E.smooth);
  const rainDim = tw(f, CUE.doesntFit, CUE.doesntFit + 20, 1, 0.75, E.smooth);

  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: `scale(${push * worldScale}) rotate(${worldRot}deg)`,
          transformOrigin: '960px 540px',
          opacity: imp > 0.97 ? 0 : 1,
        }}
      >
        <HourLines f={f} />
        <AbsoluteFill style={{ filter: `blur(${rainBlur}px)`, opacity: rainDim }}>
          {RAIN.map((b) => (
            <Block key={b.i} b={b} f={f} />
          ))}
        </AbsoluteFill>
        {/* white wash under the type: only with the slam (before it the ink rain stays true ink);
            until then a tight wash holds just the first headline */}
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse 30% 13% at 50% 35%, rgba(255,255,255,0.7), rgba(255,255,255,0) 72%)',
            opacity: tw(f, CUE.yourWeek, CUE.yourWeek + 30, 0, 1, E.smooth),
          }}
        />
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse 60% 42% at 50% 52%, rgba(255,255,255,0.92), rgba(255,255,255,0) 72%)',
            opacity: tw(f, CUE.doesntFit - 8, CUE.doesntFit + 10, 0, 1, E.smooth),
          }}
        />
        {/* now line (under its label) */}
        <div style={{ position: 'absolute', left: 960 - lineW / 2, top: nowY - 1.5, width: lineW, height: 3, background: C.red }} />
        {/* now label (same pill as in the app) */}
        <div
          style={{
            position: 'absolute',
            left: 78,
            top: nowY - 16,
            padding: '5px 9px',
            borderRadius: 8,
            background: C.red,
            color: '#fff',
            fontFamily: FONT.sans,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 18,
            fontWeight: 600,
            opacity: prog(f, CUE.lineDraw + 16, CUE.lineDraw + 30) * (1 - lineRetract),
            transform: `translateX(${(1 - prog(f, CUE.lineDraw + 16, CUE.lineDraw + 34, E.out)) * 24}px)`,
          }}
        >
          {fmt(NOW)}
        </div>
        {/* line 1 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1920,
            top: 318 + line1Y,
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontSize: 128,
            fontWeight: 600,
            letterSpacing: '-0.05em',
            color: C.ink,
            lineHeight: 1,
          }}
        >
          <Words text="Your week" frame={f} start={CUE.yourWeek} stagger={9} dur={28} />
        </div>
        {/* line 2 — too big for the frame, on purpose */}
        <div
          style={{
            position: 'absolute',
            left: -400,
            width: 2720,
            top: 590,
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontSize: 430,
            fontWeight: 600,
            letterSpacing: '-0.055em',
            color: C.ink,
            lineHeight: 0.9,
            whiteSpace: 'nowrap',
            opacity: slam,
            filter: `blur(${(1 - slam) * 22}px)`,
            transform: `scale(${bigScale})`,
            transformOrigin: '1360px 180px',
          }}
        >
          doesn&rsquo;t fit.
        </div>
      </AbsoluteFill>
      {/* the dot lives outside the collapsing world */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 14,
          top: nowY - 14,
          width: 28,
          height: 28,
          borderRadius: 14,
          background: C.red,
          transform: `scale(${dotIn * open * mix(1, 1.25, imp)})`,
        }}
      />
    </AbsoluteFill>
  );
};
