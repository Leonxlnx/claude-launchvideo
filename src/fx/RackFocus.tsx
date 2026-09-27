import React from 'react';

/**
 * Rack focus without Chromium's stepped blur ramp: the layer is rendered sharp and with a constant
 * blur, and the two are cross-faded. The blurred copy only mounts while it is visible.
 * Both copies are overscanned so the blur never pulls transparent pixels in at the frame edge.
 */
export const RackFocus: React.FC<{
  t: number; // 0 = sharp, 1 = fully defocused
  blur: number; // px at t = 1
  overscan?: number;
  render: () => React.ReactNode; // content in 1920x1080 frame coordinates
  style?: React.CSSProperties;
}> = ({ t, blur, overscan = 80, render, style }) => {
  const box: React.CSSProperties = {
    position: 'absolute',
    left: -overscan,
    top: -overscan,
    width: 1920 + overscan * 2,
    height: 1080 + overscan * 2,
    overflow: 'hidden',
  };
  const inner: React.CSSProperties = { position: 'absolute', left: overscan, top: overscan, width: 1920, height: 1080 };
  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      {t < 0.999 && (
        <div style={box}>
          <div style={inner}>{render()}</div>
        </div>
      )}
      {t > 0.001 && (
        <div style={{ ...box, filter: `blur(${blur}px)`, opacity: t }}>
          <div style={inner}>{render()}</div>
        </div>
      )}
    </div>
  );
};
