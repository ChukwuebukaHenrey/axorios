import { Config } from "@remotion/cli/config";

// Use the container's pre-installed Chromium instead of downloading one.
Config.setBrowserExecutable("/opt/pw-browsers/chromium");
Config.setVideoImageFormat("jpeg");
Config.setConcurrency(4);
