import React from 'react';
import { AbsoluteFill } from 'remotion';

export type Cam = {
  x?: number; // px, screen space
  y?: number;
  z?: number; // px toward camera
  s?: number; // uniform scale
  rx?: number; // deg
  ry?: number;
  rz?: number;
  persp?: number;
  ox?: number; // transform origin (px)
  oy?: number;
};

export const camTransform = (c: Cam) =>
  `perspective(${c.persp ?? 2400}px) translate3d(${c.x ?? 0}px, ${c.y ?? 0}px, ${c.z ?? 0}px) rotateX(${c.rx ?? 0}deg) rotateY(${c.ry ?? 0}deg) rotateZ(${c.rz ?? 0}deg) scale(${c.s ?? 1})`;

/** A 3D camera rig. Children are laid out in a 1920x1080 world. */
export const Stage: React.FC<{ cam?: Cam; children: React.ReactNode; style?: React.CSSProperties }> = ({ cam = {}, children, style }) => (
  <AbsoluteFill
    style={{
      transform: camTransform(cam),
      transformOrigin: `${cam.ox ?? 960}px ${cam.oy ?? 540}px`,
      transformStyle: 'preserve-3d',
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Absolutely positioned layer at (x,y) with its own 3D context. */
export const At: React.FC<{ x: number; y: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, children, style }) => (
  <div style={{ position: 'absolute', left: x, top: y, transformStyle: 'preserve-3d', ...style }}>{children}</div>
);
