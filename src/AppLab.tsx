import { AbsoluteFill } from 'remotion';
import { CalendarApp, evRect } from './app/CalendarApp';
import { AFTER, BEFORE } from './app/data';
import { FontGate } from './lib/FontGate';

export const AppLab: React.FC<{ state: 'before' | 'after' }> = ({ state }) => {
  const list = state === 'before' ? BEFORE : AFTER;
  return (
    <FontGate>
      <AbsoluteFill style={{ background: '#E9EAED', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: 'scale(1.1)' }}>
          <CalendarApp
            events={list.map((ev) => ({ ev, s: { rect: evRect(ev) } }))}
            prioIn={state === 'after' ? [1, 1, 1] : [0, 0, 0]}
            prompt={state === 'after' ? [{ text: 'Protect my ' }, { text: 'mornings', chip: true }, { text: '. ' }, { text: 'Gym Tue + Thu', chip: true }, { text: '. Ship the deck by ' }, { text: 'Friday', chip: true }, { text: '.' }] : []}
            chipIn={[0, 1, 0, 1, 0, 1, 0]}
            caret
          />
        </div>
      </AbsoluteFill>
    </FontGate>
  );
};
