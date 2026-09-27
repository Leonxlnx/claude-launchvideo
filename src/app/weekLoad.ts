import { E, prog, spr } from '../lib/anim';
import { ACT } from '../timeline';
import { EvStyle, evRect } from './CalendarApp';
import { BEFORE } from './data';

// The overbooked week loads column by column while the app flies in, so it is already full (and
// its clashes flash on the downbeat) when Act 3 starts. Timed in absolute frames, shared by
// Act 2 (inside the opening pieces) and Act 3.
export const LOAD_SHIFT = -34;
export const loadAt = (ev: { day: number; start: number }) => ACT.prompt.from + LOAD_SHIFT + ev.day * 3 + (ev.start - 9) * 1.6;
export const weekLoad = (abs: number) =>
  BEFORE.map((ev) => {
    const at = loadAt(ev);
    const p = prog(abs, at, at + 16, E.out);
    const sp = spr(abs, at, { damping: 15, stiffness: 240, mass: 0.6 });
    const r = evRect(ev);
    // snap the spring's last sub-pixel tail to rest, so labels never shift on the act cut
    const dy = Math.abs(1 - sp) < 0.01 ? 0 : (1 - sp) * 14;
    return { ev, s: { rect: { ...r, y: r.y - dy }, opacity: p, glow: 0 } as EvStyle };
  });

