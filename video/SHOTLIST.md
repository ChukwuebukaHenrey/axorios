# AxoriOS demo — shot list (draft 2, for approval)

1920×1080, 30 fps. Target 2:50 (hard limit 3:00). Follows `docs/demo-video-script.md` in the style of `ref.mp4`.

## Sources

| File | What it is | Notes |
|---|---|---|
| `ref.mp4` | 40 s silent promo for another AI product. **Style only**, none of it is used. | — |
| `AxoriOS.mp4` | 2:20 seller walk-through, **852×480** | Steps 1–2: voice note → "Cake & Cravings" brand kit → renamed "Ebuka's Cake", Signature Cake ₦50,000 → Publish approval → pink live storefront. Low resolution, so it's shown in a smaller tilted frame, never full screen. |
| `tg.mp4` | 24 s, 1080p | Steps 3–4 in one take: Telegram chat in Pidgin → PayPal sandbox → "Thank you. Your order is paid." ₦102,000 / $75.58 |
| `shots/*.png` | My 1440×900 captures of landing, features and use-case | Sharp, used for the opener and the feature beats |
| `stills/dash-home`, `dash-store` | Existing app screenshots in the repo (demo store, real data) | Used for the tour |

## What the reference does, and what we copy

- Opens on a glowing prompt bar: text types in, a big glossy cursor clicks Send.
- The camera never stops: slow push/pan, panels tilted 5–15° easing to flat.
- Hard cuts only between chapters, and each chapter gets its own backdrop colour.
- Stat cards tilt in and their numbers count up.
- No title cards: the UI is the text. We add short captions (2–5 words, bottom-left) so the video works muted.

## Shots

| # | Time | Len | Backdrop | Shot | Source (in → out) | Caption |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:05 | 5 s | Black → lime glow | Prompt-bar opener in the Axori AI composer look: mic pulses, "I bake celebration cakes in Lagos…" types in, cursor clicks Send | Built in Remotion | — |
| 2 | 0:05–0:13 | 8 s | Lime glow | Landing hero pushes in from a 12° tilt, then glides down to "All-in-one selling agent" | `shots/landing-00, -04` | "From idea to first paid order" |
| 3 | 0:13–0:20 | 7 s | Dark lime | Fresh account: Axori AI, "What shall we work on?", voice note recording (17 s squeezed to 4 s, with a "4× speed" chip) | `AxoriOS.mp4` 0:57 → 1:18 | "Just say what you sell" |
| 4 | 0:20–0:36 | 16 s | Dark lime | **Step 1.** "You said: …" then the **Cake & Cravings** brand kit card. Push in on palette swatches, fonts, tone, name ideas | `AxoriOS.mp4` 1:19 → 1:28 (held/slowed) | "One voice note → a brand kit" |
| 5 | 0:36–0:50 | 14 s | Dark lime | **Step 2.** Seller types "Let's name it Ebuka's Cake, 50000 naira each", the card updates with **Your products: Signature Cake ₦50,000**, then "Where can I access it?" (the wait cut out) | `AxoriOS.mp4` 1:25 → 1:33, 1:33 → 1:45 sped 3× | "Change anything by asking" |
| 6 | 0:50–0:57 | 7 s | Dark lime | The **"Put your store online? Publish / Not yet"** card. Zoom in, big cursor clicks Publish, "Your store is live" link | `AxoriOS.mp4` 1:45 → 1:49 | "Live only when you approve" |
| 7 | 0:57–1:07 | 10 s | **Hard cut → hot pink** (matches the store) | Live storefront in a flat browser frame: hero "Freshly baked cakes…" → Our products → Talk to us (Telegram) | `AxoriOS.mp4` 1:50 → 1:58 | "A designed storefront, no code" |
| 8 | 1:07–1:30 | 23 s | **Hard cut → Telegram navy** | **Step 4 first** (it's one take). Telegram chat cropped to the conversation only: "you dey sell cake" → prices from the catalogue → "gimme the red velvet 2 and 1 brownie" → order summary ₦102,000 = $75.58 + PayPal link. 13 s → 21 s with slow scroll; three callout chips pop in: "Replies in Pidgin", "Prices from the catalogue", "PayPal link" | `tg.mp4` 0:00 → 0:13 | "Sells in chat, in their language" |
| 9 | 1:30–1:38 | 8 s | **Hard cut → PayPal blue** | **Step 3.** PayPal sandbox: Complete Purchase, the spinner trimmed to 1 s | `tg.mp4` 0:13 → 0:17 | "Paid through PayPal" |
| 10 | 1:38–1:52 | 14 s | Cream / olive (the store's order page) | "Thank you. Your order is paid." glides down to the totals; side callout counts up **₦102,000 → $75.58 at 1 NGN = 0.000741 USD** | `tg.mp4` 0:18 → 0:24 | "Priced in naira. Paid in dollars." |
| 11 | 1:52–2:10 | 18 s | **Hard cut → warm dark** | **Steps 5–6 (no recording, see question 1).** Option A: your clips. Option B: the landing's real feature sections, tilted and quick: marketing posts, approvals, the integrations wall with Shopify | A: your recordings · B: `shots/landing-*`, `features-*` | "On-brand posts. One-tap Shopify sync" |
| 12 | 2:10–2:38 | 28 s | **Hard cut → near-black** | Tour, ref 0:13–0:21 style: the demo store's Home. Sales card tilts in, **₦15,556,209.53** counts up, the bars grow one by one, then Store: 317 orders, 11,204 visits, 2.8% count up | `stills/dash-home`, `dash-store` | "Everything in one place, reconciled with PayPal" |
| 13 | 2:38–2:48 | 10 s | Lime glow | End card: logo, "AxoriOS. From idea to first paid order. Built on PayPal." | `brand/logo.png` | — |

Total 2:48.

## Cut or covered for privacy

- `AxoriOS.mp4` 0:35–0:41 (the Google account chooser shows email addresses): not used.
- `AxoriOS.mp4` sign-up form and the account email at the bottom of the dashboard sidebar: cropped or blurred wherever they appear.
- `tg.mp4`: cropped to the chat column only. That hides your other Telegram chats on the left, the browser address bar and the CapCut watermark.
- The CapCut end card at `AxoriOS.mp4` 2:15: not used.

## Differences from the written script

- The live recording names the shop **Ebuka's Cake** (₦50,000 Signature Cake). The script expected the headline "Celebration cakes, sent with love". The video follows the recording.
- Step 4 (Telegram) comes before step 3 (PayPal), because your recording does them in one flow: chat → PayPal link → pay → paid.
