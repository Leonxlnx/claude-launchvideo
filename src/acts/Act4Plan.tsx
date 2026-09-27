import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT } from '../brand/tokens';
import { E, mix, prog, rand, spr, tw } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, CalendarApp, COL, EventBlock, evRect, GRID, HOUR, ICON, Rect } from '../app/CalendarApp';
import { AFTER, BEFORE, Ev, H0, NOW, TODAY } from '../app/data';
import { APP_VIEW } from './Act2Mark';

// ACT 4 — the fitting. The red field collapses into "now" on a tabletop view of the week.
// Every block lifts, flies to its new slot and lands; declined ones drift off to next week;
// focus blocks drop in heavy. Then the camera straightens on a clean week.

const L = (abs: number) => abs - ACT.plan.from;

const NOW_APP = { x: GRID.x + TODAY * COL, y: GRID.y + (NOW - H0) * HOUR };
const CENTER_APP = { x: APP.W / 2, y: APP.H / 2 };

type Plan = {
  id: string;
  b?: Ev;
  a?: Ev;
  t0: number; // lift start
  t1: number; // travel start
  t2: number; // land
  zUp: number;
  wob: number;
};

// choreography — computed once
const PLANS: Plan[] = (() => {
  const ids = Array.from(new Set([...BEFORE.map((e) => e.id), ...AFTER.map((e) => e.id)]));
  const moving = ids.filter((id) => BEFORE.some((e) => e.id === id) && AFTER.some((e) => e.id === id));
  const landFrom = L(CUE.landingsFrom) + 40;
  const landTo = L(CUE.landingsTo) - 12;
  return ids.map((id) => {
    const b = BEFORE.find((e) => e.id === id);
    const a = AFTER.find((e) => e.id === id);
    const r = (n: number) => rand(`${id}-${n}`);
    const lift = L(CUE.landingsFrom) - 8 + (b ? b.day * 3 + (b.start - 9) * 1.2 : 0);
    const k = moving.indexOf(id);
    let t2: number;
    if (b && a) t2 = landFrom + (k / Math.max(1, moving.length - 1)) * (landTo - landFrom - 26) + r(1) * 4;
    else if (a) {
      // newcomers land last, focus blocks as a heavy final beat
      const late = ['mo-focus', 'tu-focus', 'th-focus', 'fr-deck', 'tu-gym', 'th-gym'].indexOf(id);
      t2 = landTo - 24 + late * 5;
    } else t2 = lift + 40;
    return {
      id,
      b,
      a,
      t0: lift,
      t1: lift + 14,
      t2: Math.round(Math.round(t2 / 7.5) * 7.5),
      zUp: 70 + r(2) * 60,
      wob: (r(3) - 0.5) * 7,
    };
  });
})();

// absolute landing frames for the soundtrack
export const LANDINGS = PLANS.filter((p) => p.a).map((p) => ({ f: p.t2 + ACT.plan.from, heavy: !p.b || p.a?.kind === 'focus' }));

const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });

export const Act4Plan: React.FC = () => {
  const f = useCurrentFrame();

  // --- red field collapses into the now dot (screen center) --------------------------
  const col = prog(f, 0, 20, E.inOut);
  const redR = mix(2300, 5, col);

  // --- camera -----------------------------------------------------------------------
  const st = prog(f, L(CUE.straighten), L(CUE.straighten) + 64, E.inOut);
  const orbit = prog(f, 0, L(CUE.straighten) + 10, E.smooth);
  const rx = mix(mix(48, 38, orbit), 0, st);
  const rz = mix(mix(-26, -14, orbit), 0, st);
  const s = mix(mix(1.75, 1.22, prog(f, 0, L(CUE.straighten), E.smooth)), APP_VIEW.s, st);
  const O = { x: mix(NOW_APP.x, CENTER_APP.x, st), y: mix(NOW_APP.y, CENTER_APP.y, st) };
  const P = { x: mix(960, 960, st), y: mix(470, 540, st) };

  // --- blocks -----------------------------------------------------------------------
  const blocks: { ev: Ev; s: Parameters<typeof EventBlock>[0]['s']; key: string; shadow: { r: Rect; z: number } }[] = [];
  for (const p of PLANS) {
    const rb = p.b ? evRect(p.b) : undefined;
    const ra = p.a ? evRect(p.a) : undefined;
    const lift = prog(f, p.t0, p.t1, E.out);
    if (rb && ra) {
      const tp = prog(f, p.t1, p.t2, E.inOut);
      const drop = prog(f, p.t2 - 10, p.t2, E.in);
      const arc = Math.sin(Math.PI * tp) * 50;
      const z = (p.zUp * lift + arc) * (1 - drop);
      const bounce = f > p.t2 ? Math.exp(-(f - p.t2) / 4) * Math.sin((f - p.t2) / 1.6) * 0.035 : 0;
      const rect = lerpRect(rb, ra, tp);
      const rot = p.wob * lift * (1 - drop);
      const flash = f >= p.t2 ? Math.exp(-(f - p.t2) / 9) : 0;
      if (p.b!.kind !== p.a!.kind) {
        blocks.push({ key: p.id + ':b', ev: p.b!, s: { rect, z, rot, opacity: 1 - prog(f, p.t1 + 10, p.t2 - 10), scale: 1 - bounce }, shadow: { r: rect, z } });
        blocks.push({ key: p.id + ':a', ev: p.a!, s: { rect, z: z + 0.5, rot, opacity: prog(f, p.t1 + 10, p.t2 - 10), scale: 1 - bounce, glow: flash }, shadow: { r: rect, z: -1 } });
      } else {
        blocks.push({ key: p.id, ev: tp > 0.5 ? p.a! : p.b!, s: { rect, z, rot, scale: 1 - bounce, glow: flash }, shadow: { r: rect, z } });
      }
    } else if (rb) {
      // declined / moved to next week: rise and drift off to the right
      const go = prog(f, p.t1, p.t1 + 46, E.in);
      const rect = { ...rb, x: rb.x + go * (900 + rb.x * 0.3), y: rb.y - go * 80 };
      const z = p.zUp * lift + go * 260;
      blocks.push({ key: p.id, ev: p.b!, s: { rect, z, rot: p.wob * lift + go * 8, opacity: 1 - prog(f, p.t1 + 22, p.t1 + 46) }, shadow: { r: rect, z } });
    } else if (ra) {
      // newcomers fall in from high above
      const appear = prog(f, p.t2 - 30, p.t2 - 22);
      const drop = prog(f, p.t2 - 30, p.t2, E.in);
      const z = mix(650, 0, drop);
      const bounce = f > p.t2 ? Math.exp(-(f - p.t2) / 4) * Math.sin((f - p.t2) / 1.6) * 0.05 : 0;
      const flash = f >= p.t2 ? Math.exp(-(f - p.t2) / 10) : 0;
      if (appear > 0) blocks.push({ key: p.id, ev: p.a!, s: { rect: ra, z, opacity: appear, scale: 1 - bounce, glow: flash }, shadow: { r: ra, z } });
    }
  }

  // ground shadows (drawn on the grid plane)
  const shadows = blocks
    .filter((b) => b.shadow.z > 1 && (b.s.opacity ?? 1) > 0.02)
    .map((b) => {
      const z = b.shadow.z;
      const k = Math.min(1, z / 200);
      return (
        <div
          key={'sh-' + b.key}
          style={{
            position: 'absolute',
            left: b.shadow.r.x + z * 0.1,
            top: b.shadow.r.y + z * 0.22,
            width: b.shadow.r.w,
            height: b.shadow.r.h,
            borderRadius: 10,
            background: `rgba(11,11,12,${(0.2 - 0.1 * k) * (b.s.opacity ?? 1)})`,
            filter: `blur(${3 + z * 0.06}px)`,
          }}
        />
      );
    });

  // UI feedback once the week settles
  const done = prog(f, L(CUE.toast), L(CUE.toast) + 18, E.out);
  const toastOut = prog(f, ACT.plan.dur - 14, ACT.plan.dur, E.in);
  const prioIn = [0, 1, 2].map((i) => prog(f, L(CUE.toast) + 4 + i * 5, L(CUE.toast) + 22 + i * 5, E.out));

  return (
    <AbsoluteFill style={{ background: '#E7E8EC', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 65% 60% at 50% 40%, #F7F8FA, rgba(247,248,250,0) 75%)' }} />
      <div
        style={{
          position: 'absolute',
          left: P.x - O.x,
          top: P.y - O.y,
          width: APP.W,
          height: APP.H,
          transformOrigin: `${O.x}px ${O.y}px`,
          transform: `perspective(2600px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s})`,
          transformStyle: 'preserve-3d',
        }}
      >
        <CalendarApp
          events={blocks.map((b) => ({ ev: b.ev, s: b.s, key: b.key }))}
          gridChildren={shadows}
          clashes={7}
          clashO={1}
          resolved={done}
          prioIn={prioIn}
          noLiftShadow
        />
        {/* toast */}
        <div
          style={{
            position: 'absolute',
            left: GRID.x + GRID.w / 2 - 170,
            top: 960 - 64 - 28 - 62,
            width: 340,
            height: 46,
            borderRadius: 23,
            background: C.ink,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px 0 14px',
            boxSizing: 'border-box',
            fontFamily: FONT.sans,
            fontSize: 14.5,
            fontWeight: 540,
            letterSpacing: '-0.01em',
            opacity: done * (1 - toastOut),
            transform: `translateY(${(1 - done) * 16 + toastOut * 8}px) scale(${mix(0.94, 1, done)})`,
            boxShadow: '0 12px 30px rgba(11,11,12,0.25)',
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 11, background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d={ICON.check} />
            </svg>
          </div>
          Week planned
          <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 460, marginLeft: 'auto' }}>14 moved · 0 clashes</span>
        </div>
      </div>
      {/* red field → dot */}
      {redR > 6 && (
        <div
          style={{
            position: 'absolute',
            left: P.x - redR,
            top: P.y - redR,
            width: redR * 2,
            height: redR * 2,
            borderRadius: '50%',
            background: C.red,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
