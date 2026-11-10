import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { LEN, S1, S10, S11, S12, S13, S2, S3, S4, S5, S6, S7, S8, S9 } from "./shots";

const XF = 10; // frames: soft fade inside a chapter; chapters change on a hard cut, as in the reference

// Chapter A (lime): 1-6 · B (pink): 7 · C (navy): 8 · D (PayPal blue): 9 · E (cream): 10 · F (warm): 11 · G (black): 12 · end: 13
const SHOTS: [React.FC, number, boolean][] = [
  [S1, LEN.s1, true],
  [S2, LEN.s2, true],
  [S3, LEN.s3, true],
  [S4, LEN.s4, true],
  [S5, LEN.s5, true],
  [S6, LEN.s6, false],
  [S7, LEN.s7, false],
  [S8, LEN.s8, false],
  [S9, LEN.s9, false],
  [S10, LEN.s10, false],
  [S11, LEN.s11, false],
  [S12, LEN.s12, false],
  [S13, LEN.s13, false],
];

export const DEMO_FRAMES = SHOTS.reduce((t, [, d]) => t + d, 0) - SHOTS.filter(([, , f]) => f).length * XF;

export const Demo: React.FC = () => (
  <TransitionSeries>
    {SHOTS.flatMap(([Shot, d, fadeNext], i) => {
      const seq = (
        <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d}>
          <Shot />
        </TransitionSeries.Sequence>
      );
      return fadeNext && i < SHOTS.length - 1 ? [seq, <TransitionSeries.Transition key={`f${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: XF })} />] : [seq];
    })}
  </TransitionSeries>
);
