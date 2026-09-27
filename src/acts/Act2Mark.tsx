import React from 'react';
import { AbsoluteFill, Easing, Img, spring, SpringConfig, staticFile, useCurrentFrame } from 'remotion';
import { measureTracked } from '../lib/measure';
import { C, FONT } from '../brand/tokens';
import { MARK } from '../brand/Mark';
import { E, FPS, hitPulse, mix, prog, spr } from '../lib/anim';
import { Words } from '../fx/Words';
import { ACT, b, CUE } from '../timeline';
import { APP, CalendarApp, GRID, HOUR, COL } from '../app/CalendarApp';
import { H0, NOW, TODAY } from '../app/data';
import { weekLoad } from '../app/weekLoad';

// ACT 2 — the dot becomes the mark, the mark becomes the product.
// The tall block turns into the sidebar, the square into the calendar, the dot into "now".

const L = (abs: number) => abs - ACT.mark.from; // absolute cue → local frame

// App framing at the end of this act (Act 3 starts from exactly here)
export const APP_VIEW = { s: 0.94, x: 960 - (APP.W * 0.94) / 2, y: 540 - (APP.H * 0.94) / 2 };

type R = { x: number; y: number; w: number; h: number };
const lerpR = (a: R, b: R, t: number): R => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });

export const WORD = { size: 190, weight: 620, track: -0.055 };
// the app's now dot (NowLine: a 12px disc at top = y - 6, which layout snaps to a whole app pixel)
const DOT_APP = {
  x: (GRID.x + TODAY * COL) / APP.W,
  y: (GRID.y + Math.round((NOW - H0) * HOUR - 6) + 6) / APP.H,
};

// beats inside the lockup hold (act-local frames), shared with the soundtrack. On each one the dot
// pulses (+30%) and the whole mark punches (+1.5%); both peak 2 frames after the beat (hitPulse).
export const HOLD_BEATS = [b(4, 3), b(5), b(5, 1)].map((x) => x - ACT.mark.from);

// Piece entry springs. Each piece stops dead on the first frame it reaches its slot instead of
// overshooting into its neighbour; the whole-mark punch on those frames is the impact.
const SPR_A: Partial<SpringConfig> = { damping: 17, stiffness: 230, mass: 0.8 };
const SPR_B: Partial<SpringConfig> = { damping: 17, stiffness: 210, mass: 0.8 };
const SPR_D: Partial<SpringConfig> = { damping: 16, stiffness: 190, mass: 0.7 };
const A_AT = 8;
const B_AT = 10;
const firstHit = (start: number, cfg: Partial<SpringConfig>) => {
  for (let f = 0; f < 120; f++) if (spring({ frame: f, fps: FPS, config: cfg }) >= 1) return start + f;
  return start + 30;
};
/** act-local frames the two pieces lock into place (same as export-cues' markSnapA/B) */
export const SNAP = { a: firstHit(A_AT, SPR_A), b: firstHit(B_AT, SPR_B) };

const FLY_FROM = L(CUE.flyIn);
/**
 * The lockup's exit (act-local frames), starting on the last hold beat: the descriptor fades down
 * and out, and 'tessel' retracts behind the mark (its entrance reversed: ease-in, tucked in on the
 * flyIn beat) while the mark slides back to frame centre, so the product opens from the centre.
 */
export const EXIT = {
  desc: [FLY_FROM - 30, FLY_FROM - 12],
  word: [FLY_FROM - 30, FLY_FROM],
  centre: [FLY_FROM - 26, FLY_FROM + 8],
} as const;

const DOLLY = Easing.bezier(0.35, 0, 0.65, 1); // a slow camera push: gentle in, steady, gentle out
const SEAM = 2; // px the calendar mask overlaps the sidebar mask once the pieces have joined
const DOT_R0 = 20; // the dot is a fixed 40px disc, sized and placed by transform only

export const Act2Mark: React.FC = () => {
  const f = useCurrentFrame();

  // --- stage: ink flood from the dot -------------------------------------------------
  const flood = prog(f, -1, 18, E.out); // already opening on the drop frame
  const floodR = mix(0, 1250, flood);

  // --- mark geometry, in lockup space ---------------------------------------------------
  // The lockup is laid out statically: through the hold nothing here changes, the camera dolly
  // and the beat punches are transforms, so no edge, glyph or dot steps on the pixel grid.
  const M0 = 240; // assembled size at center
  const M1 = 140; // lockup size: top on the ascender, bottom on the baseline
  const wm = { width: measureTracked('tessel', WORD.size, WORD.weight, WORD.track) };
  const gap = 34;
  const lockW = M1 + gap + wm.width;
  const lockX = 960 - lockW / 2;

  const lk = prog(f, L(CUE.lockup), L(CUE.lockup) + 34, E.inOut);
  const ctr = prog(f, EXIT.centre[0], EXIT.centre[1], E.smooth); // back to frame centre for the fly
  const size = mix(M0, M1, lk);
  const mx = mix(mix(960 - M0 / 2, lockX, lk) - (size - M1) * 0.5 * lk, 960 - size / 2, ctr);
  const my = 540 - size / 2 - 8 * lk * (1 - ctr);
  const u = size / 100; // px per mark unit

  // camera: a slow dolly in over the hold (screen = 960/540 + (p - centre) * dolly)
  const dolly = mix(1, 1.1, prog(f, L(CUE.lockup) + 20, FLY_FROM + 10, DOLLY));
  // the clock keeps running through the hold
  const beat = HOLD_BEATS.reduce((m, at) => Math.max(m, hitPulse(f - at)), 0);
  const holdPunch = 1 + 0.015 * beat;

  // impact punch when the pieces lock (whole assembly, one hit per piece)
  const punch = 1 + 0.025 * hitPulse(f - SNAP.a) + 0.03 * hitPulse(f - SNAP.b);

  // lockup space → screen: hold punch about the mark's centre, then the dolly about frame centre
  const K = holdPunch * dolly;
  const cx = mx + size / 2;
  const cy = my + size / 2;
  const toScreen = (r: R): R => ({
    x: 960 + (cx - 960) * dolly + (r.x - cx) * K,
    y: 540 + (cy - 540) * dolly + (r.y - cy) * K,
    w: r.w * K,
    h: r.h * K,
  });

  // piece entry springs, clamped at the rest pose (A comes from the left, B from above)
  const sa = spr(f, A_AT, SPR_A);
  const sb = spr(f, B_AT, SPR_B);
  const aIn = { x: Math.min(0, (1 - sa) * -1150), y: Math.max(0, (1 - sa) * 140), r: Math.min(0, (1 - sa) * -18) };
  const bIn = { x: Math.max(0, (1 - sb) * 150), y: Math.min(0, (1 - sb) * -760), r: Math.max(0, (1 - sb) * 10) };

  // --- fly into the app ---------------------------------------------------------------
  const flyS = FLY_FROM;
  const fly = prog(f, flyS, ACT.mark.dur - 14, E.inOut);
  const appIn = prog(f, flyS + 6, ACT.mark.dur - 12, E.smooth);
  const V = APP_VIEW;
  const winR: R = { x: V.x, y: V.y, w: APP.W * V.s, h: APP.H * V.s };
  const sideR: R = { x: V.x, y: V.y, w: APP.side * V.s, h: APP.H * V.s };
  const mainR: R = { x: V.x + APP.side * V.s, y: V.y, w: (APP.W - APP.side) * V.s, h: APP.H * V.s };
  const markR = toScreen({ x: mx, y: my, w: size, h: size });

  const A0 = toScreen({ x: mx + MARK.A.x * u, y: my + MARK.A.y * u, w: MARK.A.w * u, h: MARK.A.h * u });
  const B0 = toScreen({ x: mx + MARK.B.x * u, y: my + MARK.B.y * u, w: MARK.B.w * u, h: MARK.B.h * u });
  const A = lerpR(A0, sideR, fly);
  const B = lerpR(B0, mainR, fly);
  // the two pieces join early in the fly (their inner edges meet, then overlap by SEAM px), so no
  // ink line ever shows between the masks while they open
  const join = prog(fly, 0, 0.35, E.smooth);
  {
    const aR = A.x + A.w;
    const mid = (aR + B.x) / 2;
    const g = mix(B.x - aR, -SEAM, join);
    const bR = B.x + B.w;
    A.w = mid - g / 2 - A.x;
    B.x = mid + g / 2;
    B.w = bR - B.x;
    const aBot = A.y + A.h;
    B.h = mix(B.h, aBot - B.y, join); // and their bottoms meet, so the window never has an L-step
  }
  const U = lerpR(markR, winR, fly);
  // pieces are drawn at a fixed layout size and scaled by transform: kk is the lockup's screen
  // scale while it holds, and settles to 1 (true pixels) as the pieces become the app
  const kk = mix(K, 1, fly);
  const rPiece = MARK.r * u * K;
  const rWin = APP.R * V.s;
  const rInner = mix(rPiece, 0, Math.max(fly, join)); // corners on the seam square off as the pieces join
  const radA = `${mix(rPiece, rWin, fly) / kk}px ${rInner / kk}px ${mix(rPiece, 0, fly) / kk}px ${mix(rPiece, rWin, fly) / kk}px`;
  const radB = `${rInner / kk}px ${mix(rPiece, rWin, fly) / kk}px ${mix(rPiece, rWin, fly) / kk}px ${mix(rPiece, 0, fly) / kk}px`;
  // once both pieces are the window (on the frame the move stops; the app inside is > 99.9% in by
  // then), masks and pieces are done: the app is drawn once, opaque and unclipped, with the very
  // transform Act 3 opens on, so the cut is seamless and the window's edge is the app's own
  const landed = fly >= 1;
  const piece = (r: R, t = { x: 0, y: 0, r: 0 }): React.CSSProperties => {
    const w = r.w / kk;
    const h = r.h / kk;
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: w,
      height: h,
      transformOrigin: '0 0',
      transform: `translate(${r.x + t.x}px, ${r.y + t.y}px) scale(${kk})${t.r ? ` translate(${w / 2}px, ${h / 2}px) rotate(${t.r}deg) translate(${-w / 2}px, ${-h / 2}px)` : ''}`,
    };
  };

  // dot: center → mark slot → app "now" (tracked inside the morphing window so it never strays)
  const sd = spr(f, 2, SPR_D);
  const dotFly = prog(f, flyS + 10, ACT.mark.dur - 4, E.inOut);
  const inMark = {
    x: U.x + mix(MARK.D.cx / 100, DOT_APP.x, dotFly) * U.w,
    y: U.y + mix(MARK.D.cy / 100, DOT_APP.y, dotFly) * U.h,
    r: mix(MARK.D.r * u * K, 6 * V.s, fly),
  };
  // while the lockup holds, the dot keeps the film's clock: a pulse on every beat
  const dot = {
    x: mix(960, inMark.x, sd),
    y: mix(540, inMark.y, sd),
    r: mix(17.5, inMark.r, sd) * (1 + 0.3 * beat),
  };

  // wordmark + descriptor
  const wordIn = prog(f, L(CUE.lockup) + 14, L(CUE.lockup) + 50, E.out);
  const wordOut = prog(f, EXIT.word[0], EXIT.word[1], E.in); // the entrance, reversed
  const descOut = prog(f, EXIT.desc[0], EXIT.desc[1], E.smooth);
  const sideTone = mix(255, 250, fly);
  const shadow = fly < 1 ? Math.sin(Math.PI * fly) : 0; // depth while it flies; none once it is the app (as in Act 3)

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
      {/* the soft glow, pre-dithered (a CSS gradient this subtle bands into rings) */}
      <Img src={staticFile('fx/glow-ink.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: flood }} />

      {/* type, in lockup space: the dolly is a transform on this layer, the layout never moves */}
      {f >= L(CUE.lockup) && wordOut < 1 && (
        <AbsoluteFill style={{ transform: `scale(${dolly})`, transformOrigin: '960px 540px' }}>
          {/* wordmark: slides out from behind the mark and back in; the clip follows the live mark edge */}
          {(() => {
            const finalLeft = lockX + M1 + gap;
            const cl = Math.max(finalLeft - 6, mx + size + gap * (size / M1) - 6);
            const right = finalLeft + wm.width + 60;
            return (
              <div
                style={{
                  position: 'absolute',
                  left: cl,
                  top: 540 - WORD.size * 0.66,
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
                    color: '#fff',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    transform: `translateX(${Math.max(1 - wordIn, wordOut) * -(wm.width + 90)}px)`,
                    filter: wordIn < 1 ? `blur(${(1 - wordIn) * 5}px)` : undefined,
                    opacity: wordIn > 0.001 ? 1 : 0,
                  }}
                >
                  tessel
                </span>
              </div>
            );
          })()}
          {descOut < 1 && (
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
                opacity: 1 - descOut,
                transform: `translateY(${12 * descOut}px)`,
              }}
            >
              <Words text="The calendar that plans itself." frame={f} start={L(CUE.lockup) + 22} stagger={5} dur={24} blur={10} />
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* the mark (the lock-in punch applies to the whole assembly) */}
      <AbsoluteFill style={{ transform: punch !== 1 ? `scale(${punch})` : undefined, transformOrigin: '960px 540px' }}>
        {fly > 0 && !landed && (
          <div
            style={{
              position: 'absolute',
              left: U.x,
              top: U.y,
              width: U.w,
              height: U.h,
              borderRadius: mix(rPiece, rWin, fly),
              boxShadow: `0 ${40 * fly}px ${90 * fly}px rgba(0,0,0,${0.4 * shadow})`,
            }}
          />
        )}
        {/* piece A (tall) → sidebar; piece B (square) → calendar */}
        {!landed && <div style={{ ...piece(A, aIn), background: `rgb(${sideTone},${sideTone},${mix(255, 251, fly)})`, borderRadius: radA }} />}
        {!landed && <div style={{ ...piece(B, bIn), background: '#fff', borderRadius: radB }} />}

        {/* the product shows through inside the two pieces as they open (each piece is a mask). The
            app is placed by a sub-pixel transform chain that ends exactly where Act 3's does. */}
        {landed ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: APP.W,
              height: APP.H,
              transform: `translate(${V.x}px, ${V.y}px) scale(${V.s})`,
              transformOrigin: '0 0',
            }}
          >
            <CalendarApp events={weekLoad(ACT.mark.from + f)} nowO={0} shadow={false} />
          </div>
        ) : (
          appIn > 0 &&
          [
            { r: A, rad: radA },
            { r: B, rad: radB },
          ].map(({ r, rad }, i) => (
            <div key={i} style={{ ...piece(r), borderRadius: rad, overflow: 'hidden', opacity: appIn }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: APP.W,
                  height: APP.H,
                  transform: `translate(${(V.x - r.x) / kk}px, ${(V.y - r.y) / kk}px) scale(${V.s / kk})`,
                  transformOrigin: '0 0',
                }}
              >
                <CalendarApp events={weekLoad(ACT.mark.from + f)} nowO={0} shadow={false} />
              </div>
            </div>
          ))
        )}
        {/* the dot, always on top */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: DOT_R0 * 2,
            height: DOT_R0 * 2,
            borderRadius: '50%',
            background: C.red,
            transform: `translate(${dot.x - DOT_R0}px, ${dot.y - DOT_R0}px) scale(${dot.r / DOT_R0})`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
