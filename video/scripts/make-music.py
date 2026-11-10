#!/usr/bin/env python3
"""Synthesize the demo's background track (original, no samples, no licence needed).

A soft electronic bed at 96 BPM: warm pad, plucked arpeggio, light kick and hats,
a riser into the first shot, a hit on every hard chapter cut, UI clicks on the two
cursor clicks, and an outro on the end card. Kept low so a voice-over sits on top.

Usage: python3 -I scripts/make-music.py <out.wav>
Timings below come from src/Demo.tsx (frame / 30).
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 4876 / 30  # DEMO_FRAMES / fps
N = int(DUR * SR)
BPM = 96
BEAT = 60 / BPM
CUTS = [1648, 1948, 2626, 2776, 3196, 3736, 4576]  # hard chapter cuts (frames)
CLICKS = [116, 1438 + 57]  # cursor clicks (frames)
DROP = 140 / 30  # landing shot starts
GROOVE_IN = 370 / 30  # Axori AI chapter: drums come in
END = 4576 / 30  # end card

rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    sus = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False), np.linspace(1, s, d, endpoint=False), np.full(sus, s), np.linspace(s, 0, r)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def soft_saw(f, t, harmonics=10, bright=1.0):
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        out += np.sin(2 * np.pi * f * k * t) / (k ** (1.4 / bright))
    return out


def add(buf, start_s, sig):
    i = int(start_s * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def stereo(sig, pan):
    return np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)])


# Progression: Fmaj7 - G6 - Em7 - Am7 (two bars each), lifted and hopeful.
CHORDS = [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]]
BAR = 4 * BEAT
CHORD_LEN = 2 * BAR

L = np.zeros(N)
R = np.zeros(N)


def put(st, start):
    add(L, start, st[0])
    add(R, start, st[1])


# Pad: whole piece, swells in over the opener, fades on the outro.
t0 = 0.0
ci = 0
while t0 < DUR:
    n = int(CHORD_LEN * SR) + int(1.5 * SR)
    t = np.arange(n) / SR
    e = env_adsr(n, 1.2, 0.5, 0.8, 1.5)
    for idx, note in enumerate(CHORDS[ci % 4]):
        f = midi(note)
        for det, pan in ((-0.12, -0.6), (0.12, 0.6)):
            sig = soft_saw(f * 2 ** (det / 12), t, harmonics=7, bright=0.7) * e * 0.022
            put(stereo(sig, pan * (0.4 + idx * 0.2)), t0)
    # bass root
    fb = midi(CHORDS[ci % 4][0] - 12)
    bass = (np.sin(2 * np.pi * fb * t) + 0.25 * np.sin(4 * np.pi * fb * t)) * env_adsr(n, 0.05, 0.3, 0.7, 0.8) * 0.07
    put(stereo(bass, 0), t0)
    t0 += CHORD_LEN
    ci += 1

# Arpeggio: 8th-note plucks from the landing shot to the end card.
step = BEAT / 2
pattern = [0, 2, 1, 3, 2, 1, 3, 2]
k = 0
t0 = DROP
while t0 < END:
    chord = CHORDS[int(t0 // CHORD_LEN) % 4]
    note = chord[pattern[k % 8]] + 12
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    e = np.exp(-t * 7.5) * np.minimum(1, t * 400)
    sig = (np.sin(2 * np.pi * midi(note) * t) + 0.3 * np.sin(4 * np.pi * midi(note) * t) + 0.08 * np.sin(6 * np.pi * midi(note) * t)) * e * 0.05
    put(stereo(sig, -0.45 if k % 2 else 0.45), t0)
    t0 += step
    k += 1

# Drums: soft kick on 1 and 3 (four-on-the-floor in the Telegram chapter), offbeat hats.
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * 0.32


def hat():
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0)  # crude high-pass
    return noise * np.exp(-t * 60) * 0.025


K, Hh = kick(), hat()
t0 = GROOVE_IN
b = 0
while t0 < END - 0.2:
    in_chat = CUTS[1] / 30 <= t0 < CUTS[2] / 30
    if b % 2 == 0 or in_chat:
        put(stereo(K, 0), t0)
    put(stereo(Hh, 0.3), t0 + BEAT / 2)
    t0 += BEAT
    b += 1

# Riser into the landing shot (filtered noise swell + rising tone).
n = int(DROP * SR)
t = np.arange(n) / SR
swell = (t / DROP) ** 2.5
riser = (np.diff(rng.standard_normal(n), prepend=0) * 0.03 + np.sin(2 * np.pi * (200 + 500 * (t / DROP) ** 2) * t) * 0.02) * swell
put(stereo(riser, 0), 0)


# Hit on every hard cut: sub boom + short reversed-noise whoosh leading in.
def hit():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (45 + 40 * np.exp(-t * 12)) * t) * np.exp(-t * 3.5) * 0.35
    shimmer = soft_saw(midi(76), t, 5) * np.exp(-t * 4) * 0.015
    return boom + shimmer


def whoosh(length=0.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    return np.diff(rng.standard_normal(n), prepend=0) * (t / length) ** 3 * 0.06


H, Wh = hit(), whoosh()
for c in CUTS:
    s = c / 30
    put(stereo(Wh, -0.2), s - 0.5)
    put(stereo(H, 0), s)
put(stereo(H * 0.8, 0), DROP)


# UI clicks.
def click():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2400 * t) * 0.5 + np.diff(rng.standard_normal(n), prepend=0) * 0.3) * np.exp(-t * 120) * 0.18


for c in CLICKS:
    put(stereo(click(), 0.1), c / 30)

# Outro: final Fmaj9 bloom on the end card.
n = int((DUR - END) * SR)
t = np.arange(n) / SR
e = env_adsr(n, 0.4, 1.0, 0.7, max(0.5, DUR - END - 1.6))
for note in [41, 53, 57, 60, 64, 67, 72]:
    put(stereo(soft_saw(midi(note), t, 6, 0.8) * e * 0.02, 0), END)

# Room: short FFT-convolved reverb, then gentle bus glue.
ir_n = int(1.8 * SR)
ir_t = np.arange(ir_n) / SR
ir = rng.standard_normal(ir_n) * np.exp(-ir_t * 3.2)
ir[0] = 0
ir /= np.sqrt(np.sum(ir**2))
size = 1 << int(np.ceil(np.log2(N + ir_n)))
IR = np.fft.rfft(ir, size)
mix = []
for ch in (L, R):
    wet = np.fft.irfft(np.fft.rfft(ch, size) * IR, size)[:N]
    mix.append(ch + 0.22 * wet)
out = np.stack(mix)

# Fade in/out, soft clip, normalise to -1 dBFS peak (loudness is set later with ffmpeg).
fade = np.ones(N)
fi, fo = int(0.3 * SR), int(1.2 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
out = np.tanh(out * fade * 1.6) / 1.6
out /= np.max(np.abs(out)) / 0.89
pcm = (out.T * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {sys.argv[1]} {DUR:.2f}s")
