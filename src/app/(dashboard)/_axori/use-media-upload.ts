"use client";

import { useCallback, useState } from "react";
import { t } from "@/lib/messages";

export type UploadedMedia = { id: string; name: string; url: string; kind: "image" | "document"; tags: string[] };
export type UploadState = { status: "idle" } | { status: "uploading"; name: string } | { status: "done"; item: UploadedMedia } | { status: "error"; message: string };

export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

/** Uploads one file to the media library (`/api/media`). The server decides the store and the tags. */
export function useMediaUpload(threadId?: string) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const upload = useCallback(
    async (file: File, note?: string): Promise<UploadedMedia | null> => {
      setState({ status: "uploading", name: file.name });
      const form = new FormData();
      form.set("file", file);
      if (threadId) form.set("threadId", threadId);
      if (note) form.set("note", note);
      try {
        const res = await fetch("/api/media", { method: "POST", body: form });
        const body = (await res.json().catch(() => ({}))) as Partial<UploadedMedia> & { message?: string };
        if (!res.ok) {
          setState({ status: "error", message: body.message ?? t.app.design.media.uploadFailed });
          return null;
        }
        const item = body as UploadedMedia;
        setState({ status: "done", item });
        return item;
      } catch {
        setState({ status: "error", message: t.app.design.media.uploadFailed });
        return null;
      }
    },
    [threadId],
  );
  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, upload, reset };
}
