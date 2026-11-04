# AxoriOS — Requirements

What the product must do for the hackathon build. Each requirement has an ID; plan steps and commits reference these IDs. Architecture details live in `docs/spec.md`.

## 1. Users
| User | Who | Goal |
|---|---|---|
| Seller | Non-technical small business owner, anywhere, usually on a phone | Go from an idea to a first paid order without learning e-commerce tools |
| Buyer | The seller's customer, local or abroad | Find the product, ask questions, pay safely in their own way |
| Judge | Hackathon reviewer, 1–15 Dec | Sign in, see the flow work end to end, test a sandbox payment |

## 2. Functional requirements

### Onboarding and brand (F1)
| ID | Requirement | Acceptance |
|---|---|---|
| F1.1 | Seller signs in with a magic link; one demo account also signs in with email + password | Both work from a logged-out browser |
| F1.2 | Seller describes the business by voice or text, in any language | A Pidgin or English voice note produces a brand kit draft |
| F1.3 | Agent creates a brand kit: name options, tagline, palette, fonts, tone, logo | Brand card shows all fields; seller can edit any field by chat |
| F1.4 | Seller can upload inspiration images or screenshots; the agent extracts style from them | Palette and fonts in the brand kit change to match the reference |

### Catalog (F2)
| ID | Requirement | Acceptance |
|---|---|---|
| F2.1 | Seller adds products by voice, text or photo | Products saved with name, description, price, image, stock |
| F2.2 | Prices are in the seller's chosen currency (any ISO code) | NGN, GBP and JPY stores all store and show correct amounts |

### Storefront (F3)
| ID | Requirement | Acceptance |
|---|---|---|
| F3.1 | Site is built from template families (Market, Studio, Kiosk), each with sub-template presets; the look follows the brand kit and references | The same store renders correctly in every shipped preset |
| F3.2 | Builder shows a live preview of the draft site, phone and desktop | Preview updates within 3 s of an agent edit |
| F3.3 | Seller clicks a section in the preview and changes it by chat | Only that section changes |
| F3.4 | Every change is versioned and can be reverted | Revert restores the exact previous version |
| F3.5 | Nothing goes public until the seller approves Publish | Public URL returns 404 for draft-only stores |
| F3.6 | Store links shared in WhatsApp show the store name, image and description | Link preview renders in WhatsApp |
| F3.7 | Store has WhatsApp and Telegram contact buttons and a web chat bubble | Each opens a conversation with the store's sales agent |

### Checkout and payments (F4)
| ID | Requirement | Acceptance |
|---|---|---|
| F4.1 | Buyer pays through PayPal (sandbox) | Sandbox buyer completes a purchase; order marked paid |
| F4.2 | Owner currency is charged directly when PayPal supports it; otherwise converted to the settlement currency at a locked rate | NGN store charges USD at the stored rate; GBP store charges GBP |
| F4.3 | Buyer sees the price in the owner's currency and the amount charged before paying | Both amounts on checkout and confirmation |
| F4.4 | Payment completes even if the buyer closes the tab after approving | Order captured via webhook within 1 minute |
| F4.5 | Duplicate webhooks never create duplicate orders or captures | Replaying an event changes nothing |

### Chat selling (F5)
| ID | Requirement | Acceptance |
|---|---|---|
| F5.1 | Customers chat with the store on WhatsApp (Twilio Sandbox), Telegram and web chat | Same agent answers on all three |
| F5.2 | Sales agent answers only from this store's catalog, in the customer's language | Questions about other stores or prices get a correct refusal |
| F5.3 | Sales agent creates an order and sends a PayPal payment link | Paying via the link marks the order paid |
| F5.4 | Seller sees every conversation in one inbox and can take over | Takeover stops agent replies on that conversation |
| F5.5 | Replies arrive within 10 s on WhatsApp | Measured on the production deployment |

### Marketing (F6)
| ID | Requirement | Acceptance |
|---|---|---|
| F6.1 | Agent generates campaign posts (image + caption) that match the brand | 3 posts share palette, type and style visibly |
| F6.2 | Seller approves, edits and schedules posts | Scheduled post publishes to the Telegram channel at the set minute |
| F6.3 | Every post is downloadable as a pack (image, caption, suggested time) for manual posting | Zip downloads and opens |

### Shopify (F7)
| ID | Requirement | Acceptance |
|---|---|---|
| F7.1 | Seller connects a Shopify store | Connection tested and saved, token encrypted |
| F7.2 | Agent syncs products, collections and pages to Shopify | Second sync updates rather than duplicates |
| F7.3 | Agent applies brand colours and fonts to the Shopify theme if Shopify allows it | Works, or the seller gets a theme-editor link with the values listed |

### Agent behaviour (F8)
| ID | Requirement | Acceptance |
|---|---|---|
| F8.1 | One agent, two roles: seller (builder) and sales (customer) | Sales role has no tools that change the store |
| F8.2 | Public or financial actions need seller approval | Publish, schedule, Shopify sync and seller payment links show an approval card |
| F8.3 | Agent replies in the language it's spoken to | English, Pidgin, French and Yoruba tests reply in kind |

## 3. Non-functional requirements
| ID | Requirement | Target |
|---|---|---|
| N1 | Mobile-first | Every screen usable at 360 px wide |
| N2 | Storefront speed | Lighthouse performance ≥ 85 on mobile for `/s/[slug]` |
| N3 | Webhook handling | 200 returned within 2 s; all work in background jobs |
| N4 | Security | Row-level security on every table; secrets only in env; signatures verified on every webhook |
| N5 | Data isolation | No query or tool can reach another store's data |
| N6 | Cost control | Max 8 tool steps per turn; per-store daily cap; $10 Gemini budget alert |
| N7 | Judge availability | App, database and demo account working from 1 to 15 Dec |
| N8 | Accessibility | Keyboard navigable; colour contrast AA on all presets |
| N9 | Extensibility | Meta, Paystack or a new template preset = new adapter or config, no agent rewrite |

## 4. Out of scope (this build)
Real money; Meta (WhatsApp Cloud API, Instagram, Facebook posting, ads); Jumia and Konga; creating Shopify stores; video generation; external template platforms; delivery logistics; multi-agent orchestration.

## 5. Demo script (under 3 minutes)
1. Seller speaks: "I bake celebration cakes in Lagos, prices from 30,000 naira." → brand kit appears.
2. Agent drafts the store in the Market preset; seller switches preset, edits the hero by clicking it, then publishes.
3. UK buyer opens the store, sees ₦45,000 ≈ $29.40, pays with the PayPal sandbox; order shows both amounts.
4. A customer messages on WhatsApp in Pidgin; the agent answers and sends a PayPal link; payment lands.
5. Agent generates 3 on-brand posts; one publishes to Telegram on schedule.
6. Agent syncs the catalog to Shopify; products appear in the Shopify admin.
