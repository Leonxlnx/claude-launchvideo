import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT } from '../brand/tokens';
import { E, mix, prog, spr } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, CalendarApp, COL, EvStyle, evRect, GRID, HOUR, ICON } from '../app/CalendarApp';
import { AFTER, Ev, FINAL, H0, NOW } from '../app/data';
import { APP_VIEW } from './Act2Mark';

// ACT 5 — three things it keeps doing. The app window shrinks into a card on the right
// (a live crop of the same week); a time-picker drum of lines rolls on the left.

const L = (abs: number) => abs - ACT.feat.from;
const F1 = L(CUE.feat1);
const F2 = L(CUE.feat2);
const F3 = L(CUE.feat3);

export const LINES = ['Moves meetings.', 'Guards your focus.', 'Replans in real time.'];

// camera helpers ----------------------------------------------------------------------
type Box = { x: number; y: number; w: number; h: number };
const region = (d0: number, d1: number, h0: number, h1: number): Box => ({
  x: GRID.x + d0 * COL,
  y: GRID.y + (h0 - H0) * HOUR,
  w: (d1 - d0) * COL,
  h: (h1 - h0) * HOUR,
});
const CARD: Box = { x: 900, y: 120, w: 940, h: 840 };
const FULL: Box = { x: APP_VIEW.x, y: APP_VIEW.y, w: APP.W * APP_VIEW.s, h: APP.H * APP_VIEW.s };
const lerpB = (a: Box, b: Box, t: number): Box => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });

// app-space box that the card shows, per feature
// crops are aligned to column gutters so no half-cut blocks hang on the card edge
const R1 = region(3, 5, 12.85, 17.3); // Thu–Fri afternoon
const R2 = region(3, 5, 8.75, 13.2); // Thu–Fri morning
const R3 = region(-0.3, 2, 12.7, 17.7); // Mon–Tue afternoon (today), with the hour gutter
const RFULL: Box = { x: 0, y: 0, w: APP.W, h: APP.H };

const fit = (r: Box, card: { w: number; h: number }, zoom = 1) => {
  const k = Math.min(card.w / r.w, card.h / r.h) * zoom;
  return { k, x: card.w / 2 - (r.x + r.w / 2) * k, y: card.h / 2 - (r.y + r.h / 2) * k };
};

// --------------------------------------------------------------------------------------
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
        transform: `scale(${check})`,
        zIndex: 20,
      }}
    >
      <svg width={8} height={8} viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON.check} />
      </svg>
    </div>
  </div>
);

export const Act5Features: React.FC = () => {
  const f = useCurrentFrame();

  // ---- card morph from the full window ---------------------------------------------
  const into = prog(f, 0, 44, E.inOut);
  const back = prog(f, ACT.feat.dur - 36, ACT.feat.dur, E.glide);
  const card = lerpB(lerpB(FULL, CARD, into), FULL, back);
  // which region the card shows (continuous camera between features)
  const toR2 = prog(f, F2 - 14, F2 + 20, E.inOut);
  const toR3 = prog(f, F3 - 14, F3 + 20, E.inOut);
  const rNow = lerpB(lerpB(lerpB(lerpB(RFULL, R1, into), R2, toR2), R3, toR3), RFULL, back);
  const drift = mix(mix(1, 1.07, f / ACT.feat.dur), 1, back);
  const bump = (at: number) => (f >= at && f < at + 14 ? Math.sin(((f - at) / 14) * Math.PI) : 0);
  const cardPunch = 1 + 0.015 * (bump(F1 + 76) + bump(F2 + 44) + bump(F3 + 26));
  const cam = fit(rNow, card, drift);

  // ---- events per feature -------------------------------------------------------------
  const ev = (id: string) => AFTER.find((e) => e.id === id)!;
  const styled: { ev: Ev; s: EvStyle; key?: string }[] = [];
  const lift1 = prog(f, F1 + 30, F1 + 42, E.out);
  const move1 = prog(f, F1 + 40, F1 + 76, E.inOut);
  const land1 = prog(f, F1 + 70, F1 + 76, E.in);
  // feature 3: time-lapse to the afternoon; the design review overruns 30 min and Monday re-flows.
  // Times are interpolated and rounded to 5 minutes, so the labels roll with the blocks.
  const nowT = mix(mix(NOW, 13.97, prog(f, F3 - 6, F3 + 26, E.inOut)), 14.3, prog(f, F3 + 26, ACT.feat.dur, E.linear));
  const late = prog(f, F3 + 26, F3 + 64, E.inOut);
  const shift = prog(f, F3 + 34, F3 + 80, E.inOut);
  const r5 = (h: number) => Math.round(h * 12) / 12;

  for (const e of AFTER) {
    const r = evRect(e);
    const s: EvStyle = { rect: r };
    if (e.id === 'th-road') {
      const target = evRect({ ...e, day: 4, start: 15, end: 16 });
      s.rect = { x: mix(r.x, target.x, move1), y: mix(r.y, target.y, move1), w: r.w, h: r.h };
      s.z = (lift1 * 40 + Math.sin(Math.PI * move1) * 20) * (1 - land1);
      s.scale = 1 + 0.04 * lift1 * (1 - land1);
      s.rot = -2.5 * lift1 * (1 - land1);
      s.ring = prog(f, F1 + 74, F1 + 78) * (1 - prog(f, F1 + 90, F1 + 112, E.smooth));
      styled.push({ ev: { ...e, start: mix(14, 15, move1 > 0.5 ? 1 : 0), end: mix(15, 16, move1 > 0.5 ? 1 : 0) }, s });
      continue;
    }
    const fin = FINAL.find((x) => x.id === e.id)!;
    if (e.day === 0 && (fin.start !== e.start || fin.end !== e.end)) {
      const t = e.id === 'mo-design' ? late : shift;
      const start = r5(mix(e.start, fin.start, t));
      const end = r5(mix(e.end, fin.end, t));
      const moved = { ...e, start, end };
      const rr = evRect({ ...e, start: mix(e.start, fin.start, t), end: mix(e.end, fin.end, t) });
      if (e.id === 'mo-design') s.glow = prog(f, F3 + 26, F3 + 34) * (1 - prog(f, F3 + 70, F3 + 90));
      styled.push({ ev: moved, s: { ...s, rect: rr } });
      continue;
    }
    styled.push({ ev: e, s });
  }

  // ---- overlays in app space ------------------------------------------------------------
  const road = styled.find((x) => x.ev.id === 'th-road')!.s.rect;
  // availability checks pop one by one once the block has landed
  const checks = ['MR', 'JL', 'PS', 'AK'].map((_, i) => spr(f, F1 + 78 + i * 5, { damping: 12, stiffness: 220, mass: 0.5 }));
  const avatarsO = prog(f, F1 + 24, F1 + 36) * (1 - prog(f, F2 - 16, F2 - 4));

  // feature 2: invite card flies at the focus block, bounces, re-routes
  const inv = prog(f, F2 + 16, F2 + 44, E.out);
  const bounce = f > F2 + 44 ? Math.exp(-(f - F2 - 44) / 6) * Math.sin((f - F2 - 44) / 2.2) : 0;
  const away = prog(f, F2 + 70, F2 + 96, E.inOut);
  const tuFocus = evRect(ev('th-focus'));
  const invX = mix(tuFocus.x + tuFocus.w + 330, tuFocus.x + tuFocus.w - 70, inv) + bounce * 30 + away * 420;
  const invY = tuFocus.y + 46 + away * 120;
  const shieldO = prog(f, F2 + 40, F2 + 50) * (1 - prog(f, F3 - 12, F3));
  const replied = prog(f, F2 + 52, F2 + 64, E.out);
  const invO = prog(f, F2 + 12, F2 + 20) * (1 - prog(f, F2 + 90, F2 + 104));

  // feature 3 "+30 min" tag
  const all = styled.find((x) => x.ev.id === 'mo-design')!.s.rect;
  const lateO = prog(f, F3 + 30, F3 + 40) * (1 - prog(f, ACT.feat.dur - 24, ACT.feat.dur - 8));

  const overlay = (
    <div style={{ position: 'absolute', left: GRID.x, top: GRID.y, width: GRID.w, height: GRID.h, pointerEvents: 'none' }}>
      {/* F1 attendees */}
      <div style={{ position: 'absolute', left: road.x + 12, top: road.y + road.h - 34, height: 26, width: 120, opacity: avatarsO }}>
        {['MR', 'JL', 'PS', 'AK'].map((a, i) => (
          <Avatar key={a} i={a} check={checks[i]} x={i * 22} z={10 - i} />
        ))}
      </div>
      {/* F2 shield label on focus */}
      <div
        style={{
          position: 'absolute',
          left: tuFocus.x + 11,
          top: tuFocus.y + tuFocus.h - 40,
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
          opacity: shieldO,
        }}
      >
        <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x={3.5} y={7} width={9} height={7} rx={1.6} />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
        Protected
      </div>
      {/* F2 invite card */}
      <div
        style={{
          position: 'absolute',
          left: invX,
          top: invY,
          width: 210,
          padding: '12px 14px',
          borderRadius: 12,
          background: '#fff',
          boxShadow: '0 16px 36px rgba(11,11,12,0.16), 0 0 0 1px rgba(11,11,12,0.06)',
          fontFamily: FONT.sans,
          opacity: invO,
          transform: `rotate(${bounce * 3}deg)`,
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>Quick sync?</div>
        <div style={{ fontFamily: FONT.sans, fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 460, color: C.mute, marginTop: 3 }}>Leo · Thu 10:30</div>
        <div
          style={{
            marginTop: 10,
            height: 26,
            borderRadius: 7,
            background: mix(0, 1, replied) > 0.5 ? C.ink : '#F1F2F4',
            color: replied > 0.5 ? '#fff' : C.mute2,
            fontSize: 11.5,
            fontWeight: 560,
            display: 'flex',
            alignItems: 'center',
            padding: '0 9px',
            gap: 6,
          }}
        >
          {replied > 0.5 ? (
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
      {/* F3 running late tag */}
      <div
        style={{
          position: 'absolute',
          left: all.x + all.w - 70,
          top: all.y + 8,
          padding: '3px 8px',
          borderRadius: 6,
          background: C.red,
          color: '#fff',
          fontFamily: FONT.sans,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 11.5,
          fontWeight: 600,
          opacity: lateO,
          transform: `scale(${mix(0.8, 1, lateO)})`,
        }}
      >
        +30 min
      </div>
    </div>
  );

  // ---- drum of lines --------------------------------------------------------------------
  const step = toR2 + toR3;
  const drumIn = prog(f, 26, 54, E.out);
  const drumOut = prog(f, ACT.feat.dur - 40, ACT.feat.dur - 14, E.in);

  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: '#E7E8EC', opacity: 1 - prog(f, 0, 36, E.smooth) }} />
      {/* drum — a 2D cylinder projection: no perspective shear, so no fake italics */}
      <div style={{ position: 'absolute', left: 110, top: 540, width: 780, height: 0, opacity: drumIn * (1 - drumOut) }}>
        {LINES.map((line, i) => {
          const d = i - step - (1 - drumIn) * -1.2;
          const ang = Math.max(-80, Math.min(80, d * 30)) * (Math.PI / 180);
          const R = 250;
          const vis = Math.max(0, 1 - Math.abs(d) * 0.62);
          const active = Math.max(0, 1 - Math.abs(d));
          const c = Math.round(mix(190, 11, active));
          return (
            <div
              key={line}
              style={{
                position: 'absolute',
                left: 0,
                top: -52,
                height: 104,
                display: 'flex',
                alignItems: 'center',
                fontFamily: FONT.sans,
                fontSize: 80,
                fontWeight: 600,
                letterSpacing: '-0.05em',
                whiteSpace: 'nowrap',
                color: `rgb(${c},${c},${Math.round(mix(196, 12, active))})`,
                transformOrigin: '0 50%',
                transform: `translateY(${Math.sin(ang) * R}px) scaleY(${Math.cos(ang)})`,
                opacity: vis,
                filter: `blur(${Math.abs(d) * 2.2}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
      {/* card = a live crop of the app */}
      <div
        style={{
          position: 'absolute',
          left: card.x,
          top: card.y,
          width: card.w,
          height: card.h,
          borderRadius: mix(mix(APP.R * APP_VIEW.s, 30, into), APP.R * APP_VIEW.s, back),
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 0 0 1px rgba(11,11,12,0.06), 0 40px 80px -20px rgba(11,11,12,0.18), 0 12px 30px -10px rgba(11,11,12,0.10)',
          transform: `scale(${cardPunch})`,

        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: APP.W,
            height: APP.H,
            transformOrigin: '0 0',
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`,
          }}
        >
          <CalendarApp events={styled} overlay={overlay} shadow={false} clashes={12} clashO={1} resolved={1} status={1} prioIn={[1, 1, 1]} nowO={1} now={nowT} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
