import React from 'react';

// macOS-style arrow pointer. Tip is at (0,0) of the element.
export const Cursor: React.FC<{ x: number; y: number; scale?: number; press?: number; opacity?: number }> = ({ x, y, scale = 1, press = 0, opacity = 1 }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 0,
      height: 0,
      opacity,
      transform: `scale(${scale * (1 - 0.12 * press)})`,
      transformOrigin: '0 0',
      filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.28))',
    }}
  >
    <svg width={30} height={42} viewBox="0 0 30 42" style={{ position: 'absolute', left: -3, top: -2 }}>
      <path
        d="M3 2 L3 33 L10.2 26.4 L15 38 L20.2 35.8 L15.4 24.4 L25 24.4 Z"
        fill="#0B0B0C"
        stroke="#fff"
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
    </svg>
  </div>
);
