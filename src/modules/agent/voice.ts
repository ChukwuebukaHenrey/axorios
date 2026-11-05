import type { UIMessage } from "ai";

/** About a minute of speech at the bitrate the recorder asks for, with room for a browser that ignores it. */
export const MAX_VOICE_NOTE_CHARS = 2_000_000;
export const VOICE_NOTE_PLACEHOLDER = "(voice note)";

type Part = UIMessage["parts"][number];
type FilePart = Extract<Part, { type: "file" }>;

const isFile = (part: Part): part is FilePart => part.type === "file";

/** Only inline audio reaches the model. A remote URL could make the provider fetch something on a client's say-so. */
export const isVoiceNote = (part: Part): boolean =>
  isFile(part) && part.mediaType.startsWith("audio/") && part.url.startsWith("data:audio/");

function transcriptAfter(messages: UIMessage[], index: number): string | undefined {
  const reply = messages[index + 1];
  if (reply?.role !== "assistant") return undefined;
  for (const part of reply.parts) {
    if (part.type === "tool-show_transcript") {
      const input = (part as { input?: { transcript?: unknown } }).input;
      if (typeof input?.transcript === "string") return input.transcript;
    }
  }
  return undefined;
}

/**
 * Audio goes to the model once, in the turn it was spoken. After that the words stand in for it, which keeps requests
 * and the saved chat small. Any other file part is dropped: uploads aren't a feature yet, and files are untrusted.
 */
export function collapseVoiceNotes(messages: UIMessage[], { keepLatest }: { keepLatest: boolean }): UIMessage[] {
  return messages.map((message, index) => {
    if (message.role !== "user" || !message.parts.some(isFile)) return message;
    const keep = keepLatest && index === messages.length - 1;
    const parts = message.parts.flatMap((part): Part[] => {
      if (!isFile(part)) return [part];
      if (!isVoiceNote(part)) return [];
      if (keep) return [part];
      return [{ type: "text", text: transcriptAfter(messages, index) ?? VOICE_NOTE_PLACEHOLDER }];
    });
    return { ...message, parts: parts.length > 0 ? parts : [{ type: "text", text: VOICE_NOTE_PLACEHOLDER }] };
  });
}

export function latestIsVoiceNote(messages: UIMessage[]): boolean {
  const latest = messages.at(-1);
  return latest?.role === "user" && latest.parts.some(isVoiceNote);
}

/** False when a request carries more audio than one voice note can be. */
export function voiceNotesFit(messages: UIMessage[]): boolean {
  return messages.every((m) => m.parts.every((part) => !isFile(part) || part.url.length <= MAX_VOICE_NOTE_CHARS));
}
