#!/usr/bin/env python3
"""Octave-band long-term spectrum of the mix and its stems (dB, loudness-normalized)."""
import sys
import numpy as np
import soundfile as sf
from scipy import signal

BANDS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]


def ltas(path):
    x, sr = sf.read(path, always_2d=True)
    x = x.mean(axis=1)
    f, p = signal.welch(x, sr, nperseg=8192)
    out = []
    for c in BANDS:
        lo, hi = c / np.sqrt(2), c * np.sqrt(2)
        m = (f >= lo) & (f < hi)
        out.append(10 * np.log10(np.sum(p[m]) + 1e-20))
    out = np.array(out)
    return out - np.max(out)


if __name__ == '__main__':
    print('band   ' + ' '.join(f'{b:>6}' for b in BANDS))
    for path in sys.argv[1:]:
        v = ltas(path)
        print(f'{path.split("/")[-1][:12]:12} ' + ' '.join(f'{x:6.1f}' for x in v))
