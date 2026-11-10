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

## Preview and render

```
npm run studio                        # live preview
npm run render                        # out/axorios-demo.mp4, 1920×1080, 30 fps
```

`remotion.config.ts` points at the pre-installed Chromium in cloud sessions. Delete that line to let Remotion download its own.
