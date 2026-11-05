import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { collapseVoiceNotes, MAX_VOICE_NOTE_CHARS, VOICE_NOTE_PLACEHOLDER, voiceNotesFit } from "./voice";

const audio = { type: "file", mediaType: "audio/webm", url: "data:audio/webm;base64,AAAA" } as const;
const user = (parts: UIMessage["parts"]): UIMessage => ({ id: crypto.randomUUID(), role: "user", parts });
const assistant = (parts: UIMessage["parts"]): UIMessage => ({ id: crypto.randomUUID(), role: "assistant", parts });
const transcript = (text: string) => ({ type: "tool-show_transcript", toolCallId: "1", state: "output-available", input: { transcript: text }, output: {} }) as unknown as UIMessage["parts"][number];

describe("collapseVoiceNotes", () => {
  it("sends the latest voice note to the model", () => {
    const out = collapseVoiceNotes([user([audio])], { keepLatest: true });
    expect(out[0].parts).toEqual([audio]);
  });

  it("replaces an earlier voice note with what was said", () => {
    const out = collapseVoiceNotes([user([audio]), assistant([transcript("I dey bake cake")]), user([{ type: "text", text: "Yes" }])], { keepLatest: true });
    expect(out[0].parts).toEqual([{ type: "text", text: "I dey bake cake" }]);
  });

  it("uses a placeholder if no transcript was given", () => {
    const out = collapseVoiceNotes([user([audio]), assistant([{ type: "text", text: "Hi" }]), user([{ type: "text", text: "Yes" }])], { keepLatest: true });
    expect(out[0].parts).toEqual([{ type: "text", text: VOICE_NOTE_PLACEHOLDER }]);
  });

  it("saves no audio at all", () => {
    const out = collapseVoiceNotes([user([audio]), assistant([transcript("Hello")])], { keepLatest: false });
    expect(JSON.stringify(out)).not.toContain("base64");
    expect(out[0].parts).toEqual([{ type: "text", text: "Hello" }]);
  });

  it("drops a voice note given as a remote link, so the provider never fetches one", () => {
    const remote = { type: "file", mediaType: "audio/mpeg", url: "https://evil.test/a.mp3" } as const;
    const out = collapseVoiceNotes([user([remote])], { keepLatest: true });
    expect(out[0].parts).toEqual([{ type: "text", text: VOICE_NOTE_PLACEHOLDER }]);
  });

  it("drops any other kind of file", () => {
    const pdf = { type: "file", mediaType: "application/pdf", url: "data:application/pdf;base64,AAAA" } as const;
    const out = collapseVoiceNotes([user([{ type: "text", text: "See this" }, pdf])], { keepLatest: true });
    expect(out[0].parts).toEqual([{ type: "text", text: "See this" }]);
  });
});

describe("voiceNotesFit", () => {
  it("refuses a file too big to be a voice note", () => {
    expect(voiceNotesFit([user([audio])])).toBe(true);
    const huge = { ...audio, url: `data:audio/webm;base64,${"A".repeat(MAX_VOICE_NOTE_CHARS)}` };
    expect(voiceNotesFit([user([huge])])).toBe(false);
  });
});
