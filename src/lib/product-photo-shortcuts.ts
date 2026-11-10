/**
 * Seller-defined shortcuts (not slash commands understood by the model).
 * Only a newly supplied original photo is used for each edit.
 */
export const PHOTO_SHORTCUTS = ["/whitebg", "/flatlay", "/inuse", "/billboard", "/seasonal"] as const;
export type PhotoShortcut = (typeof PHOTO_SHORTCUTS)[number];

export const PHOTO_SHORTCUT_LABELS: Record<PhotoShortcut, string> = {
  "/whitebg": "White studio",
  "/flatlay": "Flat lay",
  "/inuse": "In use",
  "/billboard": "Billboard",
  "/seasonal": "Seasonal",
};

export type ParsedPhotoShortcut = { shortcut: PhotoShortcut; details: string };

export function parsePhotoShortcut(text: string): ParsedPhotoShortcut | null {
  const match = text.trim().match(/^\/(whitebg|flatlay|inuse|billboard|seasonal)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return { shortcut: `/${match[1].toLowerCase()}` as PhotoShortcut, details: (match[2] ?? "").trim() };
}

export function photoPrompt({ shortcut, details }: ParsedPhotoShortcut): string {
  if (shortcut === "/seasonal" && !details.trim()) throw new Error("Name the season after /seasonal, for example /seasonal winter.");

  const shared = [
    "Use the supplied photograph as the ONLY authoritative reference for the physical product.",
    "Create exactly ONE SQUARE 1:1 photorealistic product image. Edit the scene, not the product.",
    "Keep the product's shape, geometry, proportions, physical scale, construction, materials, texture, colours, any existing logo, printed labels, and every existing word as close as possible to the source photograph.",
    "Do NOT change, add, or hallucinate product features, accessories, packaging, brand marks, claims, writing, captions, advertising copy, labels, or watermarks.",
    "No extra branding. No decorative text. Do not use mockups of apps or previously generated artwork as a substitute product.",
  ];
  const settings: Record<PhotoShortcut, string> = {
    "/whitebg": "Place the complete product centred on an even white seamless studio background, sharp focus, gentle even studio lighting, soft realistic grounding shadow. No props.",
    "/flatlay": "Create a natural top-down flat lay on a neutral physical surface, with 2–3 relevant everyday props in natural light. Leave the top quarter clear. If appropriate, lay the product on its side with the original branding facing camera.",
    "/inuse": "Show a real adult naturally using the unchanged product in a believable everyday setting. Correct anatomy, grip, product size, and interaction. Keep the product clearly visible.",
    "/billboard": "Show a realistic roadside billboard: the product is shown as a large PRINTED PHOTO on a plain neutral billboard ad panel, never as a giant physical object in the street. No extra ad copy.",
    "/seasonal": "Use the season specified by the user to choose believable lighting, props and a seasonal setting, without changing the product itself.",
  };
  return [...shared, settings[shortcut], details ? `Additional setting details from the seller (only if compatible with product preservation): ${details}` : ""].filter(Boolean).join("\n");
}
