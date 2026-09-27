import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT } from '../brand/tokens';
import { E, mix, prog, spr, SPR, tw } from '../lib/anim';
import { Words } from '../fx/Words';
import { CUE } from '../timeline';
import { ACT1, RAIN, RainBlock } from './act1-data';

// ACT 1 — "Your week doesn't fit."
// A red dot (now) draws the day, meetings rain in, the headline overflows the frame,
// then everything implodes back into the dot.

const { colW, hourH, nowY, now } = ACT1;
const yOf = (h: number) => nowY + (h - now) * hourH;

const Block: React.FC<{ b: RainBlock; f: number }> = ({ b, f }) => {
  const t = f - b.land;
  if (t < -16) return null;
  // fall: accelerate in over 16 frames, then a small damped settle
  const fall = t < 0 ? Math.pow((t + 16) / 16, 2.2) : 1;
  const settle = t >= 0 ? Math.exp(-t / 5) * Math.sin(t / 2.2) * 10 : 0;
  const y0 = yOf(b.start);
  const y = mix(-260 - (y0 + 60), 0, fall) - settle;
  const rot = (1 - fall) * b.rot;
  const x = b.day * colW + 6 + b.jx * 0.25;
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
        <div style={{ fontFamily: FONT.mono, fontSize: 15, marginTop: 4, color: b.ink ? 'rgba(255,255,255,0.55)' : C.mute }}>
          {String(Math.floor(b.start)).padStart(2, '0')}:{b.start % 1 ? '30' : '00'}
        </div>
      )}
    </div>
  );
};

const HourLines: React.FC<{ f: number }> = ({ f }) => {
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14];
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
                left: 34,
                top: y + 10,
                fontFamily: FONT.mono,
                fontSize: 17,
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

  // slow push-in over the whole act
  const push = tw(f, 0, CUE.implodeStart, 1, 1.07, E.smooth);

  // dot
  const dotIn = spr(f, CUE.dotIn, SPR.pop);
  const lineP = prog(f, CUE.lineDraw, CUE.lineDraw + 40, E.out);
  const lineRetract = prog(f, CUE.implodeStart, CUE.silence, E.in);
  const lineW = 1920 * lineP * (1 - lineRetract);

  // headline 2 slam
  const slam = prog(f, CUE.doesntFit, CUE.doesntFit + 14, E.out);
  const bigScale = mix(1.32, 1, slam) * tw(f, CUE.doesntFit, CUE.implodeStart, 1, 1.05, E.smooth);
  const line1Y = tw(f, CUE.doesntFit - 6, CUE.doesntFit + 16, 0, -40, E.out);

  // rain blur grows as the pile gets dense (depth of field behind the type)
  const rainBlur = tw(f, CUE.yourWeek, CUE.doesntFit + 20, 0, 3.5, E.smooth);
  const rainDim = tw(f, CUE.doesntFit, CUE.doesntFit + 20, 1, 0.55, E.smooth);

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
        {/* white wash under the type keeps it legible over the pile */}
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse 60% 42% at 50% 52%, rgba(255,255,255,0.92), rgba(255,255,255,0) 72%)',
            opacity: tw(f, CUE.yourWeek, CUE.doesntFit, 0, 1, E.smooth),
          }}
        />
        {/* now line */}
        <div style={{ position: 'absolute', left: 960 - lineW / 2, top: nowY - 1.5, width: lineW, height: 3, background: C.red }} />
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
            fontWeight: 590,
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
            fontWeight: 640,
            letterSpacing: '-0.06em',
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
          transform: `scale(${dotIn * mix(1, 1.25, imp)})`,
        }}
      />
    </AbsoluteFill>
  );
};
