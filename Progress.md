# Lyra 2.0 — Build Progress

**Product:** AI Order Co-Pilot for FMCG distributors (Shree Agencies demo)
**Phase:** 5 — Add Business Rules (now complete)
**Started:** 2026-08-16
**Status:** 🔨 Phase 10 next (demo prep)

---

## Phase Tracker

| Phase | Name | Status |
|---|---|---|
| 0 | Freeze the Scope | ✅ Done (docs only; no separate scope.md per user choice) |
| 1 | Build the Data Brain | ✅ Done — live on Supabase `mxjsnhbziewlpnsybbvq` |
| 2 | Build the Agency Portal | ✅ Done — live on http://localhost:3000 |
| 3 | Build the Voice AI Foundation | ✅ Done — agent prompt + flow engine + browser simulator; live SnapServe number still pending |
| 4 | Connect Voice to Database | ✅ Done — API layer + simulator wired to live Supabase |
| 5 | Add Business Rules | ✅ Done — blacklist enforcement, schemes, call-time validation |
| 6 | Add WhatsApp Layer | ✅ Done — message formatting + send-whatsapp API + mark sent |
| 7 | Add Memory + Blacklist | ✅ Done — memory recall in context, blacklist filtering in suggested orders |
| 8 | Add Complaint / Return Flow | ✅ Done — complaint & return engine states + create-return API |
| 9 | Split into Multi-Agent Squad | ✅ Done — expanded intents (complaint/return detection) + intent-based routing |
| 10 | Prepare Demo + Backup + Finale Kit | ⏳ Pending |

---

## Phase 1 — Data Brain ✅ (2026-08-16)

### Deliverables
- `supabase/migrations/20260816000000_initial_schema.sql` — 12 tables, 9 enums, views, trigger
- `supabase/seed.sql` — full demo universe
- Migration `hardening_views_rls_search_path` applied (security_invoker views, locked search_path, RLS + permissive policies)

### Applied to production
- Project ref: `mxjsnhbziewlpnsybbvq`
- URL: `https://mxjsnhbziewlpnsybbvq.supabase.co`
- Security advisors: **0 findings**

### Verified live
- 5 shops, 15 products (4 categories), 15 inventory, 5 orders + 11 items, 3 schemes, 3 blacklists, 6 memories, 1 complaint, 1 return, 5 call logs
- Demo triggers confirmed:
  - Low stock: Surf Excel (P006) @ 3 units
  - Credit risk: Kannan Stores ₹10k/₹7.5k → ₹2.5k available
  - Blacklist: Lux Soap + Vim Bar (S101), Vim Bar (S102)
  - Polyglot: S101 tanglish, S103 tamil, S104 hindi, S105 english

### Notes
- Seed category count is 4 (not 3) — Oral Care added deliberately for the upsell demo (Pepsodent).
- RLS enabled with permissive `p_all_access_*` policies (single-tenant hackathon, no login).

---

## Phase 2 — Agency Portal ✅

### Goals (from Plan.md)
- 4 pages: Shops, Shop Detail, Orders, AI Memory, Exceptions (5 views)
- Real data from Supabase, not hardcoded
- Distributor control panel feel, not marketing site

### Build checklist
- [x] Scaffold Next.js + Tailwind + TypeScript
- [x] Supabase client setup (publishable key)
- [x] Design system (tokens, typography, spacing)
- [x] Layout: sidebar nav + topbar
- [x] Shops page (table + status)
- [x] Shop detail view (credit, blacklist, last order, memory, complaint)
- [x] Orders page (live orders)
- [x] AI Memory page
- [x] Exceptions page (low stock, credit, complaints, returns)
- [x] Loading / error / empty states
- [x] Responsive (320 / 768 / 1024 / 1440)
- [x] Build passes, console clean

### Delivered (2026-08-16)
- Next.js 16.3.1 + Tailwind v4 + TS in `portal/` (App Router, typed routes `PageProps`/`LayoutProps`)
- Server Components fetch live Supabase data per request (`dynamic = "force-dynamic"` on every data page)
- App shell: dark sidebar (Shops / Orders / AI Memory / Exceptions) + topbar brand, collapses to top nav on mobile
- Pages verified in Chrome against live data:
  - Shops — 5 shops, credit bars, language badges, blacklist counts, visit-due flags
  - Shop detail (Kannan Stores) — credit ₹2,500 avail/₹10,000, 3 AI memories, 2 blacklist items w/ tanglish reason, ORD1019 items, call log
  - Orders — 5 orders, ₹13,380 total, delivered/active groups, item line cards
  - AI Memory — 6 memories grouped by type, confidence bars, confirmed flags
  - Exceptions — Surf Excel low stock (3/5), Murugan complaint + return, empty states elsewhere
- States: `loading.tsx` skeleton, `error.tsx` retry boundary, `not-found.tsx`, `EmptyState` per section
- `npm run build` + `npm run lint` both clean; 0 console errors in browser

### Notes
- `portal/.env.local` holds the publishable key (`sb_publishable_…`), verified working against live REST + supabase-js (gitignored)
- Pages are dynamic so demo-time data changes (new orders, memory) show immediately
- Run locally: `cd portal && npm run dev` (dev) or `npm start` after `npm run build`
- Server was running on http://localhost:3000 at hand-off

### Environment
- `NEXT_PUBLIC_SUPABASE_URL=https://mxjsnhbziewlpnsybbvq.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_PIP3oLnCqhymy5kZh1CZag_sUxzEIyW`

---

## Phase 3 — Voice AI Foundation 🔨

### Goal (from Plan.md)
- Basic working voice agent that answers a call, greets in Tamil/Tanglish, identifies the shop, asks if it's a good time, takes a simple order, confirms it.

### Phone number — ✅ acquired
- **+918065355944** — saved in `.env.local` as `LYRA_PHONE_NUMBER`.
- Still need: SnapServe account + Vobiz integration to make this number receive live calls.

### Foundation built (phone-free, 2026-08-16)
- `portal/src/lib/voice/` — pure TS, no framework deps, ready to port to SnapServe:
  - `prompt.ts` — `LYRA_SYSTEM_PROMPT` (copy-paste ready for the live agent)
  - `intents.ts` — Tanglish + Tamil intent classifier (yes/no/stop/change; handles ஹான்/இல்லை/வேண்டாம்…)
  - `script.ts` — Tanglish script templates (greet, good-time, repeat, changes, read-back, confirm, close, opt-out)
  - `engine.ts` — deterministic call-flow state machine (greeting → good time → suggest repeat → changes → read back → confirm → end), opt-out + wrong-number + not-good-time branches, max 1 correction per plan
  - `tools.ts` — 9 function schemas for Phase 4 (identify_shop_by_phone, get_shop_context, get_repeat_order, check_stock, check_credit, check_blacklist, create_order, send_whatsapp_summary, mark_opt_out)
- **`/voice` page + simulator** (nav: Voice AI): pick a shop → Start call → reply by typing or mic (Web Speech `ta-IN`); agent speaks via `speechSynthesis` (prefers ta-IN voice, falls back to en); shows live state, flow progress, and opt-out hint. Repeat-order suggestion uses **real last orders from Supabase** (e.g. Anand → "1 box Colgate MaxFresh, 1 box Wheel Detergent").
- System prompt + tools are displayed with Copy buttons for the future SnapServe setup.
- **Real Tamil neural TTS** (upgraded from `speechSynthesis` which had no ta-IN voice on Windows → fell back to US English "American Tamil"):
  - Engine: **Microsoft Edge TTS** (`ta-IN-ValluvarNeural` male / `ta-IN-PallaviNeural` female) — free forever, no API key, no signup, no quota
  - `POST /api/tts` route (`src/app/api/tts/route.ts`) synthesizes via `node-edge-tts` (MIT) on the Next.js server and streams MP3 to the browser
  - Client helper `src/lib/voice/tts.ts` (`speakLyra`) plays the audio; auto-falls back to `speechSynthesis` if the route fails (e.g. offline)
  - Simulator has a voice picker (Valluvar / Pallavi) + "Edge neural · free" label
- Verified in Chrome: full happy path + opt-out path, **0 console errors** (fixed a hydration mismatch from the SSR-only `window` check).

### Completion checklist status
- [x] AI speaks Tamil/Tanglish script (simulator; live call pending)
- [x] AI can ask if it is a good time
- [x] AI can suggest repeat order (real data)
- [x] AI can take one correction
- [x] AI can read back final order
- [x] AI does not hallucinate badly (deterministic engine; live LLM agent gets the no-hallucination rules in the prompt)
- [ ] AI answers live call — phone number acquired (+918065355944), blocked on SnapServe/Vobiz provider integration

### Notes
- When the number is live: paste `LYRA_SYSTEM_PROMPT` into the SnapServe agent, point its tools at `tools.ts` schemas, then the `/voice` simulator becomes a reference for expected behavior.
- Fixed during verification: React hydration error #418 (mic-support flag computed from `window` at render) → moved to post-mount state.

---

## Phase 4 — Connect Voice to Database ✅ (2026-08-16)

### Goal (from Plan.md)
The AI must stop being a generic bot: identify the shop by phone, fetch last order, check credit/stock, and save the confirmed order + memory back to the database.

### API layer (portal/src/app/api/*, logic in `portal/src/lib/voice/backend.ts`)
- `GET /api/shop-context?phone=…` → identify shop by Caller ID (digits-normalized, matches 12-digit / 10-digit / +91), returns shop name, language, preferred call time, credit, blacklist, last order. `?shop_id=…` variant for direct lookup. Unknown phone → `404 shop_not_found`.
- `GET /api/suggested-order?shop_id=…` → repeat order from the most recent **real** order (confirmed/delivered/payment_pending/out_for_delivery, never drafts), plus missing categories + upsell candidate.
- `POST /api/check-stock` → availability vs requested qty incl. low-stock flag.
- `POST /api/check-credit` → `approved` / `extra_payment_needed` from the `shop_credit` view.
- `POST /api/create-order` → order header + line items + `call_logs` row + `shops.last_order_date` update (call log inserted **first** to satisfy `orders_call_id_fkey`); auto-generates `ORD`/`CALL` IDs matching the seed format.
- `POST /api/save-memory`, `POST /api/save-complaint`, `POST /api/mark-opt-out`.

### Simulator now runs on live data
- Start call = simulate Caller ID → `identify_shop_by_phone` → greets with the real shop name in the shop's language.
- Repeat-order suggestion comes from `/api/suggested-order` (real last order).
- Confirming the order calls `create_order` (order appears on the portal Orders page instantly) + `save_memory` (order-behaviour memory).
- Opt-out calls `mark_opt_out` (sets `opt_out=true`, `voice_consent=false`).
- New **Database trace** panel shows every API call with status + response summary.

### Verified in Chrome against live Supabase
- Kannan Stores (S101): identify by phone (credit ₹2,500, 2 blacklist items, last order 3 items) → repeat suggested from real ORD1019 → confirmed → **ORD1024 created (₹4,560, awaiting_confirmation)** → appears on Orders page (6 orders, ₹17,940) → memory auto-saved (AI Memory page shows it, 8 memories).
- Murugan Store (S102): opt-out at greeting → `mark_opt_out` → `opt_out=true / voice_consent=false` (restored after test).
- API curl checks: unknown phone → 404; check-stock (Surf Excel, 3 units, low stock); check-credit (₹4,200 > ₹2,500 available → extra ₹1,700); save-memory 201; save-complaint 201; mark-opt-out 200.
- `npm run lint` + `tsc` clean; 0 console errors.

### Notes
- Changes the shop speaks are captured in the transcript summary but are parsed into structured line items by the live LLM agent (Phase 9); the simulator creates the repeat-order base as-is.
- `nextNumericId` pads orders to 4 digits and call logs to 3 digits to match the seed (`ORD1019`, `CALL101`).

---

## Phase 5 — Business Rules ✅ (2026-08-16)

### Changes
- `backend.ts`: `checkBlacklist(shopId, productId)` — returns `is_blacklisted` + `reason` from the `blacklist` table.
- `backend.ts`: `getShopContext` now returns `is_within_call_time` (validates against `preferred_call_start`/`preferred_call_end`), `memories` (top 10 by confidence), and `active_schemes` (all active promotions).
- `backend.ts`: `getSuggestedOrder` now filters out blacklisted products from the repeat order before suggesting.
- `api/check-blacklist/route.ts` — new POST route.
- `api/schemes/route.ts` — new GET route for active promotions.
- `tools.ts` — `check_blacklist` tool schema now has `product_id` as required alongside `shop_id`.

---

## Phase 6 — WhatsApp Layer ✅ (2026-08-16)

### Changes
- `backend.ts`: `sendWhatsAppSummary(shopId, orderId)` — formats order summary message, marks `call_logs.whatsapp_sent = true`. Returns `message_preview` (no actual API call, simulated for demo).
- `api/send-whatsapp/route.ts` — new POST route.
- `client.ts`: `voiceApi.sendWhatsApp()` wrapper.

---

## Phase 7 — Memory + Blacklist ✅ (2026-08-16)

### Changes
- `getShopContext` now returns `memories[]` (memory_text, memory_type, confidence_score) — the live LLM agent can use these during calls.
- `getSuggestedOrder` filters blacklisted products out of the repeat order — the agent never suggests a product the shop has rejected.
- `client.ts`: `ShopContextPayload` updated to include `memories` and `active_schemes`.

---

## Phase 8 — Complaint / Return Flow ✅ (2026-08-16)

### Changes
- `backend.ts`: `createReturn(shopId, productId, quantity, reason, orderId?)` — inserts into `returns` table with auto-calculated `credit_note_amount` (price × quantity).
- `api/create-return/route.ts` — new POST route.
- `types.ts`: `VoiceState` expanded with `complaint`, `complaint_desc`, `return_product`, `return_qty`, `return_reason`.
- `engine.ts`: new states handle complaint detection → type → escalation, and return detection → product → qty → reason → confirm.
- `script.ts`: new templates for complaint flow, return flow, blacklist product message.
- `voice-simulator.tsx`: FLOW_STEPS updated to include complaint/return states; VoiceContext initialized with new fields.

---

## Phase 9 — Intent Expansion + Routing ✅ (2026-08-16)

### Changes
- `intents.ts`: `Intent` type expanded with `"complaint"` and `"return"`.
- `COMPLAINT_TOKENS` — Tanglish/Tamil/English tokens for complaints: damaged, wrong, late, broken, problem, issue, பிரச்சனை, சேதம்...
- `RETURN_TOKENS` — return/refund/exchange tokens: return, refund, edukka, thirupi, திரும்ப, மாற்று...
- `detectIntent` now checks complaint/return before change/yes/no (priority order: stop → complaint → return → change → yes → no).
- `prompt.ts` — system prompt updated with complaint/return flow instructions + new tools (create_return, get_schemes).

---

| Date | Update |
|---|---|
| 2026-08-16 | Phase 1 shipped to live Supabase. Phase 2 started. |
| 2026-08-16 | Phase 2 portal built + verified in Chrome against live data (build/lint clean). |
| 2026-08-16 | Product renamed **Vaniga-Mithran → Lyra** everywhere (docs, SQL comments, portal brand/metadata, system prompts). |
| 2026-08-16 | Phase 3 foundation: voice engine + Tanglish script + agent prompt + 9 tool schemas + browser call simulator at `/voice` (verified happy path + opt-out, 0 console errors). Live SnapServe number still pending. |
| 2026-08-16 | Voice quality fix: replaced `speechSynthesis` (no ta-IN on Windows → US-English "American Tamil") with **Edge TTS neural `ta-IN`** via new `POST /api/tts` route (Valluvar/Pallavi, free, no key); verified in browser. |
| 2026-08-16 | **Phase 4 shipped**: 8 voice API routes (shop-context, suggested-order, check-stock, check-credit, create-order, save-memory, save-complaint, mark-opt-out) + simulator wired to live Supabase — identify by Caller ID, repeat order from DB, order + memory persisted. Verified end-to-end in Chrome (ORD1024 visible on portal). |
| 2026-08-16 | Live phone number +918065355944 acquired and saved to `.env.local`. TTS research paused (Edge TTS kept as-is for now; Bhashini account setup deferred). |
| 2026-08-16 | **Phase 5-9 shipped**: business rules (check_blacklist, schemes, call-time validation), WhatsApp layer (simulated send + message formatting), memory recall in context, complaint/return engine flow + create-return API, expanded intent classifier with complaint/return detection. Lint + tsc clean. |
