#!/usr/bin/env python3
"""Render the voice-over lines in vo/script.json with Kokoro TTS (Apache-2.0).

Writes public/audio/vo/<id>.wav (48 kHz mono; then level and encode them, see README) and public/audio/vo/lines.json with each
line's start and length in frames, which src/Demo.tsx reads. Fails if a line would run
past its `until` time, so the voice never spills into the next shot.

Setup (outside the repo):
  python3 -m venv .tts && .tts/bin/pip install kokoro-onnx==0.4.9 soundfile
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
Usage: .tts/bin/python -I scripts/make-voiceover.py <dir with the two model files> [voice]
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / "vo/script.json").read_text())
voice = sys.argv[2] if len(sys.argv) > 2 else cfg["voice"]
lang = "en-gb" if voice.startswith("b") else cfg["lang"]
model_dir = Path(sys.argv[1])
k = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))

FIXED = cfg.get("phonemes", {})  # exact sounds for names the phonemizer gets wrong ("axo-ree-os")
NAME = re.compile("|".join(re.escape(n) for n in sorted(FIXED, key=len, reverse=True))) if FIXED else None


def to_phonemes(text):
    if not NAME:
        return k.tokenizer.phonemize(text, lang)
    parts, last = [], 0
    for m in NAME.finditer(text):
        if text[last:m.start()].strip():
            parts.append(k.tokenizer.phonemize(text[last:m.start()], lang))
        parts.append(FIXED[m.group(0)] + (" " if m.end() < len(text) and text[m.end()] == " " else ""))
        last = m.end()
    if text[last:].strip():
        parts.append(k.tokenizer.phonemize(text[last:], lang))
    return re.sub(r" ([.,!?;:])", r"\1", " ".join(p.strip() for p in parts))


out = ROOT / "public/audio/vo"
out.mkdir(parents=True, exist_ok=True)
meta, problems = [], []
for line in cfg["lines"]:
    ph = to_phonemes(line["text"])
    if NAME and NAME.search(line["text"]):
        print(f"   {line['id']} phonemes: {ph}")
    audio, sr = k.create(ph, is_phonemes=True, voice=voice, speed=cfg["speed"], lang=lang)
    # trim leading/trailing silence, then resample to 48 kHz by linear interpolation
    nz = np.flatnonzero(np.abs(audio) > 0.01)
    audio = audio[max(0, nz[0] - 800): nz[-1] + 2400]
    n48 = int(len(audio) * 48000 / sr)
    audio = np.interp(np.linspace(0, len(audio) - 1, n48), np.arange(len(audio)), audio).astype(np.float32)
    sf.write(out / f"{line['id']}.wav", audio, 48000)
    secs = n48 / 48000
    room = line["until"] - line["at"]
    if secs > room:
        problems.append(f"line {line['id']} is {secs:.1f}s but has {room:.1f}s")
    meta.append({"id": line["id"], "from": round(line["at"] * 30), "frames": int(np.ceil(secs * 30))})
    print(f"{line['id']} {secs:5.1f}s / {room:5.1f}s  {line['text'][:60]}")
(out / "lines.json").write_text(json.dumps(meta, indent=2) + "\n")
if problems:
    sys.exit("Too long: " + "; ".join(problems))
