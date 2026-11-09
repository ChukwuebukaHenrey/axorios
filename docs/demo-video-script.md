# 5.4 Demo video script (under 3:00)

The recording guide for step 5.4. It follows the six demo steps in `REQUIREMENTS.md` §5 and the plan decision: steps 1–2 on a fresh seller account, steps 3–6 on the demo store (`/s/demo`, Eko Sweet Bakes), because only the demo store can reach the Telegram channel and the Shopify dev store.

Target: 2:45. The times leave 15 s of slack. Narration is a guide, not a teleprompter; say it in your own words.

## Before you record (allow 30 minutes)

1. `npx tsx --env-file=.env.local scripts/reset-demo.mts`, then `scripts/check-demo.mts`. Both pass.
2. Open production `/s/demo` in your recording browser. This network couldn't reach `axorios.vercel.app` on 5 Nov; confirm it loads now.
3. Decide on the leftover test orders ("E2E…", "Locale check", "me"). Delete or keep before the take, since Orders and Home show them.
4. Telegram: open the bot chat on your phone or a second window and send "hi". Check it answers. Open the channel the post will publish to.
5. Shopify: sign in to the dev store admin in a tab, on Products.
6. PayPal: have the sandbox buyer login ready (it is in Devpost's private testing notes, never on screen in full).
7. Check the live NGN→USD rate on the product page and note it for line 3.
8. Make a fresh seller account for steps 1–2 (magic link) and leave it at `/build`.
9. Gemini was slow on 5 Nov (copy took 15–44 s). Do one warm-up agent turn first. If a turn stalls on camera, cut it in the edit; don't wait on screen.
10. Browser at 1440×900, zoom 100%, bookmarks bar hidden, notifications off. Mic check.

## The script

| Time | Screen | Say |
|---|---|---|
| 0:00–0:12 | Landing page (`/`), hero rises in. Scroll once. | "Most people with a business idea never get to a first order. They stall on a logo, a website, payments. AxoriOS is a voice-first agent that takes you from idea to paid order." |
| 0:12–0:35 | **Step 1.** Fresh account, `/build`. Hold the mic button and speak. Brand kit card appears. | (to the agent) "I bake celebration cakes in Lagos, prices from thirty thousand naira." (to camera) "From one sentence, Axori AI writes a brand kit: name, palette, fonts and tone." |
| 0:35–1:00 | **Step 2.** Store draft in the Market preset. Switch preset. Click the hero, change the headline. Approve Publish. | "It drafts the storefront from the brand. I can switch the look, or click any part to change it. Nothing goes live until I approve it." |
| 1:00–1:30 | **Step 3.** Switch to the buyer: `/s/demo`, Red Velvet Celebration Cake. Price shows ₦ and ≈ $. Checkout, PayPal sandbox, pay. Order page shows both amounts. | "Now a buyer in the UK orders a birthday cake for family in Lagos. The shop is priced in naira; PayPal charges dollars at the rate shown before paying. The order keeps both amounts." |
| 1:30–1:55 | **Step 4.** Telegram: send "Abeg, una get red velvet for Saturday?". Agent replies in Pidgin and sends a PayPal link. Pay. Cut to Inbox showing the chat and the paid order. | "Customers can also buy in chat. Axori AI answers in their language, quotes from the real catalogue, and sends a PayPal link. It can't invent prices: totals come from the database." |
| 1:55–2:20 | **Step 5.** Marketing: ask for three posts. Three on-brand cards appear. Schedule one, approve. Show it landing in the Telegram channel (pre-scheduled a minute ahead, or cut). | "It writes on-brand posts with the real price drawn onto the image, and schedules them. Publishing always waits for my approval." |
| 2:20–2:35 | **Step 6.** Ask Axori AI to sync to Shopify, approve the card. Shopify admin tab: refresh Products. | "And if the seller grows into Shopify, the catalogue syncs over with one approval." |
| 2:35–2:50 | Dashboard Home, then Analytics (Sales over time, 6 months), then Money. | "Six months in, everything is in one place: sales, marketing, customers and PayPal payouts, with every number reconciled against PayPal." |
| 2:50–2:58 | Logo end card. | "AxoriOS. From idea to first paid order. Built on PayPal." |

## Cutting room

- If over 3:00, shorten step 2 first (skip the preset switch), then the 2:35 tour (Home only).
- Record steps as separate takes and join them; it is easier than one perfect run.
- Blur or crop any email, password or PayPal buyer ID that appears.

## After recording

1. Upload to YouTube as Public (or Unlisted only if Devpost accepts it), title "AxoriOS – idea to first paid order with PayPal".
2. Watch it once, logged out, end to end (the 5.4 verification). Check it is under 3:00.
3. Paste the link into Devpost and the README, then do 5.5.
4. Run `reset-demo` again before judging opens on 1 Dec.
