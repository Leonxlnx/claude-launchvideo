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
    x = x.copy()
    nf = min(len(x), int(0.006 * SR))
    w = np.cos(np.linspace(0, np.pi / 2, nf)) ** 2
    x[-nf:] *= w[:, None]
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
def kick(d=0.9, hard=1.0):
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
    d = max(d, 5 * tau)
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
        f = f0 * 1.5 ** (1 - np.exp(-t / 0.01))
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
    'Fm9': dict(pad=[53, 56, 60, 63, 67], bass=41, arp=[65, 72, 75, 79]),
    'Eb': dict(pad=[51, 55, 58, 63, 65], bass=39, arp=[63, 67, 70, 75]),
    'Ab': dict(pad=[44, 51, 56, 60, 63, 70], bass=32, arp=[68, 72, 75, 80]),
    'Fm': dict(pad=[41, 48, 53, 56, 60], bass=29, arp=[65, 68, 72, 77]),
    'Gb': dict(pad=[42, 49, 53, 54, 58], bass=30, arp=[66, 70, 73, 78]),
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
C_ = CUES['cue']
S_ = CUES['sfx']
PK = CUES['peaks']


def place_at_peak(dst, x, peak_frac, t_peak, gain=1.0, pan=0.0):
    """Place a swell so that its apex (at peak_frac of its length) lands on t_peak."""
    place(dst, x, t_peak - peak_frac * len(x) / SR, gain, pan)


def build_music():
    drums, bass, pad, arp, bells = buf(), buf(), buf(), buf(), buf()
    kicks = []

    # ---- pad --------------------------------------------------------------------------------
    for b in range(1, 16):
        name = PROG[b]
        start = bar(b)
        d = BAR + 0.9
        if b <= 3:
            level, cut = 0.22 * (0.55 + 0.25 * (b - 1)), 700 + 250 * b
            if b == 3:
                d, cut = BAR - 0.25, 900  # stops before the implosion so the hold is silent
        elif b in (6, 7):
            level, cut = 0.26, 1100
        elif b in (8, 9):
            level, cut = 0.34, 3200
        elif b in (13, 14):
            level, cut = 0.38, 2400 + (b - 13) * 900
        elif b == 15:
            level, cut, d = 0.42, 2600, 2 * BAR + 2.2  # the tonic rings from "fits." and decays
        else:
            level, cut = 0.30, 2200
        notes = CH[name]['pad']
        for m in notes:
            x = supersaw_note(m, d, voices=5, detune=0.11, cutoff=cut, a=0.12 if b != 4 else 0.02, r=1.5 if b == 15 else 0.9)
            place(pad, x, start, gain=level / len(notes) * 2.2)
    pad = filt(pad, sos_hp(170, 2))

    # intro drone (Ab + Eb) that swells into the headline and stops dead on the slam
    d = fr(C_['doesntFit'])
    t = tt(d)
    drone = sine(mtof(32), d) * 0.5 + sine(mtof(39), d) * 0.3 + saw_blep(mtof(44), d) * 0.05
    drone = filt(drone, sos_lp(500, 2)) * np.minimum(1, t / 1.6) * (0.5 + 0.5 * (t / d) ** 2)
    drone[-int(0.06 * SR):] *= np.linspace(1, 0, int(0.06 * SR))
    place(pad, drone, 0.0, gain=0.16)

    # ---- drums ------------------------------------------------------------------------------
    def K(t, g=1.0, hard=1.0):
        place(drums, kick(0.9, hard), t, g)
        kicks.append((t, g))

    for b in range(4, 16):
        s = bar(b)
        if b in (4, 5):
            K(s, 1.0)
            K(s + 1.75 * BEAT, 0.55)
            K(s + 2 * BEAT, 0.85)
            place(drums, clap(), s + 2 * BEAT, 0.42)
            for k in range(8):
                place(drums, hat(0.08, 0.012), s + k * BEAT / 2, 0.10 if k % 2 else 0.05, pan=0.25)
        elif b in (6, 7):
            K(s, 0.55, 0.8)
            if b == 7:
                K(s + 2 * BEAT, 0.45, 0.8)
            for k in range(16):
                place(drums, hat(0.05, 0.008, 9000), s + k * BEAT / 4, 0.045 + 0.03 * (k % 4 == 2), pan=-0.2 + 0.4 * (k % 2))
        elif b in (8, 9):
            for q in range(4):
                K(s + q * BEAT, 1.0 if q == 0 else 0.85)
                place(drums, hat(0.25, 0.07, 6500), s + q * BEAT + BEAT / 2, 0.16, pan=0.2)
            place(drums, clap(), s + BEAT, 0.40)
            place(drums, clap(), s + 3 * BEAT, 0.44)
            for k in range(16):
                if k % 2:
                    place(drums, hat(0.05, 0.01, 9500), s + k * BEAT / 4, 0.06, pan=-0.3)
        elif b in (10, 11, 12):
            K(s, 0.9)
            K(s + 2.5 * BEAT, 0.6)
            place(drums, clap(), s + 2 * BEAT, 0.34)
            for k in range(8):
                place(drums, hat(0.12, 0.03, 7000), s + k * BEAT / 2, 0.05, pan=0.15)
        elif b in (13, 14):
            for k in range(8):
                place(drums, tick(3000 if k % 2 == 0 else 2300, 0.05, 0.005, 0.5), s + k * BEAT / 2, 0.10 + 0.03 * (b == 14))
        elif b == 15:
            K(s, 1.0, 1.1)

    # ---- bass ---------------------------------------------------------------------------------
    def bnote(m, d, drive=1.3, h2=0.22):
        n = int(d * SR)
        f = mtof(m)
        x = sine(f, d) + sine(f * 2, d) * h2 + saw_blep(f, d) * 0.06
        x = filt(x, sos_lp(900, 2))
        return sat(x, drive) * adsr(d, 0.006, 0.12, 0.8, 0.08)

    for b in range(4, 16):
        name = PROG[b]
        m = CH[name]['bass']
        s = bar(b)
        if b in (8, 9):
            for k in range(8):
                place(bass, bnote(m + (12 if k in (3, 7) else 0), BEAT / 2 * 0.95, 1.3, 0.35), s + k * BEAT / 2, 0.40)
        elif b in (6, 7, 13, 14):
            place(bass, bnote(m, BAR * 0.98, 1.1), s, 0.20 if b >= 13 else 0.22)
        elif b == 15:
            x = bnote(CH['Ab']['bass'], BAR * 1.6, 1.2)
            x *= np.concatenate([np.ones(len(x) - int(0.4 * SR)), np.linspace(1, 0, int(0.4 * SR))])
            place(bass, x, s + 0.06, 0.34)
        else:
            place(bass, bnote(m, BEAT * 1.5), s, 0.36)
            place(bass, bnote(m, BEAT * 0.45), s + 1.75 * BEAT, 0.26)
            place(bass, bnote(m, BEAT * 1.9), s + 2 * BEAT, 0.34)

    # ---- pluck arp ----------------------------------------------------------------------------
    pattern = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
    for b in range(4, 15):
        name = PROG[b]
        notes = CH[name]['arp']
        s = bar(b)
        if b in (6, 7):
            gain, step = 0.05, 2
        elif b in (8, 9):
            gain, step = 0.13, 1
        elif b in (13, 14):
            gain, step = 0.09, 1
        else:
            gain, step = 0.08, 2
        for k in range(0, 16, step):
            m = notes[pattern[k]] + (12 if (b in (8, 9) and k in (6, 14)) else 0)
            place(arp, pluck(m, 0.45, 4200 if b in (8, 9) else 3000), s + k * BEAT / 4, gain * (1.0 if k % 4 == 0 else 0.75), pan=(-0.35 if k % 2 else 0.35))
    arp = pingpong(arp, BEAT * 0.75, fb=0.32, mix=0.28)

    # ---- bells: logo moments (tied to what's on screen, not the grid) ----------------------------
    for m, off, g in [(68, 0.0, 0.10), (75, 0.02, 0.07), (80, 0.04, 0.05)]:
        place(bells, fm_bell(m, 3.5, 1.8, 3.5, 1.4), fr(C_['drop1']) + off, g)
    for m, off, g in [(72, 0.0, 0.07), (75, BEAT / 2, 0.06), (80, BEAT, 0.06)]:
        place(bells, fm_bell(m, 2.5, 1.6, 3.5, 1.0), fr(S_['wordmark']) + 0.05 + off, g, pan=0.2)
    for m, off, g in [(56, 0.0, 0.10), (68, 0.0, 0.10), (72, 0.03, 0.08), (75, 0.05, 0.07), (82, 0.08, 0.05)]:
        place(bells, fm_bell(m, 4.5, 2.0, 3.5, 1.8), fr(C_['fits']) + off, g)
    for m, off, g in [(80, 0.0, 0.06), (84, BEAT / 2, 0.05)]:
        place(bells, fm_bell(m, 3.0, 1.4, 3.5, 1.1), fr(S_['lockup2']) + off, g, pan=-0.15)

    return dict(drums=drums, bass=bass, pad=pad, arp=arp, bells=bells, kicks=kicks)


def conflict_blip(d=0.08):
    t = tt(d)
    x = (np.sin(2 * np.pi * 392.0 * t) + np.sin(2 * np.pi * 415.3 * t)) * 0.5
    return x * np.minimum(1, t / 0.002) * np.exp(-t / 0.02)


def build_sfx():
    fx = buf()
    c, s, pk = C_, S_, PK

    # Act 1 — the clock: a soft tick-tock on every beat until the headline lands
    for k in range(1, 8):
        place(fx, tick(3000 if k % 2 else 2250, 0.06, 0.006, 0.6), k * BEAT, 0.055 + 0.01 * (k % 2), pan=-0.15 if k % 2 else 0.15)
    place(fx, whoosh(0.5, 2000, 7000, 3000, 0.3, 0.5), fr(c['lineDraw']) - 0.02, 0.05)
    for k in range(9):
        place(fx, tick(2200 + 200 * (k % 3), 0.04, 0.004, 0.5), fr(c['gridDraw']) + k * 0.035, 0.05, pan=(k - 4) / 5)
    for i, f0 in enumerate([622.25, 830.61]):  # "Your" "week" — Eb5, Ab5
        place(fx, blip(f0), fr(c['yourWeek'] + i * 9 + 3), 0.09)
    for i, f0 in enumerate([830.61, 1046.5, 1244.5, 1396.9, 1661.2]):  # descriptor, Ab pentatonic
        place(fx, blip(f0), fr(c['lockup'] + 22 + i * 5 + 3), 0.035, pan=(i - 2) / 6)
    for i, f in enumerate(CUES['rain']):
        r = np.random.default_rng(100 + i)
        place(fx, tock(1000 + r.random() * 900, 0.1, 0.02 + r.random() * 0.02, 0.25), fr(f), 0.09 + 0.08 * (i / len(CUES['rain'])), pan=r.random() * 1.6 - 0.8)
    place(fx, riser(1.9, 200, 6000, True, 53), fr(c['yourWeek']) + 0.1, 0.20)
    place(fx, sub_boom(1.6, 58, 38), fr(c['doesntFit']), 0.55)
    place(fx, clap(0.5), fr(c['doesntFit']), 0.35)
    place(fx, filt(noise(0.6), sos_bp(200, 3000)) * expdec(0.6, 0.12), fr(c['doesntFit']), 0.20)
    place(fx, riser(1.2, 400, 9000, True, 60), fr(c['doesntFit']) + 0.25, 0.14)
    place(fx, reverse_suck(0.3), fr(c['implodeStart']), 0.55)

    # Act 2 — drop 1 on silence: flood + mark snaps + wordmark + fly into the app
    place(fx, sub_boom(2.6, 60, 36), fr(c['drop1']), 0.75)
    place(fx, whoosh(0.35, 150, 1400, 300, 0.2), fr(c['drop1']), 0.22)
    place(fx, snap(0.6, 0.8), fr(s['markSnapA']), 0.42, pan=-0.2)
    place(fx, snap(0.6, 1.0), fr(s['markSnapB']), 0.46, pan=0.2)
    place(fx, whoosh(0.55, 500, 3500, 1200, 0.35, 0.6), fr(s['wordmark']) - 0.1, 0.12)
    place_at_peak(fx, whoosh(0.75, 250, 1800, 400, 0.6, 1.0), 0.6, fr(pk['fly']), 0.40)

    # Act 3 — week loads, clashes, zoom, typing, click, flood
    for i, f in enumerate(CUES['cascade']):
        place(fx, tick(2800 + (i % 5) * 180, 0.03, 0.003, 0.5), fr(f), 0.035, pan=(i % 7 - 3) / 4)
    for i, f in enumerate(CUES['clashes']):
        place(fx, conflict_blip(), fr(f), 0.09, pan=-0.6 + 1.2 * i / 6)
    place_at_peak(fx, whoosh(0.9, 200, 1500, 400, 0.55, 0.6), 0.55, fr(pk['zoom']), 0.30)
    last = -1e9
    for i, f in enumerate(CUES['keys']):
        if f - last < 2:
            continue
        last = f
        r = np.random.default_rng(900 + i)
        if CUES['keySpace'][i]:
            place(fx, tock(700 * (0.94 + 0.12 * r.random()), 0.08, 0.02, 0.3), fr(f), 0.14, pan=((i * 37) % 11 - 5) / 20)
        else:
            g = 0.18 if CUES['keyWordStart'][i] else 0.09
            place(fx, key_click(i), fr(f), g, pan=((i * 37) % 11 - 5) / 20)
    place_at_peak(fx, whoosh(0.5, 400, 2600, 700, 0.6, 0.4), 0.6, fr(pk['macro']), 0.20)
    place(fx, riser(1.6, 250, 9000, True, 56), fr(c['click']) - 1.1, 0.22)
    place(fx, ui_click(), fr(s['click']), 0.60)
    place(fx, whoosh(0.3, 300, 5000, 2000, 0.9, 0.3), fr(s['flood']), 0.26)

    # Act 4 — drop 2: the fitting
    place(fx, sub_boom(2.4, 62, 38), fr(c['drop2']), 0.5)
    place(fx, whoosh(0.4, 3000, 400, 150, 0.1, 0.4), fr(c['drop2']), 0.22)
    root_hz = {8: 69.3, 9: 65.4}  # Db, Ab/C — tune the heavy landings to the chord
    for i, l in enumerate(CUES['landings']):
        r = np.random.default_rng(300 + i)
        tl = fr(l['f'])
        if l['heavy']:
            rh = root_hz[8 if tl < bar(9) else 9]
            place(fx, tock(600 + r.random() * 200, 0.2, 0.05, 1.0), tl, 0.26, pan=r.random() - 0.5)
            place(fx, sub_boom(1.2, rh, rh / 2), tl, 0.14)
        else:
            place(fx, tock(1100 + r.random() * 800, 0.12, 0.028, 0.35), tl, 0.15, pan=r.random() * 1.4 - 0.7)
    place_at_peak(fx, whoosh(1.1, 200, 1600, 300, 0.45, 0.8), 0.45, fr(pk['straighten']), 0.26)
    place(fx, fm_bell(87, 1.2, 1.2, 2.0, 0.35), fr(s['toast']), 0.09, pan=0.1)
    place(fx, fm_bell(92, 1.2, 1.0, 2.0, 0.35), fr(s['toast']) + 0.09, 0.07, pan=0.1)

    # Act 5 — features (louder, and on the frames where things actually happen)
    place_at_peak(fx, whoosh(0.7, 300, 2000, 500, 0.5, 0.6), 0.5, fr(pk['cardMorph']), 0.24)
    place(fx, whoosh(0.35, 800, 2500, 1200, 0.5, 0.3), fr(s['f1Lift']), 0.12)
    place(fx, tock(1300, 0.12, 0.03, 0.4), fr(s['f1Land']), 0.30)
    for i, f in enumerate(s['f1Checks']):
        place(fx, tick(3400 + i * 260, 0.05, 0.01, 0.7), fr(f), 0.12, pan=0.3)
    for f in (s['drum2'], s['drum3']):
        for k in range(3):
            place(fx, tick(2100 - k * 150, 0.04, 0.004, 0.6), fr(f) + k * 0.05, 0.16 - 0.04 * k, pan=-0.4)
    place_at_peak(fx, whoosh(0.4, 600, 3000, 900, 0.3, 0.5), 0.3, fr(pk['invite']), 0.18)
    bt = tt(0.25)
    place(fx, np.sin(2 * np.pi * (170 + 90 * np.exp(-bt / 0.02)) * bt) * np.exp(-bt / 0.06), fr(s['f2Bounce']), 0.45)
    place(fx, tick(2600, 0.06, 0.01, 0.8), fr(s['f2Reply']), 0.15)
    place_at_peak(fx, whoosh(0.3, 500, 2500, 800, 0.5, 0.6), 0.5, fr(pk['inviteExit']), 0.14)
    place(fx, fm_bell(84, 0.8, 0.8, 2.0, 0.25), fr(s['f3Late']), 0.08)
    place(fx, tock(1400, 0.08, 0.02, 0.2), fr(s['f3LateSettle']), 0.13)
    place(fx, tock(1500, 0.08, 0.02, 0.2), fr(s['f3ShiftSettle']), 0.13)
    place_at_peak(fx, whoosh(0.7, 300, 2000, 400, 0.4, 0.6), 0.4, fr(pk['back']), 0.22)

    # Act 6 — pull back, the fit, the words become the mark, lockup
    place_at_peak(fx, whoosh(2.0, 150, 1200, 250, 0.18, 1.0), 0.18, fr(pk['pullBack']) + 0.1, 0.26)
    rz = 3.2
    place(fx, riser(rz, 150, 7000, True, 51), fr(c['fits']) - 0.2 - rz, 0.16)
    place(fx, whoosh(0.4, 300, 2500, 800, 0.8, -0.8), fr(s['wordsIn']), 0.12)
    place(fx, whoosh(0.4, 300, 2500, 800, 0.8, 0.8), fr(s['wordsIn']), 0.12)
    place(fx, snap(0.8, 1.0), fr(s['fitsSnap']), 0.55)
    place(fx, sub_boom(3.0, 103.8, 51.9), fr(s['fitsSnap']), 0.35)
    place(fx, tock(420, 0.3, 0.06, 1.0), fr(s['wordsFill']), 0.16)
    place(fx, snap(0.6, 0.9), fr(s['markMorph']), 0.40)
    place(fx, whoosh(0.55, 500, 3500, 1200, 0.35, 0.6), fr(s['lockup2']) - 0.1, 0.10)
    place(fx, tick(2600, 0.2, 0.02, 0.8), fr(s['finalBlink']), 0.12)
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
    peak = np.maximum.reduce([np.roll(a, -k) for k in range(0, la, 8)])
    gain = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    win = np.hanning(max(3, la))
    win /= win.sum()
    gain = np.minimum(gain, np.convolve(gain, win, mode='same'))
    rel = np.exp(-1 / (release * SR))
    out = np.empty_like(gain)
    g = 1.0
    for i in range(len(gain)):
        g = gain[i] if gain[i] < g else gain[i] + (g - gain[i]) * rel
        out[i] = g
    return x * out[:, None]


def envelope(points):
    """Piecewise-linear gain automation from (time, gain) points, smoothed."""
    t = np.arange(N) / SR
    ts, gs = zip(*points)
    g = np.interp(t, ts, gs)
    return filt(g, sos_lp(4, 1))[:, None]


def main():
    os.makedirs(os.path.join(ROOT, 'out', 'stems'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    m = build_music()
    fx = build_sfx()
    t = np.arange(N) / SR
    end = CUES['total'] / FPS

    sc = sidechain(m['kicks'])
    music = (
        m['drums'] * 0.8
        + m['bass'] * sc * 0.55
        + m['pad'] * (0.55 + 0.45 * sc) * 1.6
        + m['arp'] * (0.7 + 0.3 * sc) * 1.7
        + m['bells'] * 1.5
    )
    # reverb sends carry no sub (keeps the low end tight)
    send = filt(m['pad'] * 0.25 + m['arp'] * 0.35 + m['bells'] * 0.6 + m['drums'] * 0.06, sos_hp(250, 2))
    wet = reverb(send, IR_HALL)
    fxs = filt(fx, sos_hp(250, 2))
    fxwet = reverb(fxs * 0.18, IR_ROOM) + reverb(fxs * 0.08, IR_HALL)

    # music-bus automation: typing tucked, features under the UI sounds, breakdown lifts into "fits."
    bus = envelope([
        (0, 1.0), (bar(6, 1), 1.0), (bar(6, 1.5), 0.72), (bar(8) - 0.02, 0.72), (bar(8), 1.0),
        (bar(10) - 0.1, 1.0), (bar(10), 0.72), (bar(13) - 0.1, 0.72), (bar(13), 0.85),
        (bar(15) - 0.3, 0.85), (bar(15), 1.0), (DUR, 1.0),
    ])
    # the "suck": near-silence before each drop, then everything lands on the downbeat
    suck = np.ones(N)
    for (a0, a1, depth) in [
        (fr(C_['silence']), fr(C_['drop1']), 0.95),
        (fr(C_['drop2']) - 0.2, fr(C_['drop2']), 0.85),
        (fr(C_['fits']) - 0.2, fr(C_['fits']), 0.85),
    ]:
        w = (t > a0) & (t < a1)
        ramp = np.clip((t - a0) / 0.04, 0, 1)
        suck = np.where(w, np.minimum(suck, 1 - depth * ramp), suck)
    suck = suck[:, None]

    fx_low = filt(fx, sos_lp(90, 2))
    fx = filt(fx - fx_low * 0.45, sos_hp(24, 2))
    # drop 1 lands on true silence: the hold after the implosion ducks everything, reverb tails included
    hold = np.ones(N)
    a0, a1 = fr(C_['silence']) - 0.05, fr(C_['drop1'])
    w = (t > a0) & (t < a1)
    hold = np.where(w, 1 - 0.97 * np.clip((t - a0) / 0.05, 0, 1), hold)[:, None]
    mix = ((music + wet * 0.6) * bus * suck + fx * 1.25 + fxwet) * hold
    mix = filt(mix, sos_hp(28, 2))
    # mono below 120 Hz
    mid = mix.mean(axis=1, keepdims=True)
    side = filt((mix[:, :1] - mix[:, 1:]) / 2, sos_hp(120, 2))
    mix = np.concatenate([mid + side, mid - side], axis=1)
    # bus compressor: 2:1 above -14 dBFS (true 5 ms RMS detector), 15 ms attack / 120 ms release
    det = np.sqrt(filt(np.mean(mix ** 2, axis=1), sos_lp(1 / (2 * np.pi * 0.005), 1)).clip(1e-12))
    over = np.maximum(0, 20 * np.log10(det) + 14)
    gr_db = -over * 0.5
    att, rel = np.exp(-1 / (0.015 * SR)), np.exp(-1 / (0.12 * SR))
    g = np.empty_like(gr_db)
    cur = 0.0
    for i, x in enumerate(gr_db):
        cur = x + (cur - x) * (att if x < cur else rel)
        g[i] = cur
    mix *= (10 ** (g / 20))[:, None]
    mix = sat(mix * 0.9, 1.15)
    mix = mix + filt(mix, sos_hp(2500, 1)) * 0.25

    # natural ending: the tail decays over the held end card and reaches silence at the last frame
    fade = np.clip((end - 0.03 - t) / 1.3, 0, 1) ** 2
    mix *= fade[:, None]

    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    body = mix[: int((end - 1.5) * SR)]
    for _ in range(3):
        lufs = meter.integrated_loudness(body)
        mix *= 10 ** ((-14.0 - lufs) / 20)
        mix = limiter(mix, ceiling=0.85)
        body = mix[: int((end - 1.5) * SR)]
    mix = mix[: int(end * SR)]
    mix[-480:] = 0

    import soundfile as sf
    sf.write(os.path.join(ROOT, 'public', 'audio', 'soundtrack.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
    for k in ('drums', 'bass', 'pad', 'arp', 'bells'):
        sf.write(os.path.join(ROOT, 'out', 'stems', f'{k}.wav'), m[k][: len(mix)].astype(np.float32), SR)
    sf.write(os.path.join(ROOT, 'out', 'stems', 'sfx.wav'), fx[: len(mix)].astype(np.float32), SR)
    print('wrote public/audio/soundtrack.wav', f'{len(mix) / SR:.2f}s', 'peak', float(np.max(np.abs(mix))))


if __name__ == '__main__':
    main()
