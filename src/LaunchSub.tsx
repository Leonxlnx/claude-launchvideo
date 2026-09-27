import { useMemo } from 'react';
import { CalculateMetadataFunction, Freeze, useCurrentFrame } from 'remotion';
import { Launch } from './Launch';
import { subframes } from './blur';

// The film as a stream of sub-frames for the motion-blurred master (see src/blur.ts).
// Frame j of this composition is the film at time t of the j-th sub-frame; scripts/accumulate.py
// averages each output frame's sub-frames. `groups` (samples per output frame) comes from
// scripts/measure-speed.py via --props=out/samples.json.
export type LaunchSubProps = { groups: number[] };

export const LaunchSub: React.FC<LaunchSubProps> = ({ groups }) => {
  const j = useCurrentFrame();
  const subs = useMemo(() => subframes(groups), [groups]);
  const s = subs[Math.min(j, subs.length - 1)];
  return (
    <Freeze frame={s.t}>
      <Launch />
    </Freeze>
  );
};

export const subMetadata: CalculateMetadataFunction<LaunchSubProps> = ({ props }) => ({
  durationInFrames: subframes(props.groups).length,
});
