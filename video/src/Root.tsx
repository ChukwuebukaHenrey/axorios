import { Composition } from "remotion";
import { Demo, DEMO_FRAMES } from "./Demo";
import { FPS, H, W } from "./theme";

export const Root = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={DEMO_FRAMES} fps={FPS} width={W} height={H} />
  </>
);
