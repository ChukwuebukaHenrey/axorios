# Landing image brief (10 Nov 2026)

Every image on the marketing pages (`/`, `/features`, `/use-case`, `/integrations`) that is a placeholder, a reused
background, a stand-in screenshot or an icon-only tile, with what it should show and a prompt for it. Images that
already do their job (the hero landscapes, the footer art, the seller portraits) are listed at the end and left alone.

Save files under `Images/landing/` with the names below; the next session wires them into `public/images/marketing/`.

## House style (paste above every prompt)

> Editorial commercial photography for **AxoriOS**, a voice-first AI agent that takes small sellers in Lagos and
> across Africa from a business idea to a first paid order. Warm, natural light; real people and real products;
> shallow depth of field; quiet, uncluttered composition with negative space for a headline. Colour grade: deep
> near-black shadows, warm cream highlights (#F5F1E8), one accent of acid lime (#E3FF48) somewhere in the frame
> (a ribbon, a mug, a lit screen edge). Shot on a 35 mm lens, f/2, Kodak Portra feel, fine grain.
> **No readable text, numbers, prices or UI copy anywhere in the image. No logos or brand marks. No watermarks.**
> Screens may glow but show only soft, abstract shapes.

Why no text: the site draws every price and label itself (CLAUDE.md: image prompts never contain prices), and generated
text always comes out garbled.

---

## Home (`/`)

### 1. Problem: "Selling online is still slow. Across borders it's slower."
Now: `tritty/shopify-install.png`, a Shopify permissions screen. It reads as an ad for Shopify, not the problem.
The section's three points: scattered tools, manual payments (transfer screenshots, currency in your head), slow
first sale.

**`problem-scattered.jpg`** (2000×1500, 4:3)
> Overhead flat-lay on a wooden worktable in a small Lagos home bakery at dusk: three phones and a cracked tablet
> scattered between a half-iced cake, a notebook full of crossed-out sums, a calculator and a printed bank transfer
> slip. Each phone screen glows a different colour with abstract chat bubbles and blurred tables, no readable text.
> Flour dust, a piping bag, a cold cup of tea. The mood is busy and tired, slightly chaotic but beautiful. Warm tungsten
> light from one side, deep shadows. One lime-green sticky note is the only bright accent.

### 2. Services carousel ("Built to simplify how selling gets done")
Four slides, each a foreground image over a background. Slide 2 is `checkout-live.jpg` (a tall phone screenshot, the
one you flagged), slide 3 is `tritty/food-2.jpg` with a "placeholder" label, and slide 4 is the Shopify permissions
screen again. Slide 1 (`home-dash.png`) is a dashboard capture that still shows the old Build tab, so it should be a
fresh screenshot (see **Screenshots** below), not a generated image.

**`service-payments.jpg`** (1600×1200): *Payments & orders*, PayPal in any currency
> A young British-Nigerian woman in a London flat, sitting on a sofa by a rainy window, smiling at her phone as she
> completes a payment; the phone screen shows a soft glowing confirmation shape with a checkmark, no text. On the
> coffee table, a birthday card and a small gift box tied with lime ribbon. Cool window light on her face, warm lamp
> behind. The feeling: "I just sent my mum's birthday cake to Lagos from here."

**`service-chat.jpg`** (1600×1200): *Chat selling*, Telegram agent that answers, builds a cart and sends a pay link
> Close-up of two hands holding a phone in a busy Lagos market at golden hour, the screen showing a chat conversation
> as abstract rounded bubbles in two colours plus one glowing card-shaped bubble (a payment link), no readable text.
> Blurred background of fabric stalls and a seller handing over a cake box. Lime accent on the phone case.

**`service-marketing.jpg`** (1600×1200): *Marketing & sync*, on-brand posts on a schedule, Shopify sync
> A home baker photographing a decorated celebration cake on a cream backdrop with a phone on a small tripod, a ring
> light glowing softly; beside her on the table a laptop shows a grid of three square social-post thumbnails (just
> colour blocks and cake shapes, no text). Clean, bright, editorial kitchen studio. Lime cake topper as the accent.

### 3. Notes ("How AxoriOS is built")
Three cards now reuse the page backgrounds and the placeholder photo. Each card is a short essay title, so these
should feel like magazine story art.

**`note-naira-dollars.jpg`** (1600×1067, 3:2): "Pricing in naira, charging in dollars"
> Still life on dark slate: a fanned stack of Nigerian naira notes and a single folded US dollar note, a slice of red
> velvet cake on a small plate between them, a phone lying face-up glowing softly with an abstract exchange-arrow
> shape. Hard side light, long shadows, rich and minimal. Notes must not show readable serial numbers or legible text;
> keep them slightly out of focus.

**`note-approvals.jpg`** (1600×1067): "Why every publish waits for your yes"
> A seller's thumb hovering over a large glowing approve button shape on a phone (abstract, no text), shot from over
> her shoulder in a sunlit tailoring studio full of ankara fabric bolts. A moment of calm decision. Lime glow from the
> button lights her fingertip.

**`note-telegram.jpg`** (1600×1067): "Selling on Telegram without a second inbox"
> A single phone propped against a cake box on a shop counter at night, its screen lit with a stream of abstract chat
> bubbles; the rest of the shop is dark and closed, a "closed" mood without any sign or text. The idea: the shop is
> shut but the phone keeps selling. Neon lime rim light on the counter edge.

---

## Features (`/features`)

### 4. Capability cards ("Everything you need to start selling")
Six cards are a grey box with one icon. Each needs an image across the top two-thirds of the card (title and body
stay below). Same framing for all six so they read as a set: **1200×900, subject centred, dark background, single
warm key light, lime accent.**

| File | Card | Prompt (after the house style) |
|---|---|---|
| `cap-voice.jpg` | Voice-first builder | A woman in an apron speaking into her phone held close to her mouth, eyes closed mid-sentence, flour on her hands; a soft lime sound-wave glow rises from the phone. Dark kitchen background. |
| `cap-storefront.jpg` | Storefront & checkout | A phone standing upright on a cream pedestal showing an abstract storefront: a big cake photo block and three product tiles, no text. A real cake on a stand blurred behind it. |
| `cap-chat.jpg` | Chat selling | Two phones facing each other on a table like a conversation, each with abstract chat bubbles, one bubble glowing lime. Moody, minimal. |
| `cap-marketing.jpg` | Scheduled marketing | Three square printed photos of cakes pinned to a cork board in a row with lime pins, a small desk calendar blurred in front (no readable dates). |
| `cap-integrations.jpg` | Integrations | Abstract: five softly glowing rounded tiles floating in a dark space, connected by thin light lines into one central tile, like an app constellation. No logos. |
| `cap-safety.jpg` | Safety & approvals | A hand holding a phone with a large abstract shield shape and a check glowing on screen, a padlock-shaped cake topper beside it. Calm, trustworthy. |

---

## Use case (`/use-case`)

### 5. "One agent. Every part of the shop." (four tabs)
Storefront uses the old dashboard screenshot; **Sales** shows `food-2.jpg` with a "placeholder" label; **Payments**
is the tall phone screenshot; **Marketing** is the Shopify permissions screen.

- **Storefront:** a fresh screenshot of the Axori AI workspace (see **Screenshots**).
- **`usecase-sales.jpg`** (1600×1200): "Sell while you sleep."
  > A dark bedroom at 2 a.m., a seller asleep in soft blue moonlight; on the bedside table her phone lights up with
  > a stream of abstract chat bubbles and one glowing payment card. Calm and cinematic. Lime notification glow.
- **`usecase-payments.jpg`** (1600×1200): "Get paid across borders."
  > Split scene in one frame: left, a cold grey London window with a hand tapping pay on a phone; right, a warm Lagos
  > doorstep where a smiling grandmother receives a celebration cake box tied with lime ribbon. A soft light seam
  > joins the two halves.
- **`usecase-marketing.jpg`** (1600×1200): "Keep customers coming back."
  > A returning customer in a cosy café picking up a cake box with a little lime loyalty sticker, the baker waving
  > behind the counter. Warm, friendly, human.

---

## Integrations (`/integrations`)

### 6. Shopify tile
The wall uses a shopping-bag glyph because there is no Shopify mark in `public/images/icons/`. Don't generate this.
Download the official Shopify bag logo (PNG, transparent, 512×512) from Shopify's brand assets page and save it as
`public/images/icons/shopify.png`; the wall and the logo strip switch to it in one line each.

---

## Screenshots (yours, not generated)

These must be real captures, because they show the product itself:

| File | Where | Capture |
|---|---|---|
| `home-dash.png` (replace) | Home hero and services slide 1 | Desktop 1440×900, `/dashboard/ai`, a chat where Axori AI has just drafted the brand kit, with the store preview visible. |
| `usecase-card.png` (replace if it shows Build) | Use-case hero | Desktop `/dashboard` Home with the orders and revenue tiles filled (demo account). |
| `shot-storefront.png` | Use-case Storefront tab | Desktop `/s/demo` hero and first products. |

Take them in a desktop browser at 1440×900, 100 % zoom, at device scale 2 if you can, and crop out the browser UI.

## Keep as they are

`home-bg.png`, `features-bg.png` and `usecase-bg.png` (hero and card backgrounds), `footer-landscape.webp`,
`stories/seller-1…5.png`, and the integration icons.
