# Session brief (9 Nov 2026, session 2): Phase 6 backend

Handoff for the next session. Everything below is **committed and pushed** (`70b0829`). 138/138 tests, lint and `npm run build` pass.

## Done this session (backend first, per the user)

| Step | Result |
|---|---|
| 0.4 | Last session's Cloudflare Flux work committed (`1ef07cf`, `9fc5769`) |
| 6.0 | `docs/spec-v2.md` (the v2 build doc, renamed), CLAUDE.md edits, env schema + `.env.example` for Kapso, demo adapters, AG Studio, Zapier, `SANDBOX_BUYERS`, `SEED`. `IMAGE_PROVIDER` accepts `cloudflare`/`og` aliases. **Vercel env keys not added yet.** |
| 6.1 | `src/modules/agent/approvals.ts`: one list of gated tools, used as a generic `toolApproval` policy. 14 tests through a mock model. |
| 6.2 | Migration `20261109000000_v2.sql` pushed; types regenerated; `scripts/e2e-rls-v2.mts` passes; `src/modules/analytics/metrics.ts` (+10 tests). VAT stored on new orders; capture stores PayPal fee/net/payer country. |
| 6.4 | `src/modules/imports` (CSV + Zod + service), `scripts/seed-v2.mts`, `scripts/check-demo.mts`, `scripts/reset-demo.mts` (`npx tsx scripts/reset-demo.mts`). Demo: 1,704 orders, ₦9m → ₦14m/month; UK store `eko-sweet-kitchen-uk` in GBP. Two runs give identical counts. |
| 6.7 backend | `orders/refund-plan.ts` + `orders/refunds.ts`, `refund_order` tool, refund webhook in the job, `scripts/e2e-refund.mts` passed on the real sandbox. **Money UI and the Orders Refund button are not built.** |

## Next, in order

1. **6.3 Shell and Axori AI** (UI starts here). New top bar + grouped sidebar (spec v2 IA), Axori AI side panel (Ctrl/⌘+J, Esc), full page, threads in `ai_threads` (account + store), context chips, mobile bottom bar + floating button. Use shadcn components (`components.json` is set up with the @aceternity, @magicui and @originui registries).
   - **Animated mascot:** `Images/new assets/AxoriOS_Emotion_States/{happy,thinking,listening,speaking,confused,surprised}.png` (1254 px RGBA, transparent, ~750 KB each). Resize to ~256/512 px WebP into `public/mascot/`. Map agent states: idle → happy, streaming text → speaking, tool running / waiting → thinking, mic recording → listening, error → confused, approval card arrives → surprised. Use `motion` for a float/breathe idle, squash on state change, a crossfade between faces and a glow pulse while speaking. `Glossy Lime Blob AI Mascot.png` is the hero/marketing pose.
   - UI references in `Images/new assets/`: `chatinterface*.webp` (EchoAI chat layout: suggestion cards, composer with mic), `ChatGPT Image Nov 9…` (Bankio-style finance dashboards for Money and Home tiles), `integration.png` (Connections directory), `Discord iOS 28.png` (mobile).
2. **6.6 Analytics (AG Studio)**: pin `ag-grid-community` 36.2.0, `ag-grid-react` 36.2.0, `ag-studio` 3.0.0, `ag-studio-react` 3.0.0. Install in the background (npm is slow here). Read the boilerplate for the pattern only (no licence there).
3. **6.7 UI**: Money tab (Overview, Money in, Money out, Expenses, Withdrawals, VAT, Statements) + the Refund card on Orders (calls `previewRefund`, then `executeRefund` with an approval id).
4. **6.8 Home + Store overview**, **6.9 Customers**, **6.10 Marketing performance + demo adapters**, then 6.12, 6.14, 6.11, 6.13 (cut list order: the last ones go first).

## Open / user tasks

- PayPal `GET /v1/reporting/balances` failed from the sandbox app, so the refund card shows the balance as unknown. Enable **Transaction search** (and balance reporting) on the sandbox REST app. 6.6's PayPal grid needs it too.
- Vercel: add the new env keys to production (names in `.env.example`), then redeploy. Production already gets `PAYMENT.CAPTURE.REFUNDED`; the event from 9 Nov 03:23 UTC is stored and is processed once the new code is live.
- The full-refund e2e used the 5 Nov Telegram test order (913eade6, now `refunded`). It is hidden (`source = 'test'`); its 3.2 evidence stays in Progress.
- Kapso and Zapier keys and `SANDBOX_BUYERS` are still needed from the user (spec v2 "Tasks for Ebuka").
- Not committed, not from this session: `.claude/`, `.mcp.json`, `test-cake.jpg`.

## Gotchas found

- Node 26 `fetch` here resets uploads over ~1 MB: seed images go up as ~1200 px JPEG via `sharp`.
- `next build` and `npm test` must run from `C:\Users\ADMIN\AxoriOS` (real casing).
- `tsc -p .` includes `scripts/`; keep scripts type-clean.
- PostgREST paging needs a stable `order()`, or rows repeat or go missing across pages.
