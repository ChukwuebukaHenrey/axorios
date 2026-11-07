# Redesign v2 brief (7 Nov 2026)

User's request on 7 Nov, with decisions already made. Read this together with `docs/ui-redesign-brief.md` (v1, still uncommitted in the working tree).

## Already done this session
- `src/proxy.ts`: signed-out visitors on `/build` and `/dashboard` now go to `/sign-in`, not `/`.
- Auth checked through the Management API: site URL `https://axorios.vercel.app`, redirect allow-list `https://axorios.vercel.app/auth/callback`, Google **enabled**. Magic link config is correct for production, and the Google button lights up on its own (`auth-providers.ts` reads `/auth/v1/settings`, cached 5 min). Localhost callbacks aren't on the allow-list, so local sign-in bounces to production. Ask before adding `http://localhost:3100/auth/callback`.
- `docs/image-prompts.md` written. The user is generating the images into `Images/generated/`.

## Decisions (user answered 7 Nov)
| Topic | Decision |
|---|---|
| Wording | It's a real product, not a demo. Remove "demo" from all UI and marketing copy (`messages/en.json`, README). The internal `DEMO_STORE_SLUG` gate stays, but is never shown to users |
| Pricing | Free beta now, plus paid tiers marked "Coming soon": no prices and no charge buttons. Tier names and features are proposed by us |
| Icons | Replace `lucide-react` with **Phosphor** (`@phosphor-icons/react`; reason: duotone and fill weights for a modern look). Use the SSR import path in server components |
| Animation | GSAP is installed (`gsap`). Use GSAP + ScrollTrigger for storefront and marketing scroll effects ("futuristic"), and Motion (`motion/react`) for app UI: nav switches, hovers, panels. Load the `motion` skill before writing animation code |
| Dashboard | Reference `Images/references/Navinspo/dasboard inspo.png` (Atomie). Build its **bottom-left** block in the sidebar: Settings, Help Center, Dark Mode toggle. Apply its light rounded panel style and lime active state. The nav switch is animated with Motion (sliding active pill, layoutId). Hover is solid, with no washed-out transparency, in palette colours. Every button and link gets `cursor: pointer` (add a global rule in `globals.css`) |
| Marketing nav | `Navinspo/navinspo.png` (floating white rounded nav inset over the hero) and `navmobile.png` (white rounded dropdown card: links, divider lines, Sign in, then a primary button) |
| Templates | The 3 Market presets are **replaced** by 3 industry templates on one shared section set: **Bakery** (the cake store's new design), **Tailoring**, **Cooking**. The agent picks by business type, and `choose_template` switches between them. Update `SiteConfig`, `presets.ts`, the agent tool description and tests. This is a spec change: record it in the plan's decisions log |

## Cake store redesign (`/s/demo`, Eko Sweet Bakes)
- Current look, which the user rejects: `Images/cakes/old cake ref.png` (plain cream page, a flat maroon box instead of the hero image).
- Target: `Images/cakes/storeRef.jpg`, `storeRef (2).jpg`, `storeRef3.jpg`, `cake store ref checkout.png`, `checkout ref.png`. Playful bakery brand with wavy colour bands between sections (olive, lavender, pink, forest green), sticker illustrations (flowers, leaves, sparkles, cake slices), rounded pill buttons, a chunky retro serif with script accents, a "flavour palette" colour-swatch section, and big rounded photo cards.
- Palette: olive #A6A03C, orange #EB6D20, yellow #F2C051, lavender #BCA4CF, pink #E67391, cream #F5E8D5, forest #143D26.
- New nav (logo centred, menu and bag icons) and a richer footer (contact pills like storeRef3, social links, store links).
- Order confirmation page per `checkout ref.png`: olive wavy "Thank you." hero with a cake sticker, a rounded order card with a product thumbnail, pink pill "Back to the store" button, pink wavy band with stickers at the bottom.
- Products: Red Velvet and Ube Coconut have photos. **Chin Chin Gift Jar has no image: set it inactive**, both in the DB and in `scripts/seed-demo-store.mts`, then re-sync Shopify. Product photos available in `Images/cakes/` (cakeAsset*.png, chocolate_berry_cake.png, red_velvet_cake.png, hero_lavender_celebration_cake.png). Only add a product if the user gives a price: the agent never invents prices, and neither do we.
- Stickers come from `Images/generated/` once the user supplies them (see `docs/image-prompts.md`).
- The storefront is still themed from the brand kit (CSS variables), so a new bakery store gets the same structure in its own colours.

## Shopify (to do)
- Publish the store's active products to the Online Store sales channel: query `publications`, then `publishablePublish` (scope `write_publications` is granted). Re-sync first, because stock and prices are stale (see plan, Waiting on the user).
- Deleting Shopify's sample snowboards and the draft `axorios-spike-cake` was **not** asked for. Ask first.

## Timeline flag
The plan's working target is submit 9 Nov, with 11 Nov official and 12 Nov hard. This redesign is several days of work. Proposed order:
1. cake store redesign + order page
2. dashboard nav, hover and cursor fixes + the bottom-left block
3. remove "demo" wording + pricing
4. Shopify publish
5. Phosphor swap
6. Tailoring and Cooking templates
7. GSAP extras

Items 6–7 are the first to cut if 11 Nov gets tight.

## Working rules
Keep `npm run build`, lint and tests green. Run heavy commands in the background (low memory). Dev server on port 3100. Check by eye in headless Edge at 390 / 820 / 1440 (see `docs/ui-redesign-brief.md`, "How it was verified").
