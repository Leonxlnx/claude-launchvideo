#!/usr/bin/env python3
"""
Tessel launch film — soundtrack + sound design, synthesized from scratch.

Reads out/cues.json (exported from the same timeline the picture uses) and writes
public/audio/soundtrack.wav (48 kHz stereo) plus stems in out/stems/.

Everything is deterministic (seeded), so re-running reproduces the exact mix.
"""
import json
import os
import sys

import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUES = json.load(open(os.path.join(ROOT, 'out', 'cues.json')))
FPS = CUES['fps']
DUR = CUES['total'] / FPS + 1.2  # tail rendered, trimmed/faded at the end
N = int(DUR * SR)
BPM = CUES['bpm']
BEAT = 60.0 / BPM
BAR = BEAT * 4
rng = np.random.default_rng(7)


def fr(frame):
    """frame → seconds"""
    return frame / FPS


def bar(n, beat=0.0):
    """1-indexed bar, beat offset → seconds"""
    return (n - 1) * BAR + beat * BEAT


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------------------------------
# buffers
# ---------------------------------------------------------------------------------------
def buf():
    return np.zeros((N, 2), dtype=np.float64)


def place(dst, x, t, gain=1.0, pan=0.0):
    """Add mono or stereo signal x into dst at time t (seconds) with constant-power pan."""
    i = int(round(t * SR))
    if i >= N:
        return
    if x.ndim == 1:
        a = (pan + 1) * np.pi / 4
        x = np.stack([x * np.cos(a), x * np.sin(a)], axis=1)
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), N - i)
    dst[i:i + n] += x[:n] * gain


def tt(d):
    return np.arange(int(d * SR)) / SR


# ---------------------------------------------------------------------------------------
# DSP helpers
# ---------------------------------------------------------------------------------------
def sos_lp(f, order=2):
    return signal.butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos')


def sos_hp(f, order=2):
    return signal.butter(order, max(f, 10), 'high', fs=SR, output='sos')


def sos_bp(lo, hi, order=2):
    return signal.butter(order, [max(lo, 10), min(hi, SR * 0.45)], 'band', fs=SR, output='sos')


def filt(x, sos):
    return signal.sosfilt(sos, x, axis=0)


def sweep_filter(x, cutoffs, kind='low', q_order=2, block=256):
    """Time-varying filter: cutoffs is an array (per sample) of cutoff Hz. Processed in blocks."""
    y = np.zeros_like(x)
    zi = None
    for s in range(0, len(x), block):
        c = float(np.mean(cutoffs[s:s + block]))
        if kind == 'low':
            sos = sos_lp(c, q_order)
        elif kind == 'high':
            sos = sos_hp(c, q_order)
        else:
            sos = sos_bp(c / 1.35, c * 1.35, q_order)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        seg, zi = signal.sosfilt(sos, x[s:s + block], axis=0, zi=zi)
        y[s:s + block] = seg
    return y


def noise(d):
    return rng.standard_normal(int(d * SR))


def expdec(d, tau):
    return np.exp(-tt(d) / tau)


def adsr(d, a=0.005, dcy=0.1, s=0.7, r=0.2):
    n = int(d * SR)
    env = np.ones(n) * s
    na, nd, nr = int(a * SR), int(dcy * SR), int(r * SR)
    na = max(1, min(na, n))
    env[:na] = np.linspace(0, 1, na)
    if na + nd < n:
        env[na:na + nd] = np.linspace(1, s, nd)
    if nr > 0 and nr < n:
        env[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return env


def saw_blep(freq, d, phase0=0.0):
    """PolyBLEP band-limited saw with (optionally) time-varying frequency array."""
    n = int(d * SR)
    f = np.full(n, freq) if np.isscalar(freq) else freq[:n]
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    # polyBLEP
    m1 = ph < dt
    t1 = ph[m1] / dt[m1]
    y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = ph > 1 - dt
    t2 = (ph[m2] - 1) / dt[m2]
    y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def sine(freq, d, phase0=0.0):
    n = int(d * SR)
    f = np.full(n, freq) if np.isscalar(freq) else freq[:n]
    return np.sin(2 * np.pi * (phase0 + np.cumsum(f) / SR))


def sat(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def make_ir(rt60=2.4, pre=0.02, lp=6500, width=1.0, seed=3):
    r = np.random.default_rng(seed)
    d = rt60 * 1.2
    n = int(d * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / rt60)
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], axis=1) * env[:, None]
    # darken the tail over time (air absorption)
    ir = filt(ir, sos_lp(lp, 1))
    mid = ir.mean(axis=1, keepdims=True)
    ir = mid + (ir - mid) * width
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    return ir / np.sqrt(np.sum(ir ** 2))


IR_HALL = make_ir(2.8, 0.025, 5500, 1.0, 3)
IR_ROOM = make_ir(0.7, 0.008, 7000, 0.8, 5)


def reverb(x, ir):
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    y = np.stack([signal.fftconvolve(x[:, 0], ir[:, 0])[:len(x)], signal.fftconvolve(x[:, 1], ir[:, 1])[:len(x)]], axis=1)
    return y


def pingpong(x, delay_s, fb=0.35, mix=0.3, lp=4000):
    d = int(delay_s * SR)
    y = np.zeros_like(x)
    tap = x.copy()
    for k in range(1, 7):
        tap = filt(tap, sos_lp(lp, 1)) * fb
        sh = d * k
        if sh >= len(x):
            break
        side = 0 if k % 2 else 1
        y[sh:, side] += tap[:len(x) - sh, side] + tap[:len(x) - sh, 1 - side] * 0.3
    return x + y * mix / fb


# ---------------------------------------------------------------------------------------
# instruments
# ---------------------------------------------------------------------------------------
def kick(d=0.6, hard=1.0):
    t = tt(d)
    f = 48 + 110 * np.exp(-t / 0.035) + 40 * np.exp(-t / 0.006)
    body = sine(f, d) * np.exp(-t / (0.26 * hard + 0.05))
    click = filt(noise(d), sos_hp(2500)) * np.exp(-t / 0.0025) * 0.35
    return sat(body * 1.1 + click, 1.8) * 0.9


def sub_boom(d=2.5, f0=52, f1=36):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.4)
    x = sine(f, d) * np.exp(-t / 0.9)
    x += sine(f * 2, d) * np.exp(-t / 0.25) * 0.25
    x = sat(x, 1.4)
    thump = filt(noise(d), sos_lp(180, 2)) * np.exp(-t / 0.05) * 0.6
    return x * 0.9 + thump


def clap(d=0.45):
    t = tt(d)
    n = filt(noise(d), sos_bp(900, 5200, 2))
    env = np.zeros_like(t)
    for k, off in enumerate([0, 0.009, 0.019, 0.028]):
        env += (t >= off) * np.exp(-np.maximum(t - off, 0) / (0.006 if k < 3 else 0.11))
    return n * env * 0.8


def hat(d=0.12, tau=0.018, bright=7500):
    t = tt(d)
    x = filt(noise(d), sos_hp(bright, 2))
    # a bit of metallic ring
    ring = sum(np.sin(2 * np.pi * f * t) for f in (8100, 10900, 13300)) * 0.08
    return (x + ring) * np.exp(-t / tau) * 0.5


def tick(freq=3200, d=0.05, tau=0.006, body=0.6):
    t = tt(d)
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t / tau) * body
    x += filt(noise(d), sos_hp(5000)) * np.exp(-t / 0.0015) * 0.5
    return x


def tock(freq=1100, d=0.12, tau=0.03, low=0.4):
    """Wooden landing sound: resonant band + little low thump."""
    t = tt(d)
    n = noise(d) * np.exp(-t / 0.004)
    res = filt(n, sos_bp(freq * 0.85, freq * 1.18, 2)) * 6
    res *= np.exp(-t / tau)
    th = np.sin(2 * np.pi * 140 * t) * np.exp(-t / 0.025) * low
    return res + th


def key_click(seed):
    r = np.random.default_rng(seed)
    d = 0.05
    t = tt(d)
    f = 2400 + r.random() * 2200
    x = filt(noise(d), sos_bp(f * 0.7, f * 1.3, 2)) * np.exp(-t / (0.004 + r.random() * 0.004))
    x += np.sin(2 * np.pi * (180 + r.random() * 60) * t) * np.exp(-t / 0.012) * 0.25
    return x * (0.55 + r.random() * 0.35)


def ui_click(d=0.25):
    t = tt(d)
    c = filt(noise(d), sos_hp(3000)) * np.exp(-t / 0.0012)
    ping = np.sin(2 * np.pi * 1850 * t) * np.exp(-t / 0.03) * 0.35
    low = np.sin(2 * np.pi * (95 + 40 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05) * 0.8
    return c * 0.8 + ping + low


def snap(d=0.6, weight=1.0):
    """Logo-lock snap: tight click + body + short tail."""
    t = tt(d)
    c = filt(noise(d), sos_bp(1800, 9000, 2)) * np.exp(-t / 0.003) * 1.2
    body = np.sin(2 * np.pi * (220 + 180 * np.exp(-t / 0.008)) * t) * np.exp(-t / 0.045) * 0.7
    low = np.sin(2 * np.pi * (60 + 30 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.16) * weight
    return sat(c + body + low, 1.3)


def fm_bell(midi, d=3.0, idx=2.2, ratio=3.5, tau=1.2):
    t = tt(d)
    fc = mtof(midi)
    mod = np.sin(2 * np.pi * fc * ratio * t) * idx * np.exp(-t / 0.35)
    x = np.sin(2 * np.pi * fc * t + mod) * np.exp(-t / tau)
    x += np.sin(2 * np.pi * fc * 2.0 * t) * np.exp(-t / (tau * 0.35)) * 0.15
    att = np.minimum(1, t / 0.003)
    return x * att


def whoosh(d=0.8, f0=180, f1=1400, f2=300, peak=0.55, width=1.0, air=0.12):
    """Camera-move whoosh: brown+pink-ish noise through a moving band; peak = max camera velocity."""
    n = int(d * SR)
    t = np.arange(n) / SR
    u = t / d
    cut = np.where(u < peak, f0 * (f1 / f0) ** (u / peak), f1 * (f2 / f1) ** ((u - peak) / (1 - peak)))
    def colored():
        w = noise(d)
        brown = np.cumsum(w)
        brown = filt(brown, sos_hp(30, 2))
        brown /= np.max(np.abs(brown)) + 1e-9
        return brown * 0.7 + filt(w, sos_lp(4000, 1)) * 0.3
    x = np.stack([colored(), colored()], axis=1)
    y = sweep_filter(x, cut, 'band') * 2.2
    a = filt(np.stack([noise(d), noise(d)], axis=1), sos_hp(4000, 2)) * air
    env = np.where(u < peak, (u / peak) ** 2, np.exp(-(u - peak) * d / 0.18))
    y = (y + a) * env[:, None]
    pan = np.linspace(-0.6 * width, 0.6 * width, n)
    ang = (pan + 1) * np.pi / 4
    y[:, 0] *= np.cos(ang) * 1.4
    y[:, 1] *= np.sin(ang) * 1.4
    return y


def blip(f0=587.33, up=True, d=0.12):
    """Word-reveal blip: a short sine with an upward (or downward) glide and one slap echo."""
    t = tt(d)
    if up:
        f = f0 * 2.9 ** (1 - np.exp(-t / 0.018))
    else:
        f = f0 * 0.53 ** (1 - np.exp(-t / 0.012))
    x = sine(f, d) + sine(2 * f, d) * 0.1
    x *= np.minimum(1, t / 0.001) * np.exp(-t / 0.012)
    out = np.zeros(int((d + 0.06) * SR))
    out[: len(x)] += x
    e = int(0.055 * SR)
    out[e: e + len(x)] += x * 0.35
    return out


def riser(d=2.0, f0=250, f1=7000, tone=True, midi=56):
    n = int(d * SR)
    t = np.arange(n) / SR
    u = t / d
    cut = f0 * (f1 / f0) ** (u ** 1.3)
    x = np.stack([noise(d), noise(d)], axis=1)
    y = sweep_filter(x, cut, 'band') * (u ** 2.2)[:, None] * 0.9
    if tone:
        f = mtof(midi) * 2 ** (u ** 2 * 1.0)
        s = (saw_blep(f, d) * 0.5 + saw_blep(f * 1.005, d) * 0.5)
        s = sweep_filter(s, 400 + 5000 * u ** 2, 'low') * (u ** 2.5) * 0.35
        y += np.stack([s, s], axis=1)
    return y


def reverse_suck(d=0.5):
    x = whoosh(d, 6000, 900, 200, peak=0.85)
    return x


def supersaw_note(midi, d, voices=5, detune=0.10, cutoff=1800, a=0.25, r=0.8, bright_env=None):
    tot = np.zeros((int(d * SR), 2))
    for v in range(voices):
        off = (v - (voices - 1) / 2) / ((voices - 1) / 2 + 1e-9) * detune
        f = mtof(midi + off)
        s = saw_blep(f, d, phase0=rng.random())
        pan = (v / (voices - 1) - 0.5) * 1.4
        ang = (pan + 1) * np.pi / 4
        tot[:, 0] += s * np.cos(ang)
        tot[:, 1] += s * np.sin(ang)
    tot /= voices
    if bright_env is not None:
        tot = sweep_filter(tot, bright_env[:len(tot)], 'low')
    else:
        tot = filt(tot, sos_lp(cutoff, 2))
    env = adsr(d, a, 0.3, 0.85, r)
    return tot * env[:, None]


def pluck(midi, d=0.5, cutoff0=5200, cutoff1=500, tau_f=0.09, tau_a=0.22):
    n = int(d * SR)
    t = np.arange(n) / SR
    f = mtof(midi)
    s = saw_blep(f, d) * 0.6 + np.sign(np.sin(2 * np.pi * f * 1.0 * t + 0.3)) * 0.18 + sine(f * 2, d) * 0.1
    cut = cutoff1 + (cutoff0 - cutoff1) * np.exp(-t / tau_f)
    y = sweep_filter(s, cut, 'low', 2, 128)
    return y * np.exp(-t / tau_a) * np.minimum(1, t / 0.002)


def bass_note(midi, d, drive=1.3):
    n = int(d * SR)
    t = np.arange(n) / SR
    f = mtof(midi)
    x = sine(f, d) + sine(f * 2, d) * 0.22 + saw_blep(f, d) * 0.06
    x = filt(x, sos_lp(900, 2))
    x = sat(x, drive) * adsr(d, 0.006, 0.12, 0.8, 0.08)
    return x


# ---------------------------------------------------------------------------------------
# harmony: Ab major. IV – I/3 – vi – V(sus)
# ---------------------------------------------------------------------------------------
CH = {
    'Db': dict(pad=[49, 53, 56, 60, 63], bass=37, arp=[65, 68, 72, 75]),
    'Ab/C': dict(pad=[48, 51, 56, 60, 63], bass=36, arp=[63, 68, 72, 75]),
    'Fm9': dict(pad=[53, 56, 60, 63, 67], bass=41, arp=[65, 68, 72, 79]),
    'Eb': dict(pad=[51, 55, 58, 63, 65], bass=39, arp=[63, 67, 70, 75]),
    'Ab': dict(pad=[44, 51, 56, 60, 63, 70], bass=32, arp=[68, 72, 75, 80]),
    'Fm': dict(pad=[41, 48, 53, 56, 60], bass=29, arp=[65, 68, 72, 77]),
    'Gb': dict(pad=[42, 49, 54, 58, 61], bass=30, arp=[66, 70, 73, 78]),
}

# chord per bar (bars 1..17)
PROG = {
    1: 'Fm', 2: 'Fm', 3: 'Gb',
    4: 'Db', 5: 'Ab/C', 6: 'Fm9', 7: 'Eb',
    8: 'Db', 9: 'Ab/C', 10: 'Fm9', 11: 'Eb',
    12: 'Db', 13: 'Fm9', 14: 'Eb',
    15: 'Ab', 16: 'Ab', 17: 'Ab',
}


# ---------------------------------------------------------------------------------------
# build stems
# ---------------------------------------------------------------------------------------
def build_music():
    drums, bass, pad, arp, bells = buf(), buf(), buf(), buf(), buf()
    kicks = []

    # ---- pad (all bars, brightness automates by section) --------------------------------
    for b in range(1, 17):
        name = PROG[b]
        start = bar(b)
        d = BAR + 0.9
        if b <= 3:
            level, cut = 0.22 * (0.55 + 0.25 * (b - 1)), 700 + 250 * b
        elif b in (6, 7):
            level, cut = 0.26, 1100  # typing: tucked away
        elif b in (8, 9):
            level, cut = 0.34, 3200
        elif b in (13, 14):
            level, cut = 0.38, 2400 + (b - 13) * 900
        elif b >= 15:
            level, cut = 0.40, 2600
        else:
            level, cut = 0.30, 2200
        notes = CH[name]['pad']
        for m in notes:
            x = supersaw_note(m, d, voices=5, detune=0.11, cutoff=cut, a=0.12 if b != 4 else 0.02, r=0.9)
            place(pad, x, start, gain=level / len(notes) * 2.2)

    pad = filt(pad, sos_hp(170, 2))

    # intro drone (Ab + Eb) that swells into bar 3
    d = bar(4) - 0.15
    t = tt(d)
    drone = sine(mtof(32), d) * 0.5 + sine(mtof(39), d) * 0.3 + saw_blep(mtof(44), d) * 0.05
    drone = filt(drone, sos_lp(500, 2)) * np.minimum(1, t / 1.6) * (0.5 + 0.5 * (t / d) ** 2)
    drone[-int(0.25 * SR):] *= np.linspace(1, 0, int(0.25 * SR))
    place(pad, drone, 0.0, gain=0.16)

    # ---- drums ------------------------------------------------------------------------
    def K(t, g=1.0, hard=1.0):
        place(drums, kick(0.6, hard), t, g)
        kicks.append((t, g))

    for b in range(4, 17):
        s = bar(b)
        if b in (4, 5):  # logo: half-time, cinematic
            K(s, 1.0)
            K(s + 1.75 * BEAT, 0.55)
            K(s + 2 * BEAT, 0.85)
            place(drums, clap(), s + 2 * BEAT, 0.42)
            for k in range(8):
                place(drums, hat(0.08, 0.012), s + k * BEAT / 2 + BEAT / 2 * (k % 2 == 1) * 0, 0.10 if k % 2 else 0.05, pan=0.25)
        elif b in (6, 7):  # typing: just a heartbeat + ticking hats
            K(s, 0.55, 0.8)
            if b == 7:
                K(s + 2 * BEAT, 0.45, 0.8)
            for k in range(16):
                place(drums, hat(0.05, 0.008, 9000), s + k * BEAT / 4, 0.045 + 0.03 * (k % 4 == 2), pan=-0.2 + 0.4 * (k % 2))
        elif b in (8, 9):  # the fitting: full groove
            for q in range(4):
                K(s + q * BEAT, 1.0 if q == 0 else 0.85)
                place(drums, hat(0.25, 0.07, 6500), s + q * BEAT + BEAT / 2, 0.16, pan=0.2)
            place(drums, clap(), s + BEAT, 0.40)
            place(drums, clap(), s + 3 * BEAT, 0.44)
            for k in range(16):
                if k % 2:
                    place(drums, hat(0.05, 0.01, 9500), s + k * BEAT / 4, 0.06, pan=-0.3)
        elif b in (10, 11, 12):  # features: lighter, still moving
            K(s, 0.9)
            K(s + 2.5 * BEAT, 0.6)
            place(drums, clap(), s + 2 * BEAT, 0.34)
            for k in range(8):
                place(drums, hat(0.12, 0.03, 7000), s + k * BEAT / 2, 0.07 + 0.04 * (k % 2), pan=0.15)
        elif b in (13, 14):  # breakdown: no kick, a ticking clock
            for k in range(8):
                place(drums, tick(3000 if k % 2 == 0 else 2300, 0.05, 0.005, 0.5), s + k * BEAT / 2, 0.10 + 0.03 * (b == 14))
        elif b == 15:
            K(s, 1.0, 1.4)
        elif b == 16:
            pass

    # ---- bass --------------------------------------------------------------------------
    for b in range(4, 16):
        name = PROG[b]
        m = CH[name]['bass']
        s = bar(b)
        if b in (8, 9):
            for k in range(8):  # driving 8ths
                place(bass, bass_note(m + (12 if k in (3, 7) else 0), BEAT / 2 * 0.95), s + k * BEAT / 2, 0.40)
        elif b in (6, 7):
            place(bass, bass_note(m, BAR * 0.98, 1.1), s, 0.22)
        elif b in (13, 14):
            place(bass, bass_note(m, BAR * 0.98, 1.1), s, 0.20)
        elif b == 15:
            place(bass, bass_note(CH['Ab']['bass'], BAR * 2.2, 1.2), s, 0.36)
        else:
            place(bass, bass_note(m, BEAT * 1.5), s, 0.36)
            place(bass, bass_note(m, BEAT * 0.45), s + 1.75 * BEAT, 0.26)
            place(bass, bass_note(m, BEAT * 1.9), s + 2 * BEAT, 0.34)

    # ---- pluck arp -----------------------------------------------------------------------
    pattern = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
    for b in range(4, 16):
        name = PROG[b]
        notes = CH[name]['arp']
        s = bar(b)
        if b in (6, 7):
            gain = 0.05
            step = 2  # 8ths, tucked
        elif b in (8, 9):
            gain = 0.13
            step = 1
        elif b in (13, 14):
            gain = 0.09
            step = 1
        elif b == 15:
            continue
        else:
            gain = 0.09
            step = 2
        for k in range(0, 16, step):
            m = notes[pattern[k]] + (12 if (b in (8, 9) and k in (6, 14)) else 0)
            place(arp, pluck(m, 0.45, 4200 if b in (8, 9) else 3000), s + k * BEAT / 4, gain * (1.0 if k % 4 == 0 else 0.75), pan=(-0.35 if k % 2 else 0.35))
    arp = pingpong(arp, BEAT * 0.75, fb=0.32, mix=0.28)

    # ---- bells: logo moments ---------------------------------------------------------------
    for m, off, g in [(68, 0.0, 0.10), (75, 0.02, 0.07), (80, 0.04, 0.05)]:
        place(bells, fm_bell(m, 3.5, 1.8, 3.5, 1.4), fr(CUES['cue']['drop1']) + off, g)
    for m, off, g in [(72, 0.0, 0.07), (75, BEAT / 2, 0.06), (80, BEAT, 0.06)]:
        place(bells, fm_bell(m, 2.5, 1.6, 3.5, 1.0), fr(CUES['cue']['lockup']) + off, g, pan=0.2)
    for m, off, g in [(56, 0.0, 0.10), (68, 0.0, 0.10), (72, 0.03, 0.08), (75, 0.05, 0.07), (82, 0.08, 0.05)]:
        place(bells, fm_bell(m, 4.5, 2.0, 3.5, 1.8), fr(CUES['cue']['fits']) + off, g)
    for m, off, g in [(80, 0.0, 0.06), (84, BEAT / 2, 0.05)]:
        place(bells, fm_bell(m, 3.0, 1.4, 3.5, 1.3), fr(CUES['sfx']['lockup2']) + off, g, pan=-0.15)

    return dict(drums=drums, bass=bass, pad=pad, arp=arp, bells=bells, kicks=kicks)


def build_sfx():
    fx = buf()
    c = CUES['cue']
    s = CUES['sfx']

    # Act 1 — the clock: a soft tick-tock on every beat until the headline lands (the sonic signature)
    for k in range(1, 8):
        tb = k * BEAT
        place(fx, tick(3000 if k % 2 else 2250, 0.06, 0.006, 0.6), tb, 0.055 + 0.01 * (k % 2), pan=-0.15 if k % 2 else 0.15)
    # the dot, the line, the grid; rain of meetings; slam; implosion
    place(fx, tick(2600, 0.1, 0.012, 0.8), fr(c['dotIn']), 0.30)
    place(fx, whoosh(0.5, 2000, 7000, 3000, 0.3, 0.5), fr(c['lineDraw']) - 0.02, 0.05)
    for k in range(9):
        place(fx, tick(2200 + 200 * (k % 3), 0.04, 0.004, 0.5), fr(c['gridDraw']) + k * 0.035, 0.05, pan=(k - 4) / 5)
    for i, f in enumerate(CUES['rain']):
        r = np.random.default_rng(100 + i)
        place(fx, tock(1000 + r.random() * 900, 0.1, 0.02 + r.random() * 0.02, 0.25), fr(f), 0.10 + 0.08 * (i / len(CUES['rain'])), pan=r.random() * 1.6 - 0.8)
    for i, f0 in enumerate([587.33, 783.99]):  # "Your" "week"
        place(fx, blip(f0), fr(c['yourWeek'] + i * 9 + 3), 0.09)
    for i in range(5):  # "The calendar that plans itself."
        place(fx, blip([783.99, 880, 987.77, 1174.66, 1318.5][i]), fr(c['descriptor'] - 20 + i * 5 + 3), 0.035, pan=(i - 2) / 6)
    place(fx, riser(1.9, 200, 6000, True, 53), fr(c['yourWeek']) + 0.1, 0.20)
    place(fx, sub_boom(2.2, 58, 38), fr(c['doesntFit']), 0.55)
    place(fx, clap(0.5), fr(c['doesntFit']), 0.35)
    place(fx, filt(noise(0.6), sos_bp(200, 3000)) * expdec(0.6, 0.12), fr(c['doesntFit']), 0.20)
    place(fx, riser(1.4, 400, 9000, True, 60), fr(c['doesntFit']) + 0.25, 0.14)
    place(fx, reverse_suck(0.36), fr(c['implodeStart']), 0.55)

    # Act 2 — drop 1: flood + mark snaps + wordmark swoosh + fly into app
    place(fx, sub_boom(2.6, 60, 36), fr(c['drop1']), 0.75)
    place(fx, whoosh(0.35, 150, 1400, 300, 0.2), fr(c['drop1']), 0.22)
    place(fx, snap(0.6, 0.8), fr(s['markSnapA']), 0.42, pan=-0.2)
    place(fx, snap(0.6, 1.0), fr(s['markSnapB']), 0.46, pan=0.2)
    place(fx, whoosh(0.55, 500, 3500, 1200, 0.35, 0.6), fr(s['wordmark']) - 0.05, 0.12)
    place(fx, whoosh(0.75, 250, 3000, 500, 0.6, 1.0), fr(s['flyWhoosh']), 0.22)

    # Act 3 — week loads, zoom, typing, click, flood
    for i, f in enumerate(CUES['cascade']):
        place(fx, tick(2800 + (i % 5) * 180, 0.03, 0.003, 0.5), fr(f), 0.035, pan=(i % 7 - 3) / 4)
    place(fx, whoosh(0.9, 200, 1800, 400, 0.55, 0.6), fr(s['zoomWhoosh']), 0.16)
    for i, f in enumerate(CUES['keys']):
        place(fx, key_click(i), fr(f), 0.13, pan=((i * 37) % 11 - 5) / 20)
    place(fx, whoosh(0.5, 400, 2600, 700, 0.6, 0.4), fr(s['macroWhoosh']), 0.12)
    place(fx, riser(1.6, 250, 9000, True, 56), fr(c['click']) - 1.1, 0.22)
    place(fx, ui_click(), fr(s['click']), 0.60)
    place(fx, whoosh(0.3, 300, 5000, 2000, 0.9, 0.3), fr(s['flood']), 0.26)

    # Act 4 — drop 2: the fitting
    place(fx, sub_boom(2.4, 62, 38), fr(c['drop2']), 0.70)
    place(fx, whoosh(0.4, 3000, 400, 150, 0.1, 0.4), fr(c['drop2']), 0.20)
    for i, l in enumerate(CUES['landings']):
        r = np.random.default_rng(300 + i)
        if l['heavy']:
            place(fx, tock(600 + r.random() * 200, 0.2, 0.05, 1.0), fr(l['f']), 0.26, pan=r.random() - 0.5)
            place(fx, sub_boom(0.7, 70, 48), fr(l['f']), 0.20)
        else:
            place(fx, tock(1100 + r.random() * 800, 0.12, 0.028, 0.35), fr(l['f']), 0.15, pan=r.random() * 1.4 - 0.7)
    place(fx, whoosh(1.1, 200, 1600, 300, 0.45, 0.8), fr(s['straighten']), 0.16)
    place(fx, fm_bell(87, 1.2, 1.2, 2.0, 0.35), fr(s['toast']), 0.07, pan=0.1)
    place(fx, fm_bell(92, 1.2, 1.0, 2.0, 0.35), fr(s['toast']) + 0.09, 0.05, pan=0.1)

    # Act 5 — features
    place(fx, whoosh(0.7, 300, 2400, 500, 0.5, 0.6), fr(s['cardMorph']), 0.14)
    place(fx, whoosh(0.35, 800, 2500, 1200, 0.5, 0.3), fr(s['f1Lift']), 0.07)
    place(fx, tock(1300, 0.12, 0.03, 0.4), fr(s['f1Land']), 0.18)
    for i, f in enumerate(s['f1Checks']):
        place(fx, tick(3400 + i * 260, 0.05, 0.01, 0.7), fr(f), 0.07, pan=0.3)
    for f in (s['drum2'], s['drum3']):
        for k in range(3):
            place(fx, tick(2100 - k * 150, 0.04, 0.004, 0.6), fr(f) + k * 0.05, 0.10 - 0.025 * k, pan=-0.4)
    place(fx, whoosh(0.4, 600, 3000, 900, 0.8, 0.5), fr(s['f2Invite']), 0.10)
    bt = tt(0.25)
    place(fx, np.sin(2 * np.pi * (170 + 90 * np.exp(-bt / 0.02)) * bt) * np.exp(-bt / 0.06), fr(s['f2Bounce']), 0.30)
    place(fx, tick(2600, 0.06, 0.01, 0.8), fr(s['f2Reply']), 0.08)
    place(fx, fm_bell(84, 0.8, 0.8, 2.0, 0.25), fr(s['f3Late']), 0.05)
    for k in range(4):
        place(fx, tock(1400 + k * 90, 0.08, 0.02, 0.2), fr(s['f3Shift']) + 0.12 + k * 0.06, 0.07)
    place(fx, whoosh(0.7, 300, 2000, 400, 0.5, 0.6), fr(s['backToWeek']), 0.12)

    # Act 6 — pull back, the fit, lockup
    place(fx, whoosh(2.2, 150, 1200, 250, 0.4, 1.0), fr(s['pullBack']), 0.18)
    place(fx, riser(3.4, 150, 7000, True, 51), fr(c['converge']) - 1.5, 0.16)
    place(fx, whoosh(0.4, 300, 2500, 800, 0.8, -0.8), fr(s['wordsIn']), 0.10)
    place(fx, whoosh(0.4, 300, 2500, 800, 0.8, 0.8), fr(s['wordsIn']), 0.10)
    place(fx, snap(0.8, 1.2), fr(s['fitsSnap']), 0.55)
    place(fx, sub_boom(3.0, 55, 34), fr(s['fitsSnap']), 0.60)
    place(fx, snap(0.6, 0.8), fr(s['markSnap2A']), 0.34, pan=-0.2)
    place(fx, snap(0.6, 0.9), fr(s['markSnap2B']), 0.36, pan=0.2)
    place(fx, whoosh(0.55, 500, 3500, 1200, 0.35, 0.6), fr(s['lockup2']), 0.09)
    place(fx, tick(2600, 0.2, 0.02, 0.8), fr(s['finalBlink']), 0.20)
    place(fx, sub_boom(1.6, 50, 38), fr(s['finalBlink']), 0.22)
    return fx


# ---------------------------------------------------------------------------------------
# mix
# ---------------------------------------------------------------------------------------
def sidechain(kicks, depth=0.55, tau=0.14):
    g = np.ones(N)
    t = np.arange(N) / SR
    for (kt, kg) in kicks:
        i = int(kt * SR)
        seg = t[i:i + int(0.6 * SR)] - kt
        g[i:i + len(seg)] = np.minimum(g[i:i + len(seg)], 1 - depth * kg * np.exp(-seg / tau))
    return g[:, None]


def limiter(x, ceiling=0.89, look=0.004, release=0.08):
    # true-peak aware: detect on a 4x oversampled copy so inter-sample overs are caught too
    up = signal.resample_poly(x, 4, 1, axis=0)
    a4 = np.max(np.abs(up), axis=1)
    a = a4[: (len(a4) // 4) * 4].reshape(-1, 4).max(axis=1)
    a = np.pad(a, (0, max(0, len(x) - len(a))))[: len(x)]
    la = int(look * SR)
    # lookahead peak hold
    peak = np.maximum.reduce([np.roll(a, -k) for k in range(0, la, 8)])
    gain = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    # smooth release (attack is instant through lookahead)
    rel = np.exp(-1 / (release * SR))
    out = np.empty_like(gain)
    g = 1.0
    for i in range(len(gain)):
        g = gain[i] if gain[i] < g else gain[i] + (g - gain[i]) * rel
        out[i] = g
    return x * out[:, None]


def main():
    os.makedirs(os.path.join(ROOT, 'out', 'stems'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    m = build_music()
    fx = build_sfx()

    sc = sidechain(m['kicks'])
    music = (
        m['drums'] * 0.8
        + m['bass'] * sc * 0.55
        + m['pad'] * (0.55 + 0.45 * sc) * 1.6
        + m['arp'] * (0.7 + 0.3 * sc) * 1.7
        + m['bells'] * 1.5
    )
    # reverb sends
    wet = reverb(m['pad'] * 0.25 + m['arp'] * 0.35 + m['bells'] * 0.6 + m['drums'] * 0.06, IR_HALL)
    fxwet = reverb(fx * 0.18, IR_ROOM) + reverb(fx * 0.08, IR_HALL)

    # typing section: tuck the music under the keys (automation on music bus)
    t = np.arange(N) / SR
    duck = np.ones(N)
    a0, a1 = bar(6, 1), bar(8)
    duck = np.where((t > a0) & (t < a1), 0.72, 1.0)
    duck = filt(duck, sos_lp(3, 1))[:, None]

    fx = filt(fx, sos_hp(24, 2))
    # tame the sub content of the sound design (booms), keep the transients
    fx_low = filt(fx, sos_lp(90, 2))
    fx = fx - fx_low * 0.45
    # the "suck": music ducks hard for ~0.2 s right before each drop, then slams back on the downbeat
    suck = np.ones(N)
    for tdrop in (fr(CUES['cue']['drop2']), fr(CUES['cue']['fits'])):
        a = (t > tdrop - 0.2) & (t < tdrop)
        ramp = np.clip((t - (tdrop - 0.2)) / 0.04, 0, 1)
        suck = np.where(a, 1 - 0.85 * ramp, suck)
    suck = suck[:, None]
    mix = (music + wet * 0.6) * duck * suck + fx * 1.25 + fxwet
    mix = filt(mix, sos_hp(28, 2))  # clean sub rumble
    # mono below 120 Hz (keeps the low end solid on every speaker)
    mid = mix.mean(axis=1, keepdims=True)
    side = (mix[:, :1] - mix[:, 1:]) / 2
    side = filt(side, sos_hp(120, 2))
    mix = np.concatenate([mid + side, mid - side], axis=1)
    # bus compressor: 2:1 above -14 dBFS RMS (5 ms detector), 15 ms attack / 120 ms release
    det = np.sqrt(filt(np.mean(mix ** 2, axis=1), sos_lp(1 / 0.005 / (2 * np.pi) * 6.28, 1)).clip(1e-12))
    lvl = 20 * np.log10(det)
    over = np.maximum(0, lvl - (-14))
    gr_db = -over * (1 - 1 / 2)
    att, rel = np.exp(-1 / (0.015 * SR)), np.exp(-1 / (0.12 * SR))
    g = np.empty_like(gr_db)
    cur = 0.0
    for i, x in enumerate(gr_db):
        cur = x + (cur - x) * (att if x < cur else rel)
        g[i] = cur
    mix *= (10 ** (g / 20))[:, None]
    # gentle glue
    mix = sat(mix * 0.9, 1.15)

    # end: fade after the final blink, trim to film length + small tail
    end = CUES['total'] / FPS
    fade = np.clip((end + 0.9 - t) / 0.9, 0, 1) ** 1.5
    mix *= fade[:, None]

    # air: gentle high shelf (~+3 dB above 2.5 kHz)
    mix = mix + filt(mix, sos_hp(2500, 1)) * 0.25

    # loudness: -14 LUFS integrated, then a true-peak-safe limiter at -1 dBFS
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    for _ in range(3):
        lufs = meter.integrated_loudness(mix)
        mix *= 10 ** ((-14.0 - lufs) / 20)
        mix = limiter(mix, ceiling=0.85)
    mix = mix[: int((end + 0.05) * SR)]

    import soundfile as sf
    sf.write(os.path.join(ROOT, 'public', 'audio', 'soundtrack.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
    for k in ('drums', 'bass', 'pad', 'arp', 'bells'):
        sf.write(os.path.join(ROOT, 'out', 'stems', f'{k}.wav'), m[k][: len(mix)].astype(np.float32), SR)
    sf.write(os.path.join(ROOT, 'out', 'stems', 'sfx.wav'), fx[: len(mix)].astype(np.float32), SR)
    print('wrote public/audio/soundtrack.wav', f'{len(mix) / SR:.2f}s', 'peak', float(np.max(np.abs(mix))))


if __name__ == '__main__':
    main()
