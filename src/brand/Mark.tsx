import { C } from './tokens';

// The Tessel mark: three pieces that fit into one square.
// Geometry in a 100-unit box: tall block (A), square block (B), the red "now" dot (D).
export const MARK = {
  gap: 8,
  r: 13,
  A: { x: 0, y: 0, w: 46, h: 100 },
  B: { x: 54, y: 0, w: 46, h: 46 },
  D: { cx: 77, cy: 77, r: 23 },
};

export type PieceXf = { x?: number; y?: number; rot?: number; s?: number; o?: number };

const xf = (p: PieceXf | undefined, ox: number, oy: number) =>
  p ? `translate(${p.x ?? 0} ${p.y ?? 0}) rotate(${p.rot ?? 0} ${ox} ${oy}) translate(${ox} ${oy}) scale(${p.s ?? 1}) translate(${-ox} ${-oy})` : undefined;

export const Mark: React.FC<{
  size: number;
  ink?: string;
  dot?: string;
  a?: PieceXf;
  b?: PieceXf;
  d?: PieceXf;
  style?: React.CSSProperties;
}> = ({ size, ink = C.ink, dot = C.red, a, b, d, style }) => {
  const { A, B, D, r } = MARK;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', ...style }}>
      <rect x={A.x} y={A.y} width={A.w} height={A.h} rx={r} fill={ink} transform={xf(a, A.x + A.w / 2, A.y + A.h / 2)} opacity={a?.o ?? 1} />
      <rect x={B.x} y={B.y} width={B.w} height={B.h} rx={r} fill={ink} transform={xf(b, B.x + B.w / 2, B.y + B.h / 2)} opacity={b?.o ?? 1} />
      <circle cx={D.cx} cy={D.cy} r={D.r} fill={dot} transform={xf(d, D.cx, D.cy)} opacity={d?.o ?? 1} />
    </svg>
  );
};
