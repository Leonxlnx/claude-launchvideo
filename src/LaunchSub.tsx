import { AbsoluteFill, Freeze, useCurrentFrame } from 'remotion';
import { Launch, GRAIN } from './Launch';
import { Grain } from './fx/Grain';
import { SUBFRAMES } from './blur';

// The film as a stream of sub-frames for the motion-blurred master (see src/blur.ts).
// Frame j of this composition is the film at time SUBFRAMES[j].t; scripts/accumulate.py averages
// each output frame's sub-frames. Grain is keyed to the output frame, so averaging keeps it intact.
export const LaunchSub: React.FC = () => {
  const j = useCurrentFrame();
  const s = SUBFRAMES[Math.min(j, SUBFRAMES.length - 1)];
  return (
    <AbsoluteFill>
      <Freeze frame={s.t}>
        <Launch grain={false} />
      </Freeze>
      <Freeze frame={s.f}>
        <Grain opacity={GRAIN} />
      </Freeze>
    </AbsoluteFill>
  );
};
