import '@fontsource-variable/geist';
import { AbsoluteFill } from 'remotion';

const INK = '#0B0B0C';
const RED = '#F0282D';

// V1: tall block + square + dot
const MarkA: React.FC<{ s: number; red?: string }> = ({ s, red = RED }) => {
  const g = 8, r = 13;
  return (
    <svg width={s} height={s} viewBox="0 0 100 100">
      <rect x={0} y={0} width={46} height={100} rx={r} fill={INK} />
      <rect x={54} y={0} width={46} height={46} rx={r} fill={INK} />
      <circle cx={77} cy={77} r={23} fill={red} />
    </svg>
  );
};
// V2: wide top bar + square + dot (calendar week-ish)
const MarkB: React.FC<{ s: number }> = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 100 100">
    <rect x={0} y={0} width={100} height={46} rx={13} fill={INK} />
    <rect x={0} y={54} width={46} height={46} rx={13} fill={INK} />
    <circle cx={77} cy={77} r={23} fill={RED} />
  </svg>
);
// V3: two offset blocks stair + dot top-right
const MarkC: React.FC<{ s: number }> = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 100 100">
    <rect x={0} y={0} width={64} height={28} rx={11} fill={INK} />
    <rect x={0} y={36} width={100} height={28} rx={11} fill={INK} />
    <rect x={36} y={72} width={64} height={28} rx={11} fill={INK} />
    <circle cx={86} cy={14} r={14} fill={RED} />
  </svg>
);
// V4: L-shape pair + dot
const MarkD: React.FC<{ s: number }> = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 100 100">
    <rect x={0} y={0} width={46} height={46} rx={13} fill={INK} />
    <rect x={54} y={0} width={46} height={100} rx={13} fill={INK} />
    <circle cx={23} cy={77} r={23} fill={RED} />
  </svg>
);

const Word: React.FC<{ size: number; weight: number; track: number }> = ({ size, weight, track }) => (
  <span style={{ fontFamily: 'Geist Variable', fontSize: size, fontWeight: weight, letterSpacing: `${track}em`, color: INK, lineHeight: 1 }}>tessel</span>
);

export const LogoLab: React.FC = () => (
  <AbsoluteFill style={{ background: '#fff', padding: 80, gap: 70, display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', gap: 90, alignItems: 'center' }}>
      <MarkA s={180} /><MarkB s={180} /><MarkC s={180} /><MarkD s={180} />
      <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}><MarkA s={48} /><MarkA s={28} /><MarkA s={16} /></div>
    </div>
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <MarkA s={120} /><Word size={150} weight={600} track={-0.055} />
      <div style={{ width: 80 }} />
      <div style={{ background: INK, padding: 40, borderRadius: 30, display: 'flex', gap: 20, alignItems: 'center' }}>
        <svg width={90} height={90} viewBox="0 0 100 100"><rect x={0} y={0} width={46} height={100} rx={13} fill="#fff" /><rect x={54} y={0} width={46} height={46} rx={13} fill="#fff" /><circle cx={77} cy={77} r={23} fill={RED} /></svg>
        <span style={{ fontFamily: 'Geist Variable', fontSize: 110, fontWeight: 600, letterSpacing: '-0.055em', color: '#fff', lineHeight: 1 }}>tessel</span>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 60, alignItems: 'center' }}>
      <MarkD s={110} /><Word size={130} weight={500} track={-0.05} />
      <MarkB s={110} /><Word size={130} weight={700} track={-0.06} />
    </div>
  </AbsoluteFill>
);
