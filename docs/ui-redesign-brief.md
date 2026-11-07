# UI redesign brief (6–7 Nov 2026)

Handoff for the next session. Covers the marketing site, auth pages, seller dashboard and storefront polish.
**Nothing below is committed yet.** Lint, 97/97 tests and `npm run build` all pass on the working tree.

## Where to look

| What | Where |
|---|---|
| Figma (ZenFlo kit, trimmed to 5 pages) | https://www.figma.com/design/Z9A3GRVq1d24XfmFc7Y5bu/ZenFlo---AI-Automation--SaaS--AI-Startup---C--Community-?node-id=0-1 |
| Figma page frame IDs (canvas `0:1`) | Home `20:1500`, Feature `20:7790`, Use Case `20:6104`, Integration `20:5889`, Pricing `20:5551`, 404 `20:9281`, Mobile page `15:11429` |
| Figma exports (every section as PNG, named by frame) | `Images/ZenFlo - AI Automation, SaaS, AI Startup - C (Community)/` |
| Hero/background refs | `Images/references/` (homerefbg, homerefdash, feature bg, usecasebg, usecase-morhphism-image, pricing, error page) |
| Dashboard refs | `Images/references/homerefdash.png` (layout), `Images/references/agentdashboard/` (agent interface + chatbox) |
| Auth ref (current) | `Images/signup_signin_img/sign up.png` + baker/cook/tailor photos |
| Storefront/checkout refs | `Images/cakes/` (checkout ref, cake photos) |
| Carousel / icons / fallbacks | `Images/woman images for slider/carousel/`, `Images/icons/`, `Images/tritty/` |
| Product spec | `docs/spec.md` (UI/UX section: screens table, interaction rules) |
| Step plan | `plans/axorios.md` (Progress table **not yet updated** for this work) |

`Images/` is gitignored on purpose (third-party moodboards). Curated copies live in `public/images/`.
The Figma MCP is on the Starter plan and rate-limits after a handful of calls; use the local exports first.

## Done

**Marketing site** (`src/app/page.tsx`, `features/`, `use-case/`, `integrations/`, `pricing/`, `not-found.tsx`, components in `src/components/marketing/`)
- Each page follows its Figma frame section by section, with AxoriOS copy (all in `messages/en.json` → `marketing`).
- Theme tokens added in `globals.css`: cream, lime, panel, panel-2, panel-3, stone; Geist + Geist Mono fonts in `layout.tsx`.
- Honest substitutions: no fake testimonials (carousel cards say "Example seller"), no invented stats, pricing is "free in beta", integrations show only what AxoriOS really connects to.
- Hero fits 100dvh on desktop; no horizontal overflow at 390/820/1440.

**Auth** (`src/app/sign-in`, `src/app/sign-up`, `src/components/auth/`)
- Matches `sign up.png` in our theme: inset photo carousel left with logo, form right, compact card (max 1080×680).
- Sign-up is real (`supabase.auth.signUp`, first/last name in metadata, email confirmation via `/auth/callback`). Sign-in keeps magic link + password.
- Google/Apple read the provider flags from Supabase (`src/lib/supabase/auth-providers.ts`); currently both off, so buttons say so.

**Seller dashboard** (`src/app/(dashboard)/`)
- Shell per `homerefdash`: sidebar (workspace switcher, Build/Orders/Inbox/Campaigns/Integrations with counts), top bar (search → orders filter, bell, account menu with sign-out). `session.ts` = cached `requireSeller()`.
- Build: agent intro + chatbox per agent refs; Claude-style toggleable preview (template, device, undo, **version history with restore**, reload, open, publish, close); status cards (Brand, Products, Publish, Campaigns, Schedule, Shopify). `/build?prompt=` prefills the chat.
- Orders: revenue / orders / conversations / scheduled stats, Shopify status, order table.
- **Inbox (new, spec 3.4)**: chat list, takeover / hand back (`agent_paused`), seller replies sent through the real channel (`src/modules/channels/inbox.ts`).
- Integrations (new): live status for PayPal, Telegram (copy chat link), Shopify, WhatsApp.
- Module additions: `listVersions` / `restoreVersion` in storefront; channel registry moved to `channels/registry.ts`.

**Storefront / checkout** (earlier in the session)
- Wave dividers + card polish in shared sections (`modules/storefront/components/`), order confirmation page restyled; demo store seeded with real cake photos (`scripts/seed-demo-store.mts`).

## Not done / open

- **Commit and push**, then update `plans/axorios.md` Progress (3.4 Inbox is now built).
- `package.json` / `package-lock.json` show changes not made in this session: check before committing.
- Feature, Use Case, Integrations and Pricing pages: page heights match Figma, but a full visual pass against the exports wasn't finished.
- Figma "Mobile Responsive" page (`15:11429`) not consulted; responsiveness is our own breakpoints.
- Missing assets, shown as placeholders: Shopify logo (bag icon), chat-selling screenshot (dashed box), Gemini mark.
- Terms of Service / Privacy Policy pages don't exist; links point to the repo LICENSE / README.
- Enable Google and Apple in the Supabase dashboard if wanted (no code change needed).
- Spec items still unbuilt: template gallery `/build/templates` with "Upload inspiration" (`apply_reference`).
- Approve/Deny lives inline in chat (per spec); the status cards only draft requests.
- WhatsApp replies in the Inbox are blocked while `WHATSAPP_ENABLED=false`.
- `seed-demo-store.mts` reads photos from the gitignored `Images/cakes/`, so it won't run with images on a fresh clone.
- Dev-mode preview iframe takes 15–30 s on first load (compile); fine in production.

## How it was verified

Headless Edge over the DevTools protocol at 1440, 820 and 390 widths, signed in with the demo seller from `.env.local`, checking `scrollWidth == clientWidth` and screenshots against the refs. Those scripts lived in the job temp folder and are gone; recreate if needed (spawn `msedge.exe --headless=new --remote-debugging-port=…`, drive `Page.navigate` / `Page.captureScreenshot`). In Git Bash, prefix with `MSYS_NO_PATHCONV=1` so `/build`-style arguments aren't rewritten.
