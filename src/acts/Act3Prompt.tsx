import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C } from '../brand/tokens';
import { E, mix, prog, rand, tw } from '../lib/anim';
import { ACT, CUE } from '../timeline';
import { APP, BAR, CalendarApp, CommandBar, SEND, Token } from '../app/CalendarApp';
import { BEFORE } from '../app/data';
import { APP_VIEW } from './Act2Mark';
import { weekLoad } from '../app/weekLoad';
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
      // a chip only exists once its first character is typed (an empty chip would push the caret)
      if (vis > 0) {
        tokens.push({ text: t.text.slice(0, vis), chip: true, color: ink(f - CHAR_AT[idx + vis - 1]) });
        chipIndex.push(ti);
      }
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

export const CLASH_AT = 4; // act-local frame the first day's clashes flash (on the bar-6 downbeat)
export const CLASH_STEP = 2.5; // frames between days
export const CLASH_DAYS = [...new Set(BEFORE.filter((e) => (e.lanes ?? 1) > 1).map((e) => e.day))].sort((a, b) => a - b);

export const Act3Prompt: React.FC = () => {
  const f = useCurrentFrame();

  // Camera. The app stays behind at a parallax scale (blurred, filling the frame) while the
  // command bar lifts off it toward the lens and floats to frame centre; then a macro onto send.
  const z1 = prog(f, L(CUE.zoomBar), L(CUE.zoomBar) + 54, E.cam);
  const z2 = prog(f, L(CUE.typeEnd) - 4, L(CUE.click) - 2, E.inOut);
  const typingPush = tw(f, L(CUE.typeStart), L(CUE.typeEnd), 0, 0.16, E.smooth);
  // while typing, the defocused app keeps drifting under the bar (parallax), never a locked-off frame
  const typeT = prog(f, L(CUE.typeStart) - 10, L(CUE.click), E.linear);
  const breathe = mix(1, 1.02, prog(f, 0, 40, E.smooth));
  // app layer
  const SA = mix(mix(V.s * breathe, 1.6, z1), 1.78, z2);
  const startScreen = { x: V.x + focusApp.x * V.s * breathe, y: V.y + focusApp.y * V.s * breathe };
  const aScreen = { x: mix(startScreen.x, 960, z1), y: mix(mix(startScreen.y, 1045, z1), 1080, z2) };
  // once the push starts, the (defocused) app keeps covering the frame horizontally: the bar sits
  // right of the app's centre, so centring on it would otherwise leave the window's right edge in shot
  const cover = prog(f, L(CUE.zoomBar), L(CUE.zoomBar) + 12, E.smooth);
  const txRaw = aScreen.x - focusApp.x * SA;
  const appW = APP.W * SA;
  const txFit = appW >= 2000 ? Math.min(-40, Math.max(1960 - appW, txRaw)) : (1920 - appW) / 2;
  const tx = mix(txRaw, txFit, cover);
  const ty = aScreen.y - focusApp.y * SA;
  // bar layer (its own transform: lifted in Z)
  const SB = mix(mix(V.s * breathe, 2.12 + typingPush, z1), 3.5, z2);
  const barFocusApp = { x: mix(focusApp.x, sendApp.x, z2), y: mix(focusApp.y, sendApp.y, z2) };
  const bScreen = { x: mix(startScreen.x, 960, z1) + mix(0, 150, z2), y: mix(startScreen.y, 590, z1) };
  const bx = bScreen.x - barFocusApp.x * SB;
  const by = bScreen.y - barFocusApp.y * SB;
  const lift = z1;
  const appDim = mix(0, 0.1, z1);

  // the week has loaded while the app flew in (Act 2 shows the same cascade)
  const events = weekLoad(ACT.prompt.from + f);
  // clashes flash once the week is in
  // clashes flash day by day (one conflict blip per day in the soundtrack)
  for (const e of events)
    if ((e.ev.lanes ?? 1) > 1) {
      const at = CLASH_AT + e.ev.day * CLASH_STEP;
      e.s.glow = prog(f, at, at + 10, E.out) * (1 - 0.5 * prog(f, 52, 70, E.smooth));
    }
  const nowT = prog(f, 4, 34, E.out);

  // typing. Keystrokes, the caret blink and ink ages are discrete states: they are evaluated on the
  // whole frame, so every motion-blur sub-sample of a frame shows the same text.
  const fd = Math.round(f);
  const n = typed(fd);
  const { tokens, chipIndex } = slice(n, fd);
  const chipIn = chipIndex.map((ti) => (ti >= 0 ? prog(fd, tokenDone[ti] + 1, tokenDone[ti] + 12, E.out) : 0));
  const caretOn = fd < 8 ? false : fd < L(CUE.typeStart) ? Math.floor(fd / 16) % 2 === 0 : fd > L(CUE.typeEnd) + 6 ? Math.floor(fd / 16) % 2 === 0 : true;
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
      {/* the soft glow, pre-dithered (a CSS gradient this subtle bands into rings) */}
      <Img src={staticFile('fx/glow-ink.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
      {/* app: racks out of focus as the bar lifts (cross-faded, so the blur never snaps) */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-16 * typeT}px) scale(${1 + 0.025 * typeT})`, transformOrigin: '960px 590px' }}>
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
              <CalendarApp events={events} nowO={1} labelO={prog(f, 10, 24, E.out)} lineT={nowT} hideBar clashes={12} clashO={prog(f, 6, 20, E.out)} shadow={false} />
            </div>
          )}
        />
      </div>
      <AbsoluteFill style={{ background: C.ink, opacity: appDim }} />
      {/* command bar, always sharp */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${bx + BAR.x * SB}px, ${by + BAR.y * SB}px) scale(${SB})`,
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
