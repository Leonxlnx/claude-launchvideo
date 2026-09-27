#!/usr/bin/env python3
"""Decides how many motion-blur samples each frame needs, from how fast things move on screen.

Optical flow on the sharp render gives, per frame, the speed of the fastest moving content
(pixels that actually change). A frame is then rendered as n sub-frames across the shutter so
neighbouring samples are at most STEP px apart: fast moves smear instead of stamping copies, and
still frames render once.

Usage: python3 scripts/measure-speed.py <sharp.mp4> <out/samples.json>
"""
import json
import math
import subprocess
import sys

import cv2
import numpy as np

SHUTTER = 240 / 360  # fraction of a frame the shutter is open (must match src/blur.ts)
STEP = 3.0  # max px between neighbouring samples at 1080p
N_MIN, N_MAX = 4, 48
STILL = 2.0  # px/frame below which a frame renders once
W, H = 960, 540  # analysis resolution (half of 1080p)

src, out = sys.argv[1:3]
dec = subprocess.Popen(
    ['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    stdout=subprocess.PIPE,
)
frames = []
while True:
    b = dec.stdout.read(W * H)
    if len(b) < W * H:
        break
    frames.append(np.frombuffer(b, np.uint8).reshape(H, W))
dec.wait()

# v[i] = speed of the move from frame i-1 to frame i (px per frame at 1080p)
v = [0.0]
for a, b in zip(frames, frames[1:]):
    moving = cv2.absdiff(a, b) > 6
    if moving.sum() < 20:
        v.append(0.0)
        continue
    # dense flow sees large moving surfaces; tracked corners see small fast objects (the red dot,
    # the cursor) that dense flow smooths away. Take the faster of the two.
    flow = cv2.calcOpticalFlowFarneback(a, b, None, 0.5, 5, 21, 3, 7, 1.5, 0)
    dense = float(np.percentile(np.hypot(flow[..., 0], flow[..., 1])[moving], 95))
    sparse = 0.0
    pts = cv2.goodFeaturesToTrack(a, 600, 0.01, 5, mask=cv2.dilate(moving.astype(np.uint8), None, iterations=4))
    if pts is not None:
        lk = dict(winSize=(21, 21), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
        fwd, st1, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None, **lk)
        back, st2, _ = cv2.calcOpticalFlowPyrLK(b, a, fwd, None, **lk)
        ok = (st1[:, 0] == 1) & (st2[:, 0] == 1) & (np.linalg.norm((back - pts)[:, 0], axis=1) < 1.0)
        if ok.sum() >= 3:
            sparse = float(np.percentile(np.linalg.norm((fwd - pts)[ok, 0], axis=1), 98))
    v.append(max(dense, sparse) * (1920 / W))

speed = [max(v[i], v[i + 1] if i + 1 < len(v) else 0.0) for i in range(len(v))]
groups = []
for s in speed:
    if s < STILL:
        groups.append(1)
    else:
        groups.append(int(min(N_MAX, max(N_MIN, math.ceil(SHUTTER * s / STEP)))))

json.dump({'groups': groups, 'speed': [round(s, 1) for s in speed]}, open(out, 'w'))
hist = np.bincount(np.minimum(groups, N_MAX), minlength=N_MAX + 1)
print(f'{len(groups)} frames -> {sum(groups)} sub-frames; still {hist[1]}, '
      f'4-8: {hist[4:9].sum()}, 9-24: {hist[9:25].sum()}, 25+: {hist[25:].sum()}; peak {max(speed):.0f} px/f')
