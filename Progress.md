# Lyra 2.0 — Build Progress

**Product:** AI Order Co-Pilot for FMCG distributors (Shree Agencies demo)
**Phase:** 3 — Voice AI Foundation (foundation built; live phone number pending)
**Started:** 2026-08-16
**Status:** 🔨 Phase 3 in progress

---

## Phase Tracker

| Phase | Name | Status |
|---|---|---|
| 0 | Freeze the Scope | ✅ Done (docs only; no separate scope.md per user choice) |
| 1 | Build the Data Brain | ✅ Done — live on Supabase `mxjsnhbziewlpnsybbvq` |
| 2 | Build the Agency Portal | ✅ Done — live on http://localhost:3000 |
| 3 | Build the Voice AI Foundation | 🔨 In Progress — agent prompt + flow engine + browser simulator done; SnapServe/Vobiz live number pending |
| 4 | Connect Voice to Database | ⏳ Pending |
| 5 | Add Business Rules | ⏳ Pending |
| 6 | Add WhatsApp Layer | ⏳ Pending |
| 7 | Add Memory + Blacklist | ⏳ Pending |
| 8 | Add Complaint / Return Flow | ⏳ Pending |
| 9 | Split into Multi-Agent Squad | ⏳ Pending |
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

### Blocked pieces (need user)
- SnapServe account + Vobiz number + live phone number — **the only thing stopping the "AI answers a live call" checklist item.**

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
- [ ] AI answers live call — **blocked on SnapServe/Vobiz number**

### Notes
- When the number is live: paste `LYRA_SYSTEM_PROMPT` into the SnapServe agent, point its tools at `tools.ts` schemas, then the `/voice` simulator becomes a reference for expected behavior.
- Fixed during verification: React hydration error #418 (mic-support flag computed from `window` at render) → moved to post-mount state.

---

## Log

| Date | Update |
|---|---|
| 2026-08-16 | Phase 1 shipped to live Supabase. Phase 2 started. |
| 2026-08-16 | Phase 2 portal built + verified in Chrome against live data (build/lint clean). |
| 2026-08-16 | Product renamed **Vaniga-Mithran → Lyra** everywhere (docs, SQL comments, portal brand/metadata, system prompts). |
| 2026-08-16 | Phase 3 foundation: voice engine + Tanglish script + agent prompt + 9 tool schemas + browser call simulator at `/voice` (verified happy path + opt-out, 0 console errors). Live SnapServe number still pending. |
| 2026-08-16 | Voice quality fix: replaced `speechSynthesis` (no ta-IN on Windows → US-English "American Tamil") with **Edge TTS neural `ta-IN`** via new `POST /api/tts` route (Valluvar/Pallavi, free, no key); verified in browser. |
