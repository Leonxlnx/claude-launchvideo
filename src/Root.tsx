import { Composition } from 'remotion';
import { FontGate } from './lib/FontGate';
import { LogoLab } from './LogoLab';
import { AppLab } from './AppLab';
import { Act1Fit } from './acts/Act1Fit';
import { Act2Mark } from './acts/Act2Mark';
import { Act3Prompt } from './acts/Act3Prompt';
import { Act4Plan } from './acts/Act4Plan';
import { ACT } from './timeline';

const wrap = (C: React.FC) => () => (
  <FontGate>
    <C />
  </FontGate>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Act1" component={wrap(Act1Fit)} durationInFrames={ACT.fit.dur} fps={60} width={1920} height={1080} />
      <Composition id="Act2" component={wrap(Act2Mark)} durationInFrames={ACT.mark.dur} fps={60} width={1920} height={1080} />
      <Composition id="Act3" component={wrap(Act3Prompt)} durationInFrames={ACT.prompt.dur} fps={60} width={1920} height={1080} />
      <Composition id="Act4" component={wrap(Act4Plan)} durationInFrames={ACT.plan.dur} fps={60} width={1920} height={1080} />
      <Composition id="LogoLab" component={LogoLab} durationInFrames={1} fps={60} width={1920} height={1080} />
      <Composition id="AppBefore" component={AppLab} durationInFrames={1} fps={60} width={1920} height={1080} defaultProps={{ state: 'before' as const }} />
      <Composition id="AppAfter" component={AppLab} durationInFrames={1} fps={60} width={1920} height={1080} defaultProps={{ state: 'after' as const }} />
    </>
  );
};
