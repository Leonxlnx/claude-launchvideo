import { FONT } from '../brand/tokens';

// Measures with the real DOM so variable-font weights and CSS letter-spacing are exact.
// Only valid after fonts are loaded — FontGate guarantees children render after that.
const cache = new Map<string, number>();

export const measureTracked = (text: string, size: number, weight: number, trackEm: number, family = FONT.sans) => {
  const key = `${text}|${size}|${weight}|${trackEm}|${family}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const span = document.createElement('span');
  span.textContent = text;
  Object.assign(span.style, {
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'nowrap',
    fontFamily: family,
    fontSize: `${size}px`,
    fontWeight: String(weight),
    letterSpacing: `${trackEm}em`,
    lineHeight: '1',
  });
  document.body.appendChild(span);
  const w = span.getBoundingClientRect().width;
  document.body.removeChild(span);
  cache.set(key, w);
  return w;
};
