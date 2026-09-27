import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ACT } from './timeline';
import { Act1Fit } from './acts/Act1Fit';
import { Act2Mark } from './acts/Act2Mark';
import { Act3Prompt } from './acts/Act3Prompt';
import { Act4Plan } from './acts/Act4Plan';
import { Act5Features } from './acts/Act5Features';
import { Act6End } from './acts/Act6End';
import { BlurWindows } from './fx/BlurWindows';
import { Grain } from './fx/Grain';
import { FontGate } from './lib/FontGate';

export type LaunchProps = { blur?: boolean; samples?: number };

// Fast moves that get real temporal motion blur (act-local frames). Everything else renders once.
const WINDOWS: Record<string, ([number, number] | [number, number, number])[]> = {
  fit: [[330, 359]],
  mark: [[0, 32], [190, 240]],
  prompt: [[30, 84], [172, 214], [220, 239]],
  plan: [[0, 22], [30, 150, 16], [151, 214]],
  feat: [[0, 44], [106, 136], [226, 256], [324, 359]],
  end: [[4, 150], [214, 242], [300, 380]],
};

const Act: React.FC<{ id: keyof typeof ACT; blur: boolean; samples: number; children: React.ReactNode }> = ({ id, blur, samples, children }) =>
  blur ? (
    <BlurWindows windows={WINDOWS[id]} samples={samples} shutter={240}>
      {children}
    </BlurWindows>
  ) : (
    <>{children}</>
  );

// The film. Acts hand off on exact frames; every seam is a designed match, not a cut.
export const Launch: React.FC<LaunchProps> = ({ blur = false, samples = 10 }) => (
  <FontGate>
    <AbsoluteFill style={{ background: '#fff' }}>
      <Sequence from={ACT.fit.from} durationInFrames={ACT.fit.dur} name="1 · Doesn't fit">
        <Act id="fit" blur={blur} samples={samples}>
          <Act1Fit />
        </Act>
      </Sequence>
      <Sequence from={ACT.mark.from} durationInFrames={ACT.mark.dur} name="2 · Mark">
        <Act id="mark" blur={blur} samples={samples}>
          <Act2Mark />
        </Act>
      </Sequence>
      <Sequence from={ACT.prompt.from} durationInFrames={ACT.prompt.dur} name="3 · Prompt">
        <Act id="prompt" blur={blur} samples={samples}>
          <Act3Prompt />
        </Act>
      </Sequence>
      <Sequence from={ACT.plan.from} durationInFrames={ACT.plan.dur} name="4 · The fitting">
        <Act id="plan" blur={blur} samples={samples}>
          <Act4Plan />
        </Act>
      </Sequence>
      <Sequence from={ACT.feat.from} durationInFrames={ACT.feat.dur} name="5 · Features">
        <Act id="feat" blur={blur} samples={samples}>
          <Act5Features />
        </Act>
      </Sequence>
      <Sequence from={ACT.end.from} durationInFrames={ACT.end.dur} name="6 · Everything fits">
        <Act id="end" blur={blur} samples={samples}>
          <Act6End />
        </Act>
      </Sequence>
      <Grain opacity={0.028} />
      <Audio src={staticFile('audio/soundtrack.wav')} />
    </AbsoluteFill>
  </FontGate>
);
