#!/usr/bin/env python3
"""Temporal motion blur by accumulation.

Reads the sub-frame render (the LaunchSub composition) and averages each output frame's
sub-frames in floating point, then encodes the master. Quantizing once, at the end, keeps smooth
gradients smooth and static pixels exact (see src/blur.ts for why this is not done in Chromium).
A 1-LSB triangular dither before quantizing keeps the dark glows free of banding.

Usage: python3 scripts/accumulate.py <sub.mp4> <samples.json> <out.mp4>
"""
import json
import subprocess
import sys

import numpy as np

W, H = 1920, 1080
FRAME = W * H * 3  # rgb48le samples per frame

src, groups_path, out = sys.argv[1:4]
groups = json.load(open(groups_path))['groups']

dec = subprocess.Popen(
    ['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb48le', '-'],
    stdout=subprocess.PIPE,
)
enc = subprocess.Popen(
    [
        'ffmpeg', '-v', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgb48le', '-s', f'{W}x{H}', '-r', '60', '-i', '-',
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        '-movflags', '+faststart', out,
    ],
    stdin=subprocess.PIPE,
)

buf = bytearray(FRAME * 2)
view = memoryview(buf)


def read_frame():
    got = 0
    while got < len(buf):
        n = dec.stdout.readinto(view[got:])
        if not n:
            raise SystemExit(f'sub-frame stream ended early ({got} of {len(buf)} bytes)')
        got += n
    return np.frombuffer(buf, dtype='<u2')


# triangular (TPDF) dither of +-1 LSB at 8 bits, a small bank cycled over the frames
rng = np.random.default_rng(7)
DITHER = [((rng.random(FRAME, dtype=np.float32) + rng.random(FRAME, dtype=np.float32)) - 1.0) * 257.0 for _ in range(6)]

acc = np.zeros(FRAME, dtype=np.float32)
for i, n in enumerate(groups):
    acc[:] = 0
    for _ in range(n):
        acc += read_frame()
    acc /= n
    acc += DITHER[i % len(DITHER)]
    enc.stdin.write(np.clip(acc + 0.5, 0, 65535).astype('<u2').tobytes())
    if i % 240 == 0:
        print(f'  accumulated {i}/{len(groups)} frames', flush=True)

extra = dec.stdout.read(1)
enc.stdin.close()
enc.wait()
dec.wait()
if extra:
    raise SystemExit('sub-frame stream has more frames than subframes.json expects')
print(f'wrote {out}: {len(groups)} frames from {sum(groups)} sub-frames')
