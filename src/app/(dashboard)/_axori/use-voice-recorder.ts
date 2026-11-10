"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 60;
const BITS_PER_SECOND = 32_000;
// In order of preference. Chrome, Edge and Firefox record webm or ogg; Safari records mp4.
const FORMATS = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

export type VoiceNote = { mediaType: string; url: string };
export type RecorderError = "unsupported" | "denied";

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Records a short clip in the browser. Hands the audio over as a data URL: nothing is uploaded until it's sent. */
export function useVoiceRecorder(onNote: (note: VoiceNote) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setError("unsupported");
    const format = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
    if (!format) return setError("unsupported");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setError("denied");
    }

    const chunks: Blob[] = [];
    const next = new MediaRecorder(stream, { mimeType: format, audioBitsPerSecond: BITS_PER_SECOND });
    next.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    next.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const mediaType = format.split(";")[0];
      const blob = new Blob(chunks, { type: mediaType });
      if (blob.size === 0) return;
      // Browsers label the data URL with the codec too, which the server's check and the model don't need.
      const url = (await toDataUrl(blob)).replace(/^data:[^,]*,/, `data:${mediaType};base64,`);
      onNote({ mediaType, url });
    };
    recorder.current = next;
    next.start();
    setSeconds(0);
    setRecording(true);

    const startedAt = Date.now();
    timer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) stop();
    }, 250);
  }, [onNote, stop]);

  useEffect(() => stop, [stop]);

  return { recording, seconds, error, start, stop };
}
