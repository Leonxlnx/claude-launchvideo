import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from '../brand/tokens';
import { E, mix, prog, rand, spr, tw } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, BAR, CalendarApp, CommandBar, evRect, SEND, Token } from '../app/CalendarApp';
import { BEFORE } from '../app/data';
import { APP_VIEW } from './Act2Mark';
import { Cursor } from '../fx/Cursor';

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

const slice = (n: number): Token[] => {
  const out: Token[] = [];
  let left = n;
  for (const t of PROMPT) {
    if (left <= 0) {
      out.push({ ...t, text: '' });
      continue;
    }
    out.push({ ...t, text: t.text.slice(0, left) });
    left -= t.text.length;
  }
  return out;
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

  // camera: 0.94 (whole app) → 2.05 (command bar) → 3.3 (send button)
  const z1 = prog(f, L(CUE.zoomBar), L(CUE.zoomBar) + 50, E.inOut);
  const z2 = prog(f, L(CUE.typeEnd) - 6, L(CUE.click) - 2, E.inOut);
  const typingPush = tw(f, L(CUE.typeStart), L(CUE.typeEnd), 0, 0.12, E.smooth);
  const S = mix(mix(V.s * mix(1, 1.02, prog(f, 0, 40, E.smooth)), 2.1 + typingPush, z1), 3.4, z2);
  // focus point in app space and where it should sit on screen
  const fApp = { x: mix(focusApp.x, sendApp.x, z2), y: mix(focusApp.y, sendApp.y, z2) };
  const startScreen = { x: V.x + focusApp.x * V.s, y: V.y + focusApp.y * V.s };
  const fScreen = { x: mix(startScreen.x, 960, z1), y: mix(mix(startScreen.y, 790, z1), 600, z2) };
  const tx = fScreen.x - fApp.x * S;
  const ty = fScreen.y - fApp.y * S;
  const appBlur = mix(0, 7, z1);

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
  const tokens = slice(n);
  const chipIn = PROMPT.map((t, i) => (t.chip ? prog(f, tokenDone[i] + 1, tokenDone[i] + 12, E.out) : 0));
  const caretOn = f < L(CUE.typeStart) ? Math.floor(f / 16) % 2 === 0 : f > L(CUE.typeEnd) + 6 ? Math.floor(f / 16) % 2 === 0 : true;
  const barFocus = prog(f, L(CUE.zoomBar) + 20, L(CUE.typeStart), E.out);

  // cursor → send → click
  const clickF = L(CUE.click);
  const cur = prog(f, clickF - 34, clickF - 4, E.inOut);
  const sendScreen = { x: tx + sendApp.x * S, y: ty + sendApp.y * S };
  const curX = mix(sendScreen.x + 520, sendScreen.x + 4, cur);
  const curY = mix(sendScreen.y + 300, sendScreen.y + 6, cur);
  const press = prog(f, clickF, clickF + 4, E.out) * (1 - prog(f, clickF + 6, clickF + 14, E.out));

  // red flood from the send button
  const fl = prog(f, L(CUE.redFill) - 2, ACT.prompt.dur, E.in);
  const floodR = mix(21 * S * (1 - 0.1 * press), 2300, fl);

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.075), rgba(255,255,255,0) 70%)',
        }}
      />
      {/* app (blurred as we push in) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: APP.W,
          height: APP.H,
          transform: `translate(${tx}px, ${ty}px) scale(${S})`,
          transformOrigin: '0 0',
          filter: appBlur > 0.05 ? `blur(${appBlur / S}px)` : undefined,
        }}
      >
        <CalendarApp events={events} nowO={nowT} hideBar clashes={7} clashO={prog(f, 36, 50, E.out)} shadow={false} />
      </div>
      {/* command bar, always sharp */}
      <div
        style={{
          position: 'absolute',
          left: tx + BAR.x * S,
          top: ty + BAR.y * S,
          transform: `scale(${S})`,
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
