import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

/**
 * Renders nothing until the brand fonts are decoded, so no frame ever shows a fallback face
 * and DOM text measurements are always taken with the real font.
 */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([
      document.fonts.load('400 16px "Geist Variable"'),
      document.fonts.load('600 16px "Geist Variable"'),
      document.fonts.load('400 16px "Geist Mono Variable"'),
    ])
      .then(() => document.fonts.ready)
      .then(() => {
        setReady(true);
        requestAnimationFrame(() => continueRender(handle));
      });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
