import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ACT } from './timeline';
import { Act1Fit } from './acts/Act1Fit';
import { Act2Mark } from './acts/Act2Mark';
import { Act3Prompt } from './acts/Act3Prompt';
import { Act4Plan } from './acts/Act4Plan';
import { Act5Features } from './acts/Act5Features';
import { Act6End } from './acts/Act6End';
import { FontGate } from './lib/FontGate';

// The film. Acts hand off on exact frames; every seam is a designed match, not a cut.
export const Launch: React.FC = () => (
  <FontGate>
    <AbsoluteFill style={{ background: '#fff' }}>
      <Sequence from={ACT.fit.from} durationInFrames={ACT.fit.dur} name="1 · Doesn't fit">
        <Act1Fit />
      </Sequence>
      <Sequence from={ACT.mark.from} durationInFrames={ACT.mark.dur} name="2 · Mark">
        <Act2Mark />
      </Sequence>
      <Sequence from={ACT.prompt.from} durationInFrames={ACT.prompt.dur} name="3 · Prompt">
        <Act3Prompt />
      </Sequence>
      <Sequence from={ACT.plan.from} durationInFrames={ACT.plan.dur} name="4 · The fitting">
        <Act4Plan />
      </Sequence>
      <Sequence from={ACT.feat.from} durationInFrames={ACT.feat.dur} name="5 · Features">
        <Act5Features />
      </Sequence>
      <Sequence from={ACT.end.from} durationInFrames={ACT.end.dur} name="6 · Everything fits">
        <Act6End />
      </Sequence>
      <Audio src={staticFile('audio/soundtrack.wav')} />
    </AbsoluteFill>
  </FontGate>
);
