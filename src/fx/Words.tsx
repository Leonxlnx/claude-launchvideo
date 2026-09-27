import React from 'react';
import { E, prog } from '../lib/anim';

/**
 * Word-by-word reveal: each word rises, sharpens from blur and fades in.
 * Deliberately no per-letter gimmicks — the rhythm lives in the stagger.
 */
export const Words: React.FC<{
  text: string;
  frame: number; // local frame
  start: number;
  stagger?: number;
  dur?: number;
  rise?: number;
  blur?: number;
  out?: number; // frame to start exiting (optional)
  outDur?: number;
  style?: React.CSSProperties;
  wordStyle?: (i: number) => React.CSSProperties;
}> = ({ text, frame, start, stagger = 8, dur = 26, rise = 0.32, blur = 14, out, outDur = 16, style, wordStyle }) => {
  const words = text.split(' ');
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'nowrap', whiteSpace: 'pre', ...style }}>
      {words.map((w, i) => {
        const p = prog(frame, start + i * stagger, start + i * stagger + dur, E.out);
        const q = out === undefined ? 0 : prog(frame, out + i * (stagger / 2), out + i * (stagger / 2) + outDur, E.in);
        const o = p * (1 - q);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - p) * rise - q * rise * 0.6}em)`,
              filter: `blur(${(1 - p) * blur + q * blur}px)`,
              opacity: o,
              ...(wordStyle ? wordStyle(i) : {}),
            }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
};
