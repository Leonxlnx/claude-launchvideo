#!/usr/bin/env python3
"""Bakes the film's soft backdrops as dithered PNGs.

Chromium renders CSS gradients in 8 bits, so a glow spanning only a few code values (ink 11 -> 29,
table grey 231 -> 247) shows as contour rings. These images compute the same gradients in float
and quantize with a +-1 LSB triangular dither, so the steps disappear.
"""
import os

import numpy as np
from PIL import Image

W, H = 1920, 1080
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'fx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)
y, x = np.mgrid[0:H, 0:W].astype(np.float64) + 0.5


def rho(cx, cy, rx, ry):
    """CSS radial-gradient 'ellipse rx ry at cx cy' distance (1 = the ellipse)."""
    return np.hypot((x - cx * W) / (rx * W), (y - cy * H) / (ry * H))


def tpdf(shape):
    return rng.random(shape) + rng.random(shape) - 1.0


# glow on ink: radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.075), transparent 70%)
# as a white layer whose alpha is dithered (one alpha step is ~one output level over ink)
a = 0.075 * np.clip(1 - rho(0.5, 0.45, 0.7, 0.6) / 0.7, 0, 1)
alpha = np.clip(np.round(a * 255 + tpdf(a.shape)), 0, 255).astype(np.uint8)
rgba = np.dstack([np.full((H, W), 255, np.uint8)] * 3 + [alpha])
Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'glow-ink.png'), optimize=True)

# the tabletop: #E7E8EC with radial-gradient(ellipse 65% 60% at 50% 40%, #F7F8FA, transparent 75%),
# baked opaque and dithered in the output
t = np.clip(1 - rho(0.5, 0.4, 0.65, 0.6) / 0.75, 0, 1)[..., None]
bg = np.array([0xE7, 0xE8, 0xEC], np.float64)
hi = np.array([0xF7, 0xF8, 0xFA], np.float64)
rgb = bg * (1 - t) + hi * t
rgb = np.clip(np.round(rgb + tpdf(rgb.shape[:2])[..., None]), 0, 255).astype(np.uint8)
Image.fromarray(rgb, 'RGB').save(os.path.join(OUT, 'table.png'), optimize=True)
print('wrote public/fx/glow-ink.png, public/fx/table.png')
