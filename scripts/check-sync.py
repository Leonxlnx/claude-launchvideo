#!/usr/bin/env python3
"""Fails if the audio in a rendered mp4 is offset from public/audio/soundtrack.wav by more than 1 ms."""
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal

video = sys.argv[1]
ref, sr = sf.read(sys.argv[2] if len(sys.argv) > 2 else 'public/audio/soundtrack.wav', always_2d=True)
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', video, '-f', 'f32le', '-ac', '2', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
dec = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
worst = 0
for t in (4.0, 14.0, 28.0):
    a, b = int(t * sr), int((t + 2.0) * sr)
    r = ref[a:b, 0]
    d = dec[a - 4800:b + 4800, 0]
    c = signal.correlate(d, r, mode='valid')
    lag = int(np.argmax(c)) - 4800
    worst = max(worst, abs(lag))
    print(f'  t={t:5.1f}s  lag {lag:+d} samples')
ok = worst <= 48
print('sync OK' if ok else f'sync FAIL: {worst} samples')
sys.exit(0 if ok else 1)
