import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from '../brand/tokens';
import { E, mix, prog, rand, spr, tw } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, BAR, CalendarApp, CommandBar, evRect, SEND, Token } from '../app/CalendarApp';
import { BEFORE } from '../app/data';
import { APP_VIEW } from './Act2Mark';
import { Cursor } from '../fx/Cursor';
import { RackFocus } from '../fx/RackFocus';

// ACT 3 — the week loads (overbooked), we push into the command bar,
// type what matters, click the red dot, and it floods the frame.

const L = (abs: number) => abs - ACT.prompt.from;

// ---- typing schedule ----------------------------------------------------------------
export const PROMPT: Token[] = [
  { text: 'Protect my ' },
  { text: 'mornings', chip: true },
  { text: '. ' },
  { text: 'Gym Tue + Thu', chip: true },
  { text: '. Ship the deck by ' },
  { text: 'Friday', chip: true },
  { text: '.' },
];
const FULL = PROMPT.map((t) => t.text).join('');

// frame (local) at which each character appears
export const CHAR_AT: number[] = (() => {
  const out: number[] = [];
  const start = L(CUE.typeStart);
  const end = L(CUE.typeEnd);
  const weights = [...FULL].map((ch, i) => {
    let w = 0.75 + rand(`k${i}`) * 0.6;
    if (ch === ' ') w *= 0.7;
    if (FULL[i - 1] === '.') w += 2.2; // breath after a sentence
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const w of weights) {
    acc += w;
    out.push(start + (acc / total) * (end - start));
  }
  return out;
})();

// absolute frames for key clicks (exported for the soundtrack)
export const KEY_FRAMES = CHAR_AT.map((c) => Math.round(c + ACT.prompt.from));

const typed = (f: number) => CHAR_AT.filter((c) => c <= f).length;

// newest characters arrive in the accent ("now") and relax to ink — colour means "just happened"
const ink = (age: number) => {
  const k = Math.max(0, Math.min(1, age / 12));
  const e = 1 - Math.pow(1 - k, 2);
  const r = Math.round(236 + (11 - 236) * e);
  const g = Math.round(42 + (11 - 42) * e);
  const b = Math.round(58 + (12 - 58) * e);
  return `rgb(${r},${g},${b})`;
};

// tokens for the visible prompt; plain text is split per character so each can carry its own ink
const slice = (n: number, f: number): { tokens: Token[]; chipIndex: number[] } => {
  const tokens: Token[] = [];
  const chipIndex: number[] = [];
  let idx = 0;
  PROMPT.forEach((t, ti) => {
    const vis = Math.max(0, Math.min(t.text.length, n - idx));
    if (t.chip) {
      tokens.push({ text: t.text.slice(0, vis), chip: true, color: vis ? ink(f - CHAR_AT[idx + vis - 1]) : undefined });
      chipIndex.push(ti);
    } else {
      for (let c = 0; c < vis; c++) {
        tokens.push({ text: t.text[c], color: ink(f - CHAR_AT[idx + c]) });
        chipIndex.push(-1);
      }
    }
    idx += t.text.length;
  });
  return { tokens, chipIndex };
};

// frame each token finishes (for chip pop)
const tokenDone = (() => {
  let idx = 0;
  return PROMPT.map((t) => {
    idx += t.text.length;
    return CHAR_AT[idx - 1];
  });
})();

// ---- camera -------------------------------------------------------------------------
const V = APP_VIEW;
const focusApp = { x: BAR.x + BAR.w / 2, y: BAR.y + BAR.h / 2 };
const sendApp = { x: SEND.x, y: SEND.y };

export const Act3Prompt: React.FC = () => {
  const f = useCurrentFrame();

  // Camera. The app stays behind at a parallax scale (blurred, filling the frame) while the
  // command bar lifts off it toward the lens and floats to frame centre; then a macro onto send.
  const z1 = prog(f, L(CUE.zoomBar), L(CUE.zoomBar) + 54, E.cam);
  const z2 = prog(f, L(CUE.typeEnd) - 4, L(CUE.click) - 2, E.inOut);
  const typingPush = tw(f, L(CUE.typeStart), L(CUE.typeEnd), 0, 0.1, E.smooth);
  const breathe = mix(1, 1.02, prog(f, 0, 40, E.smooth));
  // app layer
  const SA = mix(mix(V.s * breathe, 1.6, z1), 1.78, z2);
  const startScreen = { x: V.x + focusApp.x * V.s * breathe, y: V.y + focusApp.y * V.s * breathe };
  const aScreen = { x: mix(startScreen.x, 960, z1), y: mix(mix(startScreen.y, 1045, z1), 1080, z2) };
  const tx = aScreen.x - focusApp.x * SA;
  const ty = aScreen.y - focusApp.y * SA;
  // bar layer (its own transform: lifted in Z)
  const SB = mix(mix(V.s * breathe, 2.12 + typingPush, z1), 3.5, z2);
  const barFocusApp = { x: mix(focusApp.x, sendApp.x, z2), y: mix(focusApp.y, sendApp.y, z2) };
  const bScreen = { x: mix(startScreen.x, 960, z1) + mix(0, 150, z2), y: mix(startScreen.y, 590, z1) };
  const bx = bScreen.x - barFocusApp.x * SB;
  const by = bScreen.y - barFocusApp.y * SB;
  const lift = z1;
  const appDim = mix(0, 0.18, z1);

  // week loads: events cascade in, column by column
  const events = BEFORE.map((ev) => {
    const at = 2 + ev.day * 3 + (ev.start - 9) * 1.6;
    const p = prog(f, at, at + 16, E.out);
    const sp = spr(f, at, { damping: 15, stiffness: 240, mass: 0.6 });
    const r = evRect(ev);
    return { ev, s: { rect: { ...r, y: r.y - (1 - sp) * 14 }, opacity: p, glow: 0 } };
  });
  // clashes flash once the week is in
  const clashT = prog(f, 34, 46, E.out) * (1 - 0.5 * prog(f, 52, 70, E.smooth));
  for (const e of events) if ((e.ev.lanes ?? 1) > 1) e.s.glow = clashT;
  const nowT = prog(f, 4, 34, E.out);

  // typing
  const n = typed(f);
  const { tokens, chipIndex } = slice(n, f);
  const chipIn = chipIndex.map((ti) => (ti >= 0 ? prog(f, tokenDone[ti] + 1, tokenDone[ti] + 12, E.out) : 0));
  const caretOn = f < L(CUE.typeStart) ? Math.floor(f / 16) % 2 === 0 : f > L(CUE.typeEnd) + 6 ? Math.floor(f / 16) % 2 === 0 : true;
  const barFocus = prog(f, L(CUE.zoomBar) + 20, L(CUE.typeStart), E.out);

  // cursor → send → click
  const clickF = L(CUE.click);
  const cur = prog(f, clickF - 26, clickF + 3, E.out);
  const sendScreen = { x: bx + sendApp.x * SB, y: by + sendApp.y * SB };
  // quadratic bezier from lower right, bowing upward, landing on the button
  const p0 = { x: sendScreen.x + 560, y: sendScreen.y + 360 };
  const p1 = { x: sendScreen.x + 140, y: sendScreen.y + 300 };
  const p2 = { x: sendScreen.x + 6, y: sendScreen.y + 8 };
  const q = (a: number, b: number, c: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const curX = q(p0.x, p1.x, p2.x, cur);
  const curY = q(p0.y, p1.y, p2.y, cur);
  const squash = prog(f, clickF, clickF + 4, E.out);
  const recoil = prog(f, clickF + 4, clickF + 12, E.out);
  const press = squash * (1 - recoil) * 1.8 - recoil * 0.6 * (1 - prog(f, clickF + 12, clickF + 20, E.smooth));

  // red flood from the send button
  const fl = prog(f, L(CUE.redFill), ACT.prompt.dur, E.in);
  const floodR = mix(21 * SB * (1 - 0.1 * press), 2300, fl);

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.075), rgba(255,255,255,0) 70%)',
        }}
      />
      {/* app: racks out of focus as the bar lifts (cross-faded, so the blur never snaps) */}
      <RackFocus
        t={z1}
        blur={10}
        render={() => (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: APP.W,
              height: APP.H,
              transform: `translate(${tx}px, ${ty}px) scale(${SA})`,
              transformOrigin: '0 0',
            }}
          >
            <CalendarApp events={events} nowO={1} lineT={nowT} hideBar clashes={12} clashO={prog(f, 36, 50, E.out)} shadow={false} />
          </div>
        )}
      />
      <AbsoluteFill style={{ background: C.ink, opacity: appDim }} />
      {/* command bar, always sharp */}
      <div
        style={{
          position: 'absolute',
          left: bx + BAR.x * SB,
          top: by + BAR.y * SB,
          transform: `scale(${SB})`,
          filter: `drop-shadow(0 ${30 * lift}px ${50 * lift}px rgba(11,11,12,${0.22 * lift}))`,
          transformOrigin: '0 0',
        }}
      >
        <CommandBar text={tokens} caret={caretOn} chipIn={chipIn} press={press} focus={barFocus} />
      </div>
      <Cursor x={curX} y={curY} scale={mix(1.4, 2.2, z2)} press={press} opacity={prog(f, clickF - 34, clickF - 26)} />
      {/* flood */}
      {fl > 0 && (
        <div
          style={{
            position: 'absolute',
            left: sendScreen.x - floodR,
            top: sendScreen.y - floodR,
            width: floodR * 2,
            height: floodR * 2,
            borderRadius: '50%',
            background: C.red,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
