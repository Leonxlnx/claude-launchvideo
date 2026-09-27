import React from 'react';
import { C, FONT } from '../brand/tokens';
import { Mark } from '../brand/Mark';
import { DAYS, Ev, fmt, H0, H1, NOW, TODAY } from './data';

// ---------------------------------------------------------------------------
// Layout (native app pixels). Acts use these to aim the camera.
// ---------------------------------------------------------------------------
export const APP = {
  W: 1560,
  H: 960,
  R: 22,
  side: 268,
  top: 68,
  head: 58,
  gutter: 68,
};
export const GRID = {
  x: APP.side + APP.gutter,
  y: APP.top + APP.head,
  w: APP.W - APP.side - APP.gutter,
  h: APP.H - APP.top - APP.head,
};
export const HOUR = GRID.h / (H1 - H0);
// command bar placement (app space) and its send button center
export const BAR = { x: GRID.x + GRID.w / 2 - 350, y: APP.H - 64 - 28, w: 700, h: 64 };
export const SEND = { x: BAR.x + BAR.w - 12 - 21, y: BAR.y + 32 };
export const COL = GRID.w / DAYS.length;

export type Rect = { x: number; y: number; w: number; h: number };

/** Rect of an event inside the grid (grid-local coordinates). */
export const evRect = (e: Pick<Ev, 'day' | 'start' | 'end' | 'lane' | 'lanes'>): Rect => {
  const lanes = e.lanes ?? 1;
  const lane = e.lane ?? 0;
  const inset = 4;
  const colW = COL - inset * 2;
  const laneW = colW / lanes;
  // overlapping lanes cascade a little so the clash reads as a pile, not a neat split
  const overlap = lanes > 1 ? 18 : 0;
  return {
    x: e.day * COL + inset + lane * laneW - (lane > 0 ? overlap : 0),
    y: (e.start - H0) * HOUR + 1.5,
    w: laneW + (lanes > 1 ? overlap * (lane > 0 ? 1 : 0.4) : 0),
    h: (e.end - e.start) * HOUR - 3,
  };
};

// ---------------------------------------------------------------------------
// Event block
// ---------------------------------------------------------------------------
export type EvStyle = {
  rect: Rect;
  z?: number; // lift in px (3D); also drives shadow
  opacity?: number;
  scale?: number;
  rot?: number;
  glow?: number; // 0..1 red outline (clash)
};

const kindStyle = (kind: Ev['kind']): React.CSSProperties => {
  switch (kind) {
    case 'focus':
      return { background: C.ink, color: '#fff', border: `1px solid ${C.ink}` };
    case 'life':
      return {
        background: `repeating-linear-gradient(135deg, #F2F3F5 0 5px, #FFFFFF 5px 10px)`,
        color: C.ink,
        border: `1px solid ${C.line2}`,
      };
    case 'task':
      return { background: '#fff', color: C.ink, border: `1.5px solid ${C.ink}` };
    default:
      return { background: '#F0F1F3', color: C.ink, border: '1px solid rgba(11,11,12,0.05)' };
  }
};

export const EventBlock: React.FC<{ ev: Ev; s: EvStyle; flat?: boolean; noLiftShadow?: boolean }> = ({ ev, s, flat, noLiftShadow }) => {
  const { rect } = s;
  const z = s.z ?? 0;
  const short = rect.h < 40;
  const tiny = rect.h < 26;
  const ks = kindStyle(ev.kind);
  const dark = ev.kind === 'focus';
  const lift = Math.min(1, z / 120);
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        transform: flat
          ? `scale(${s.scale ?? 1}) rotate(${s.rot ?? 0}deg)`
          : `translateZ(${z}px) scale(${s.scale ?? 1}) rotate(${s.rot ?? 0}deg)`,
        opacity: s.opacity ?? 1,
        borderRadius: 9,
        boxSizing: 'border-box',
        padding: tiny ? '3px 9px' : short ? '5px 10px' : '8px 11px',
        overflow: 'hidden',
        fontFamily: FONT.sans,
        boxShadow:
          z > 0.5 && !noLiftShadow
            ? `0 ${2 + lift * 28}px ${6 + lift * 50}px rgba(11,11,12,${0.08 + lift * 0.14}), 0 1px 2px rgba(11,11,12,0.06)`
            : s.glow
              ? `0 0 0 ${1.5 * s.glow}px ${C.red}`
              : 'none',
        ...ks,
        ...(s.glow && z <= 0.5 ? { boxShadow: `0 0 0 ${1.5 * s.glow}px rgba(236,42,58,${0.9 * s.glow})` } : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: short ? 'row' : 'column',
          gap: short ? 8 : 3,
          alignItems: short ? 'center' : 'flex-start',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 580, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{ev.title}</span>
        {!tiny && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.01em',
              color: dark ? 'rgba(255,255,255,0.55)' : C.mute,
              lineHeight: 1.15,
            }}
          >
            {fmt(ev.start)}
            {short ? '' : ` – ${fmt(ev.end)}`}
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small icons (stroke, 1.6px) — drawn, never emoji
// ---------------------------------------------------------------------------
const Ico: React.FC<{ d: string; size?: number; color?: string; sw?: number }> = ({ d, size = 16, color = C.mute2, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
export const ICON = {
  left: 'M10 3.5 5.5 8 10 12.5',
  right: 'M6 3.5 10.5 8 6 12.5',
  up: 'M8 13V3.5M3.8 7.6 8 3.4l4.2 4.2',
  check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM10.7 10.7 14 14',
  plus: 'M8 3v10M3 8h10',
};

// ---------------------------------------------------------------------------
// Command bar — "Tell Tessel what matters"
// ---------------------------------------------------------------------------
export type Token = { text: string; chip?: boolean; color?: string };

export const CommandBar: React.FC<{
  text: Token[];
  placeholder?: string;
  caret?: boolean;
  chipIn?: number[]; // per-token 0..1 chip reveal
  press?: number; // 0..1 send button press
  width?: number;
  focus?: number; // 0..1 ring
}> = ({ text, placeholder = 'Tell Tessel what matters…', caret, chipIn = [], press = 0, width = 700, focus = 0 }) => {
  const empty = text.length === 0 || text.every((t) => t.text.length === 0);
  return (
    <div
      style={{
        width,
        height: 64,
        borderRadius: 32,
        background: '#fff',
        border: `1px solid ${C.line}`,
        boxShadow: `0 18px 40px rgba(11,11,12,0.10), 0 2px 6px rgba(11,11,12,0.05), 0 0 0 ${4 * focus}px rgba(11,11,12,${0.06 * focus})`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px 0 22px',
        gap: 14,
        boxSizing: 'border-box',
        fontFamily: FONT.sans,
      }}
    >
      <Mark size={20} />
      <div style={{ flex: 1, fontSize: 17, letterSpacing: '-0.012em', color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {empty ? (
          <span style={{ color: C.mute, display: 'flex', alignItems: 'center' }}>
            {caret && <Caret />}
            {placeholder}
          </span>
        ) : (
          <>
            {text.map((t, i) =>
              t.chip ? (
                <span
                  key={i}
                  style={{
                    background: `rgba(11,11,12,${0.07 * (chipIn[i] ?? 0)})`,
                    borderRadius: 7,
                    padding: '2px 5px',
                    margin: '0 -5px 0 -5px',
                    position: 'relative',
                    fontWeight: 400 + 160 * (chipIn[i] ?? 0),
                    whiteSpace: 'pre',
                    color: t.color,
                  }}
                >
                  {t.text}
                </span>
              ) : (
                <span key={i} style={{ whiteSpace: 'pre', color: t.color }}>
                  {t.text}
                </span>
              ),
            )}
            {caret && <Caret />}
          </>
        )}
      </div>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          background: C.red,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${1 - 0.1 * press})`,
          boxShadow: `0 4px 12px rgba(236,42,58,${0.28 - 0.18 * press})`,
          flexShrink: 0,
        }}
      >
        <Ico d={ICON.up} color="#fff" size={18} sw={2} />
      </div>
    </div>
  );
};

const Caret: React.FC = () => <span style={{ display: 'inline-block', width: 2, height: 21, background: C.ink, margin: '0 1px', borderRadius: 1 }} />;

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
const PRIORITIES = [
  { label: 'Deep work mornings', meta: 'Mon–Fri' },
  { label: 'Ship Q4 deck', meta: 'by Fri' },
  { label: 'Gym', meta: 'Tue, Thu' },
];

const Sidebar: React.FC<{ prioIn: number[] }> = ({ prioIn }) => {
  const weeks = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
    [27, 28, 29, 30, null, null, null],
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: APP.side,
        height: APP.H,
        background: '#FAFAFB',
        borderRight: `1px solid ${C.line}`,
        boxSizing: 'border-box',
        padding: '22px 22px',
        fontFamily: FONT.sans,
        color: C.ink,
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: C.line2 }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 30 }}>
        <Mark size={22} />
        <span style={{ fontSize: 19, fontWeight: 620, letterSpacing: '-0.05em' }}>tessel</span>
      </div>
      {/* mini month */}
      <div style={{ marginTop: 34, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>September</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Ico d={ICON.left} size={14} />
          <Ico d={ICON.right} size={14} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4, fontSize: 11.5, textAlign: 'center' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} style={{ color: C.mute, fontFamily: FONT.mono, fontSize: 10.5, paddingBottom: 4 }}>
            {d}
          </span>
        ))}
        {weeks.flatMap((w, wi) =>
          w.map((d, di) => {
            const inWeek = wi === 2 && di < 5;
            const today = d === 16;
            return (
              <div
                key={`${wi}-${di}`}
                style={{
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: inWeek ? '#EEEFF2' : 'transparent',
                  borderRadius: inWeek ? (di === 0 ? '7px 0 0 7px' : di === 4 ? '0 7px 7px 0' : 0) : 0,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: today ? C.ink : 'transparent',
                    color: today ? '#fff' : d && di > 4 ? C.mute : C.ink,
                    fontWeight: today ? 600 : 450,
                  }}
                >
                  {d ?? ''}
                </span>
              </div>
            );
          }),
        )}
      </div>
      {/* priorities */}
      <div style={{ marginTop: 34, fontSize: 12.5, fontWeight: 560, color: C.mute }}>Priorities</div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 120 }}>
        {PRIORITIES.map((p, i) => {
          const t = prioIn[i] ?? 0;
          return (
            <div
              key={p.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 34,
                padding: '0 10px',
                borderRadius: 9,
                background: t > 0 ? `rgba(255,255,255,${t})` : 'transparent',
                border: `1px solid rgba(227,228,232,${t})`,
                opacity: t,
                transform: `translateY(${(1 - t) * 10}px)`,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 2.5, background: C.ink, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 540, flex: 1, whiteSpace: 'nowrap' }}>{p.label}</span>
              <span style={{ fontSize: 11, color: C.mute, fontFamily: FONT.mono, whiteSpace: 'nowrap' }}>{p.meta}</span>
            </div>
          );
        })}
      </div>
      {/* calendars */}
      <div style={{ marginTop: 26, fontSize: 12.5, fontWeight: 560, color: C.mute }}>Calendars</div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { l: 'Work', s: { background: '#E6E7EA' } },
          { l: 'Focus', s: { background: C.ink } },
          { l: 'Personal', s: { background: 'repeating-linear-gradient(135deg, #DADCE0 0 2px, #fff 2px 4px)', border: `1px solid ${C.line2}` } },
        ].map((c) => (
          <div key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 480 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, boxSizing: 'border-box', ...c.s }} />
            {c.l}
          </div>
        ))}
      </div>
      {/* user */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 15, background: '#E4E5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, color: C.mute2 }}>KN</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 560 }}>Kai Nakamura</span>
          <span style={{ fontSize: 11, color: C.mute }}>Head of Product</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Top bar + day header + time gutter
// ---------------------------------------------------------------------------
const TopBar: React.FC<{ clashes?: number; clashO?: number; resolved?: number }> = ({ clashes = 0, clashO = 0, resolved = 0 }) => (
  <div
    style={{
      position: 'absolute',
      left: APP.side,
      top: 0,
      width: APP.W - APP.side,
      height: APP.top,
      borderBottom: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      boxSizing: 'border-box',
      fontFamily: FONT.sans,
      color: C.ink,
      gap: 12,
    }}
  >
    <span style={{ fontSize: 20, fontWeight: 620, letterSpacing: '-0.025em' }}>September 2026</span>
    <span style={{ fontSize: 20, fontWeight: 450, letterSpacing: '-0.02em', color: C.mute }}>Week 38</span>
    {clashO > 0 && (
      <div
        style={{
          marginLeft: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 11px 5px 9px',
          borderRadius: 99,
          fontSize: 13,
          fontWeight: 560,
          opacity: clashO,
          transform: `translateY(${(1 - clashO) * 6}px)`,
          background: resolved > 0.5 ? '#F1F2F4' : 'rgba(236,42,58,0.08)',
          color: resolved > 0.5 ? C.ink : C.red,
        }}
      >
        {resolved > 0.5 ? (
          <Ico d={ICON.check} size={13} color={C.ink} sw={2} />
        ) : (
          <div style={{ width: 7, height: 7, borderRadius: 4, background: C.red }} />
        )}
        {resolved > 0.5 ? 'No clashes' : `${clashes} clashes`}
      </div>
    )}
    <div style={{ flex: 1 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}>
      <Ico d={ICON.left} />
      <Ico d={ICON.right} />
    </div>
    <div style={{ fontSize: 13, fontWeight: 540, padding: '7px 13px', border: `1px solid ${C.line}`, borderRadius: 9 }}>Today</div>
    <div style={{ display: 'flex', background: '#F1F2F4', borderRadius: 10, padding: 3, fontSize: 13, fontWeight: 540 }}>
      {['Day', 'Week', 'Month'].map((l) => (
        <div
          key={l}
          style={{
            padding: '5px 13px',
            borderRadius: 7,
            background: l === 'Week' ? '#fff' : 'transparent',
            boxShadow: l === 'Week' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            color: l === 'Week' ? C.ink : C.mute2,
          }}
        >
          {l}
        </div>
      ))}
    </div>
  </div>
);

const DayHeader: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: GRID.x,
      top: APP.top,
      width: GRID.w,
      height: APP.head,
      display: 'flex',
      borderBottom: `1px solid ${C.line}`,
      fontFamily: FONT.sans,
    }}
  >
    {DAYS.map((d, i) => (
      <div key={d.dow} style={{ width: COL, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', boxSizing: 'border-box' }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 11.5, color: i === TODAY ? C.ink : C.mute, letterSpacing: '0.02em' }}>{d.dow}</span>
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: i === TODAY ? '#fff' : C.ink,
            background: i === TODAY ? C.ink : 'transparent',
            borderRadius: 8,
            padding: i === TODAY ? '3px 7px' : '3px 0',
          }}
        >
          {d.date}
        </span>
      </div>
    ))}
  </div>
);

export const GridLines: React.FC<{ reveal?: number }> = ({ reveal = 1 }) => {
  const hours = [];
  for (let h = Math.ceil(H0); h < H1; h++) hours.push(h);
  return (
    <>
      {hours.map((h, i) => (
        <div
          key={h}
          style={{
            position: 'absolute',
            left: 0,
            top: (h - H0) * HOUR,
            width: GRID.w * reveal,
            height: 1,
            background: C.line,
            opacity: h <= H0 ? 0 : 1,
          }}
        />
      ))}
      {DAYS.map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: i * COL, top: 0, width: 1, height: GRID.h * reveal, background: i === 0 ? 'transparent' : C.line }} />
      ))}
    </>
  );
};

const Gutter: React.FC = () => {
  const hours = [];
  for (let h = Math.ceil(H0 + 0.01); h < H1; h++) hours.push(h);
  return (
    <div style={{ position: 'absolute', left: APP.side, top: GRID.y, width: APP.gutter, height: GRID.h }}>
      {hours.map((h) => (
        <span
          key={h}
          style={{
            position: 'absolute',
            right: 12,
            top: (h - H0) * HOUR - 7,
            fontFamily: FONT.mono,
            fontSize: 11,
            color: C.mute,
          }}
        >
          {String(h).padStart(2, '0')}:00
        </span>
      ))}
    </div>
  );
};

export const NowLine: React.FC<{ t?: number; o?: number; now?: number }> = ({ t = 1, o = 1, now = NOW }) => {
  const y = (now - H0) * HOUR;
  return (
    <>
      {/* faint across the week, strong across today */}
      <div style={{ position: 'absolute', left: 0, top: y, width: GRID.w * t, height: 1, background: `rgba(236,42,58,${0.28 * o})` }} />
      <div style={{ position: 'absolute', left: TODAY * COL, top: y - 0.75, width: COL * t, height: 2, background: C.red, opacity: o }} />
      <div style={{ position: 'absolute', left: TODAY * COL - 5, top: y - 5, width: 10, height: 10, borderRadius: 5, background: C.red, opacity: o }} />
    </>
  );
};

const NowLabel: React.FC<{ o?: number; now?: number }> = ({ o = 1, now = NOW }) => (
  <div
    style={{
      position: 'absolute',
      left: APP.side + 10,
      top: GRID.y + (now - H0) * HOUR - 10,
      background: C.red,
      color: '#fff',
      fontFamily: FONT.mono,
      fontSize: 11,
      fontWeight: 500,
      borderRadius: 6,
      padding: '3px 6px',
      opacity: o,
    }}
  >
    {fmt(now)}
  </div>
);

// ---------------------------------------------------------------------------
// The app
// ---------------------------------------------------------------------------
export type AppProps = {
  events: { ev: Ev; s: EvStyle; key?: string }[];
  noLiftShadow?: boolean;
  prompt?: Token[];
  caret?: boolean;
  chipIn?: number[];
  press?: number;
  barFocus?: number;
  prioIn?: number[];
  nowO?: number;
  chrome?: number; // 0..1 fade for everything but the grid content
  flat?: boolean; // no 3D in events
  gridChildren?: React.ReactNode; // extra layers inside the grid (e.g. landing shadows)
  hideBar?: boolean; // render the command bar elsewhere (sharp, on top of a blurred app)
  clashes?: number;
  clashO?: number;
  resolved?: number;
  now?: number; // override the current time (hours)
  overlay?: React.ReactNode; // extra layers in app space
  shadow?: boolean;
};

export const CalendarApp: React.FC<AppProps> = ({
  events,
  prompt = [],
  caret,
  chipIn,
  press,
  barFocus,
  prioIn = [0, 0, 0],
  nowO = 1,
  chrome = 1,
  flat,
  gridChildren,
  overlay,
  shadow = true,
  hideBar,
  clashes,
  clashO,
  resolved,
  noLiftShadow,
  now = NOW,
}) => (
  <div
    style={{
      position: 'relative',
      width: APP.W,
      height: APP.H,
      borderRadius: APP.R,
      background: '#fff',
      boxShadow: shadow
        ? '0 0 0 1px rgba(11,11,12,0.06), 0 40px 80px -20px rgba(11,11,12,0.18), 0 12px 30px -10px rgba(11,11,12,0.10)'
        : '0 0 0 1px rgba(11,11,12,0.06)',
      overflow: 'visible',
      transformStyle: 'preserve-3d',
    }}
  >
    <div style={{ position: 'absolute', inset: 0, borderRadius: APP.R, overflow: 'hidden', opacity: chrome }}>
      <Sidebar prioIn={prioIn} />
      <TopBar clashes={clashes} clashO={clashO} resolved={resolved} />
      <DayHeader />
      <Gutter />
      <NowLabel o={nowO} now={now} />
    </div>
    <div
      style={{
        position: 'absolute',
        left: GRID.x,
        top: GRID.y,
        width: GRID.w,
        height: GRID.h,
        transformStyle: 'preserve-3d',
      }}
    >
      <GridLines />
      {gridChildren}
      {events.map(({ ev, s, key }) => (
        <EventBlock key={key ?? ev.id} ev={ev} s={s} flat={flat} noLiftShadow={noLiftShadow} />
      ))}
      <NowLine o={nowO} now={now} />
    </div>
    {!hideBar && (
      <div
        style={{
          position: 'absolute',
          left: BAR.x,
          top: BAR.y,
          opacity: chrome,
        }}
      >
        <CommandBar text={prompt} caret={caret} chipIn={chipIn} press={press} focus={barFocus} />
      </div>
    )}
    {overlay}
  </div>
);
