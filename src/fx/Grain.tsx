import { AbsoluteFill, useCurrentFrame } from 'remotion';

// Subtle animated film grain. Kills gradient banding and adds a filmic surface.
export const Grain: React.FC<{ opacity?: number; blend?: React.CSSProperties['mixBlendMode'] }> = ({ opacity = 0.05, blend = 'overlay' }) => {
  const f = useCurrentFrame();
  const seed = f % 8; // re-seed every frame, cycle of 8 keeps it cheap
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: blend, opacity }}>
      <svg width="100%" height="100%">
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
