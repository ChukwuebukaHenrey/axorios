// Pure: which shop a pasted message points at, for chats that arrive without "/start <shop>".

/** A shop slug from a pasted storefront link (".../s/<slug>") or a single word that looks like one. */
export function shopSlugIn(text: string | undefined): string | null {
  const value = text?.trim() ?? "";
  const fromLink = value.match(/\/s\/([a-z0-9][a-z0-9-]{1,62})(?=[/?#\s]|$)/i)?.[1];
  if (fromLink) return fromLink.toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,62}$/i.test(value) ? value.toLowerCase() : null;
}
