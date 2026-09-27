import React from 'react';
import { useCurrentFrame } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';

/**
 * Real (temporal) motion blur, but only inside the given frame windows, where things move fast.
 * Outside them the scene renders once per frame, so the cost stays where the blur is visible.
 */
export const BlurWindows: React.FC<{
  windows: ([number, number] | [number, number, number])[]; // [from, to, samples?]
  samples?: number;
  shutter?: number;
  children: React.ReactNode;
}> = ({ windows, samples = 6, shutter = 270, children }) => {
  const f = useCurrentFrame();
  const w = windows.find(([a, b]) => f >= a && f <= b);
  if (!w) return <>{children}</>;
  return (
    <CameraMotionBlur samples={w[2] ?? samples} shutterAngle={shutter}>
      {children}
    </CameraMotionBlur>
  );
};
