/** User-defined commands, not model tools. Parse before invoking the seller agent. */
export const PHOTO_SHORTCUTS = [
  { code: "/whitebg", label: "White studio", description: "White seamless background, no props" },
  { code: "/flatlay", label: "Flat lay", description: "Top-down, with 2–3 relevant props" },
  { code: "/inuse", label: "In use", description: "An adult using the product naturally" },
  { code: "/billboard", label: "Billboard", description: "Product photo printed on a roadside billboard" },
  { code: "/seasonal", label: "Seasonal", description: "Props and light for your chosen season" },
] as const;

export type PhotoShortcut = (typeof PHOTO_SHORTCUTS)[number]["code"];
export type ParsedPhotoShortcut = { code: PhotoShortcut; details: string };
const COMMAND = /^\/(whitebg|flatlay|inuse|billboard|seasonal)(?=\s|$)/i;

export function parsePhotoShortcut(input: string): ParsedPhotoShortcut | null {
  const clean = input.trim();
  const matched = COMMAND.exec(clean);
  if (!matched) return null;
  return {
    code: `/${matched[1].toLowerCase()}` as PhotoShortcut,
    details: clean.slice(matched[0].length).trim(),
  };
}

/** Always condition on the original uploaded photograph, never a previous generated image. */
export function buildPhotoPrompt(command: ParsedPhotoShortcut): string {
  if (command.details.length > 400) throw new Error("Keep additional instructions under 400 characters.");
  if (command.code === "/seasonal" && !command.details) throw new Error("Which season? Try /seasonal winter, summer, spring or autumn.");

  const scene: Record<PhotoShortcut, string> = {
    "/whitebg": "Place the entire product in the centre of a pure white seamless studio background. Soft grounding shadow, even studio lighting, sharp focus. No props.",
    "/flatlay": "Arrange a believable top-down flat lay on a neutral surface with only 2–3 relevant props and natural light. Keep the top quarter of the image clear for optional site text. If suitable, put the product on its side with its existing label facing the camera.",
    "/inuse": "Show an adult naturally using the product in a realistic everyday setting. Correct scale, grip, hand anatomy and interaction. Keep the actual product clearly visible.",
    "/billboard": "Create a realistic roadside billboard scene. Print a large photograph of the product onto a plain neutral billboard ad panel. The product is NOT a gigantic physical object in the street. Add no ad slogan or graphic copy.",
    "/seasonal": `Style only the setting, props and lighting for this season or occasion: ${command.details}. Do not alter the product.`,
  };

  return [
    "Create ONE square 1:1 photorealistic product photograph using the ATTACHED ORIGINAL PRODUCT PHOTO as the sole product reference.",
    "The item itself is immutable: preserve its exact shape, proportions, number of parts, materials, colours, surface details, labels, logo, writing, and printed text. Do not invent features or branding. Do not redesign, retouch, repaint, translate, or replace the product.",
    "Change the scene/setting, not the product. No captions, extra words, callouts, watermarks, or promotional claims. Keep the product visibly authentic.",
    scene[command.code],
    command.code !== "/seasonal" && command.details ? `Additional scene instructions (never override product preservation): ${command.details}` : "",
  ].filter(Boolean).join("\n");
}
