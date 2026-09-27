import { Composition, Folder } from 'remotion';
import { FontGate } from './lib/FontGate';
import { Launch } from './Launch';
import { LaunchSub, subMetadata } from './LaunchSub';
import { Act1Fit } from './acts/Act1Fit';
import { Act2Mark } from './acts/Act2Mark';
import { Act3Prompt } from './acts/Act3Prompt';
import { Act4Plan } from './acts/Act4Plan';
import { Act5Features } from './acts/Act5Features';
import { Act6End } from './acts/Act6End';
import { LogoLab } from './LogoLab';
import { AppLab } from './AppLab';
import { ACT, FPS, H, TOTAL, W } from './timeline';

const wrap = (C: React.FC) => () => (
  <FontGate>
    <C />
  </FontGate>
);

export const RemotionRoot: React.FC = () => (
  <>
    {/* The film. */}
    <Composition id="Launch" component={Launch} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
    {/* The film as sub-frames for the motion-blurred master (scripts/render.sh --blur averages them). */}
    <Composition
      id="LaunchSub"
      component={LaunchSub}
      durationInFrames={TOTAL}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ groups: [] as number[] }}
      calculateMetadata={subMetadata}
    />

    {/* Each act on its own, for iterating without scrubbing the whole film. */}
    <Folder name="Acts">
      <Composition id="Act1" component={wrap(Act1Fit)} durationInFrames={ACT.fit.dur} fps={FPS} width={W} height={H} />
      <Composition id="Act2" component={wrap(Act2Mark)} durationInFrames={ACT.mark.dur} fps={FPS} width={W} height={H} />
      <Composition id="Act3" component={wrap(Act3Prompt)} durationInFrames={ACT.prompt.dur} fps={FPS} width={W} height={H} />
      <Composition id="Act4" component={wrap(Act4Plan)} durationInFrames={ACT.plan.dur} fps={FPS} width={W} height={H} />
      <Composition id="Act5" component={wrap(Act5Features)} durationInFrames={ACT.feat.dur} fps={FPS} width={W} height={H} />
      <Composition id="Act6" component={wrap(Act6End)} durationInFrames={ACT.end.dur} fps={FPS} width={W} height={H} />
    </Folder>

    {/* Brand and product studies: the logo exploration and the app's two week states. */}
    <Folder name="Brand">
      <Composition id="LogoLab" component={LogoLab} durationInFrames={1} fps={FPS} width={W} height={H} />
      <Composition id="AppBefore" component={AppLab} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={{ state: 'before' as const }} />
      <Composition id="AppAfter" component={AppLab} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={{ state: 'after' as const }} />
    </Folder>
  </>
);
