import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

/** Blocks rendering until the brand fonts are decoded, so no frame ever shows a fallback face. */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('400 16px "Geist Variable"'),
      document.fonts.load('600 16px "Geist Variable"'),
      document.fonts.load('400 16px "Geist Mono Variable"'),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle));
  }, [handle]);
  return <>{children}</>;
};
