# AxoriOS demo video (Remotion)

The hackathon demo, built with Remotion. A separate package: the Next.js app doesn't import it, and it's excluded from the app's TypeScript, lint, tests and Vercel build (`.vercelignore`).

- `SHOTLIST.md`: the shot list, sources and timings.
- `src/shots.tsx`: one component per shot. `src/Demo.tsx`: the sequence (fades inside a chapter, hard cuts between chapters).
- `public/shots`: 1440×900 (@2x) captures of the landing and features pages. `public/stills`: dashboard screenshots of the demo store.

## Make the clips

The source recordings aren't in git. Put `AxoriOS.mp4` and `tg.mp4` anywhere, then:

```
npm ci
scripts/cut-clips.sh /path/to/AxoriOS.mp4 /path/to/tg.mp4   # writes public/clips/*.mp4 (crops, speed-ups, email blur)
```

## Music

`public/audio/music.m4a` is an original track synthesized by `scripts/make-music.py` (numpy only, no samples, so no licence to clear). It is timed to the cuts in `src/Demo.tsx`; if you change shot lengths, update the frame numbers at the top of the script and regenerate:

```
python3 -I scripts/make-music.py /tmp/music.wav
ffmpeg -i /tmp/music.wav -af loudnorm=I=-19:TP=-2:LRA=9 -ar 48000 -c:a aac -b:a 192k public/audio/music.m4a
```

It sits at about -19 LUFS so a voice-over (aim for about -16 LUFS) stays on top.

## Preview and render

```
npm run studio                        # live preview
npm run render                        # out/axorios-demo.mp4, 1920×1080, 30 fps
```

`remotion.config.ts` points at the pre-installed Chromium in cloud sessions. Delete that line to let Remotion download its own.
