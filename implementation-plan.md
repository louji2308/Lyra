# Lyra Multi-Agent Voice System + Portal — Implementation Plan (v2, rewritten from scratch)

**Scope:** Make the SnapServe 4-agent squad (`Reception → Order Taker ↔ Business Intelligence → Support`) work **end-to-end as a real MVP** for Shree Agencies — fast, reliable handoffs, agents that know both their own and each other's capabilities, natural in-language self-introductions, a receptionist that fully onboards/edits shops, an order assistant that places and posts orders, a read-only business-intelligence agent, and a support agent that logs everything into a per-shop "Today's details" view in the Lyra portal.

**Audience:** Whoever implements this (you, or an agent executing this plan). Read by both frontend (Next.js portal) and backend (Supabase + SnapServe) sides.

**Base URL for tools:** `https://lyra-gray.vercel.app` (production) / `http://localhost:3000` (dev).

---

## Table of Contents
1. [What exists today (verified)](#1-what-exists-today-verified)
2. [The core problems to solve (from your words)](#2-the-core-problems-to-solve)
3. [Target system design](#3-target-system-design)
4. [Database changes](#4-database-changes)
5. [Backend API / tool endpoints](#5-backend-api--tool-endpoints)
6. [Agent-by-agent redesign (prompts + tools)](#6-agent-by-agent-redesign)
7. [Handoff fix: speed, cutoffs, self-introductions, capability map](#7-handoff-fix)
8. [Portal changes (Receptionist, Orders, Today's details)](#8-portal-changes)
9. [Order lifecycle that satisfies your credit/UPI rules](#9-order-lifecycle)
10. [Implementation order + phases](#10-implementation-order--phases)
11. [Verification / test script](#11-verification--test-script)
12. [Acceptance criteria](#12-acceptance-criteria)
13. [Open questions to confirm with you](#13-open-questions)
14. [Additional suggestions beyond the plan](#14-additional-suggestions-beyond-the-plan)
15. [Beats & shop dataset (applied to live DB + seed)](#15-beats--shop-dataset-applied)

---

## 1. What exists today (verified)

I read the **live SnapServe** system (after you logged in) plus the entire repo. Here is the ground truth.

### Live SnapServe — Squad "Lyra FMCG Order Squad v3" (active, Squad ID 19)

| Role (squad) | Agent (SnapServe ID) | Phone | Handles | Current tools |
|---|---|---|---|---|
| Reception / Router | Lyra Reception - Tamil Order Routing (#797) | +918065355944, "receives handoffs" | Route to Order Taker / Support, identify shop | `identify_shop_by_phone` (**only one tool, no `create_shop`**) |
| Order Taker | Lyra Order Taker - Tamil FMCG Ordering (#799) | no number, "receives handoffs" | Take orders | `get_suggested_order`, `get_shop_context`, `check_stock`, `check_credit`, `create_order`, `send_whatsapp_summary` |
| Business Intelligence | Lyra Business Brain - Tamil FMCG Intelligence (#802) | no number, "receives handoffs" | Stock/credit/blacklist/schemes for orders | `check_stock`, `check_credit`, `check_blacklist`, `get_schemes` |
| Support / Complaints | Lyra Support - Complaints Returns Callback (#803) | no number, "receives handoffs" | Complaints, returns, opt-out, WhatsApp | `save_complaint`, `create_return`, `mark_opt_out`, `send_whatsapp_summary` |

Other squads that exist (students/duplicates, not the live one): "Lyra FMCG Order Squad", "…v2" (×2), and "…v3" (the live one, `#19`). There is also an older single-agent Lyra #733/#734.

### Current system prompts (verbatim, key excerpts)

- **Reception (#797):** "Your ONLY job is to: …2. Identify which shop they're from …4. Route them to the right specialist… AFTER IDENTIFYING SHOP: 'Kannan Stores aa?…' ROUTING: …order → say 'Order irukkaa? Sari, nga order sollunga.' (then transfer to Order Taker)… If unsure, route to human."
- **Order Taker (#799):** "You have been transferred from the reception agent. Your job: …Use get_suggested_order …check_stock …check_credit …create_order… If caller is angry or has complaint, transfer to Support agent."
- **Business Brain (#802):** "You speak ONLY in Tamil… You are NOT the order-taking agent… CAPABILITIES: 1. STOCK CHECK 2. CREDIT CHECK 3. BLACKLIST CHECK 4. SCHEME CHECK… HANDOFF PROTOCOL… ANGER/STOP → Support."
- **Support (#803):** heavily romanized-Tamil prompt; tools `save_complaint`, `create_return`, `mark_opt_out`, `send_whatsapp_summary`; "MUZHUVADHUM TAMIL-THAN."

### Squad handoff messages (configured in the squad)

- **Reception handoff announcement:** "One moment — I'm connecting you to a teammate who can help with this."
- **Order Taker receiving greeting:** **"Hi — I've been briefed on your conversation so far. How can I help?"** ← this is exactly the phrase you said you do **not** want.
- The **Business Intelligence** and **Support** receiving greetings are configured similarly (generic English), which is why they don't introduce themselves in the shop owner's language with their agent name.

### Verified from the live Handoff activity log
- Reception → Order Taker, Reception → Business Brain, Reception → Support, and Business Brain → Order Taker live handoffs all exist and are marked **completed**.
- ❗ **Live failures you described are corroborated:** there are two "Follow-up call" entries created by Order Taker → Support with text *"…Attempts to check stock and credit failed. Transfer to human agent and support failed. Please call back to resolve and place order."* This is the **support handoff cutoff / failure** you described.

### Verified portal (lyra-gray.vercel.app) state
- Dashboard `/` has KPIs, Revenue Summary, Shop Health, Urgent Actions, Today's Deliveries, Recent Activity. Nav: Dashboard, Shops, Orders, Operations, AI Co-Pilot, Catalog.
- `/orders` lists orders with status actions (confirm/cancel/schedule/deliver) and "Create Manual Order".
- `/shops/[id]` is a rich read-only 360° view.
- The DB already has tables: `routes, shops, products, inventory, schemes, call_logs, orders, order_items, shop_memory, blacklist, complaints, returns, payments, deliveries, delivery_items, stock_movements, order_status_log` and views `shop_credit, low_stock_products, shop_payment_ledger, delivery_summary`.

---

## 2. The core problems to solve (from your words)

Each of your bullets maps to a concrete artifact. I've grouped them so the plan is traceable.

| # | Your requirement (paraphrased) | Root cause today | Where it's fixed |
|---|---|---|---|
| 1 | Handoff between any agent ↔ Business agent is slow | Extra round-trips: Order Taker calls `get_shop_context`/`check_*` itself before handing to Business; squad transfer adds dead air; no shared in-memory cart | §7 (pre-fetch context, cart passed via squad shared memory, fewer hops) |
| 2 | Order Taker → Support handoff immediately cuts the call | Support's failed tool attempts + generic receiving greeting + the squad "Support receives from any agent" setup isn't robust; Order Taker had **Call Transfer to human** enabled which can drop the call | §7 + §6 (Support), §5 (robust endpoints) |
| 3 | Each agent should know what *other* agents can do | No shared capability contract in any prompt | §7 (Capability Map injected into every prompt) |
| 4 | Order taker should tell product **brands** when user asks "what products are there" | `get_suggested_order` only returns last order; no full-catalog listing is surfaced to the user with brand names | §6 Order Taker + §5 `list_products` tool |
| 5 | Handoff intro should be in shop owner's language, with agent name ("I am the business agent…"), NOT "I've been briefed on your conversation so far" | Squad receiving greetings are hardcoded generic English | §7 + per-agent self-intro prompts |
| 6 | Receptionist: create shops, **multiple phone numbers per shop**, edit shop details (only on confirm), gather details by asking, default **credit_limit 5000**, ask location/beat (able to list available beats), no editing of beat as routine | `shops.phone_number` is UNIQUE (single number); `createShop` defaults `credit_limit 5000` but always assigns route R001; `identify_shop_by_phone` only matches single phone | §4 (schema), §5 (endpoints + `list_beats`), §6 Reception, §8 |
| 7 | Order assistant: takes order, access all products, fast brand→price filter, get shop from phone (never ask), know price + godown stock, reduce stock on final confirm, order lands in today's orders page, WhatsApp to owner, tell credit-exceeded only after owner confirms (not per product), send UPI if exceeded, human updates credit → order confirmed+shows, else ask to remove items | `create_order` sets status directly; credit checked per-product by Order Taker; stock not decremented on confirm; no UPI send; no phone→shop derivation in Order Taker prompt | §4, §5, §6 Order Taker, §9 |
| 8 | Business Intelligence: read-only, entire shop credit history, previous deliveries + amount + products per date, get shop from phone, no order taking, has schemes | Business Brain is order-support only (check stock/credit for ORDER), not historical read-only analyst; no delivery-history aggregation endpoint | §6 Business, §5 new endpoints, §9 |
| 9 | Support Intelligence: on frustration/damage, write notes for anything unexpected (owner not available for delivery, etc.), surface in per-shop "Today's details" dashboard | No notes table; support only does complaints/returns/opt-out | §4, §5, §6 Support, §8 Today's details |
| 10 | Complete MVP, end-to-end | Many gaps above | whole plan |

---

## 3. Target system design

```
  Inbound / Outbound voice call
              │  (phone → Reception #797, then live squad handoffs)
              ▼
        ┌────────────────┐   identify_shop_by_phone → returns shop + ALL phones
        │  RECEPTION #797 │   create_shop (onboarding), add_shop_phone, update_shop
        └───────┬────────┘      (contains "what each agent can do" capability map)
        routes by intent │
   ┌────────────┼─────────────────┐
   ▼            ▼                  ▼
 Order Taker  Business Intel   Support
   #799          #802             #803
 take order     read-only       complaints, returns,
 build cart →   history &       opt-out, AND write
 create_order   schemes         today_notes; receive
 (PENDING;      (no order)      all anger/stop/damage
 human confirms)
   └─► shared squad memory (cart, shop context, language) flows through every handoff
   └─► order lands in portal "Today's Orders" only after payment/credit confirm (see §9)
```

**Key architectural shifts vs today:**
1. **Shared context via squad memory** — shop identity, language, cart, and last-order are fetched **once by Reception** and passed through. Agents **never re-ask** for shop/phone.
2. **Capability map** — every agent prompt contains a compact table of "Me / My teammates can do X, Y, Z", so an Order Taker knows the Business agent reads history and won't take orders, etc.
3. **Self-introduction on handoff** — every receiving agent starts by introducing itself **in the shop owner's detected language** using its agent name (e.g. Tamil: "Vanakkam! Naan business agent. …"), *never* "I've been briefed on your conversation so far."
4. **Order = two-step** — Order Assistant builds the cart; order becomes real (status `confirmed`, appears in Today's Orders, stock decremented) **only after** the owner confirms and credit/UPI is settled. Stock is *reserved* not decremented until final confirm.
5. **Today's details** — a per-shop note stream (`today_notes`) that Support writes to, surfaced on the portal dashboard per shop for the delivery day.

---

## 4. Database changes

Create a new migration **`supabase/migrations/20260829000000_multi_agent_mvp.sql`** (run it before deploying the new endpoints/portal).

### 4.1 Multiple phone numbers per shop (new table `shop_phones`)
```sql
CREATE TABLE public.shop_phones (
  phone_id     BIGSERIAL PRIMARY KEY,
  shop_id      TEXT NOT NULL REFERENCES public.shops(shop_id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label        TEXT,                 -- 'primary','whatsapp','alt','owner','delivery'
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, phone_number)
);
CREATE INDEX idx_shop_phones_shop   ON public.shop_phones (shop_id);
CREATE INDEX idx_shop_phones_number ON public.shop_phones (phone_number);
```
- Keep `shops.phone_number` as the primary number (back-compat), but **all lookups now use `shop_phones`** so any registered number resolves to the shop.
- `identify_shop_by_phone` matches against `shops.phone_number` **and** `shop_phones.phone_number`.
- Add one optional `shops` column for onboarding (idempotent ALTER). The beat is already stored as the existing `beat_route_id` (→ `routes`); no new beat columns:
```sql
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS business_type TEXT;  -- optional, gathered during onboarding
```

### 4.2 Today's details / support notes (new table `today_notes`)
This is what makes "show it in the today's details dashboard for each shop" possible, including the **unexpected things** Support writes (owner not available, delivery delay, etc.).
```sql
CREATE TABLE public.today_notes (
  note_id     BIGSERIAL PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES public.shops(shop_id) ON DELETE CASCADE,
  note_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  note_type   TEXT NOT NULL DEFAULT 'general', -- 'general','delivery-exception','owner-unavailable','damage','callback','other'
  note_text   TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'AI',   -- 'AI' or 'human'
  agent_role  TEXT,                          -- 'reception','order_taker','business','support'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_today_notes_shop ON public.today_notes (shop_id);
CREATE INDEX idx_today_notes_date ON public.today_notes (note_date);
```

### 4.3 Order lifecycle support
- Add a column to mark the reservation→confirmation flow, plus a `pending` capability that snapshots the credit/UPI state until a **human** confirms the order:
```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmed_order BOOLEAN NOT NULL DEFAULT FALSE,  -- becomes Today's-visible / "confirmed" when TRUE
  ADD COLUMN IF NOT EXISTS credit_checked  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_reason  TEXT;                            -- e.g. 'over_credit','payment_pending','human_confirm'
```
- Confirmed-vs-pending rule (locked to your flow): an order is **pending** (default) after the owner confirms the cart and it exceeds credit. It only becomes **confirmed** (`confirmed_order=TRUE`, decrement stock, appear in Today's Orders) once the **human records the payment** in the portal. Until the human confirms, it stays in the **pending** category.
- `inventory` already has `reserved_qty`. Use it for the "reserve on build, decrement on final human confirm" flow.

### 4.4 UPI / payment configuration
The **Shree Agencies (Lyra) collection UPI ID** is a single constant for the whole app:
```
LYRA_COLLECTION_UPI_ID = "9042113132@fam"
```
- No per-shop UPI needed (the owner pays **Lyra's** UPI, not their own). Hard-code it where `send_payment_upi` is used, or add a small `app_config` KV table if you ever want to change it without redeploying.

### 4.5 RLS
Append the new tables (`shop_phones`, `today_notes`) to the permissive anon policies (same pattern as existing migrations) so the portal and tools keep working.

---

## 5. Backend API / tool endpoints

All endpoints live in `portal/src/app/api/...` and call functions in `portal/src/lib/voice/backend.ts` (extend that file; keep the existing `parseBody` pattern for POSTs). Each becomes a SnapServe **Mid-call HTTP** tool.

### New / changed endpoints

| Tool (SnapServe name) | HTTP | Path | Purpose |
|---|---|---|---|
| `identify_shop_by_phone` | POST | `/api/shop-context` | Resolve **any** phone (shops + shop_phones) → `{shop_id, shop_name, owner, all_phones, language, credit}`; returns 404 `shop_not_found` vs `new_shop` |
| `create_shop` | POST | `/api/create-shop` | Onboard new shop; **defaults** `credit_limit=5000`, `outstanding=0`; **assigns the beat/route ONLY after the owner confirms** the read-back (the chosen `beat_route_id` comes from the owner, never auto-assigned); creates `shop_phones` primary |
| `list_beats` | GET  | `/api/list-beats` | Read-only list of active beats/routes (route_id, route_name, area) so Reception can tell the owner "what beats are available" and record their beat |
| `add_shop_phone` | POST | `/api/add-shop-phone` | Reception adds another phone to existing shop |
| `update_shop` | POST | `/api/update-shop` | Edit shop details; **returns draft to confirm first**; applies only when `confirmed=true` |
| `list_products` | POST | `/api/list-products` | Full catalog with **brand, price, category, stock**; support filters, and a "report brand names" shape when user asks what's available |
| `search_catalog` | POST | `/api/search-catalog` | Fast free-text search (for "i need pepsodent 10rs") |
| `find_product_by_brand_price` | POST | `/api/products-list` (extend) | Exact brand → price filter for fast order entry |
| `check_stock` | POST | `/api/check-stock` | availability + available_qty + reserved_qty |
| `check_credit` | POST | `/api/check-credit` | shop credit vs order total → `approved, extra_payment_needed` |
| `reserve_stock` | POST | `/api/reserve-stock` | increment `inventory.reserved_qty` while building the cart (undoable) |
| `create_order` | POST | `/api/create-order` | persist order draft (status `pending`/`awaiting_confirmation`, `confirmed_order=FALSE`); **no stock decrement yet** |
| `confirm_order` | POST | `/api/confirm-order` | **human-triggered** final confirm: status `confirmed`, `confirmed_order=TRUE`, decrement inventory, add `stock_movements`, then send WhatsApp to owner |
| `send_whatsapp_summary` | POST | `/api/send-whatsapp` | order summary to shop's WhatsApp |
| `send_payment_upi` | POST | `/api/whatsapp/payment` (exists) | when credit exceeded: sends the owner a WhatsApp with the **order total + credit details + Lyra's collection UPI `9042113132@fam`** so they can pay; order stays **pending** |
| `get_shop_credit_history` | POST | `/api/shop-credit-history` | **read-only**: payments, orders delivered, returns, running balance (Business Intelligence) |
| `get_shop_delivery_history` | POST | `/api/shop-delivery-history` | **read-only**: delivered orders with per-item products/quantities/amounts, per date (Business Intelligence) |
| `get_schemes` | POST | `/api/schemes` (exists) | active schemes for the shop (Business Intelligence, informational only) |
| `save_complaint` | POST | `/api/save-complaint` (exists) | support |
| `create_return` | POST | `/api/create-return` (exists) | support |
| `mark_opt_out` | POST | `/api/mark-opt-out` (exists) | support |
| `write_today_note` | POST | `/api/write-today-note` | **NEW**: Support writes any unexpected/notable thing to that shop's Today's-details stream |
| `get_today_details` | GET  | `/api/today-details` | Portal reads per-shop Today's notes + today's orders/deliveries |

> **Guideline:** every endpoint returns `language_detected` passthrough and a short `tts` hint, so agents can speak the shop owner's language. Keep endpoints idempotent where possible (they get retried by SnapServe on flaky calls — a likely cause of the "failed" handoffs).

---

## 6. Agent-by-agent redesign (prompts + tools)

### 6.1 Shared "Capability Map" block (inject into ALL 4 prompts)
Add a compact, consistent block so every agent knows **its own** and every **teammate's** abilities. Example (then localize the spoken parts):

```
TEAM CAPABILITIES (who can do what):
• Reception/Router (Lyra Reception): identify shop from phone, create a NEW shop,
  add/edit phone numbers, update shop details (after confirmation). Routes to
  Order Taker/Business/Support. Does NOT take orders.
• Order Taker (Lyra Order Assistant): takes the order, lists all products with BRANDS and prices,
  filters by brand→price, checks godown stock, places the order, sends WhatsApp. Knows the shop
  from the phone — never asks for shop id / phone / name.
• Business Intelligence (Lyra Business Agent): READ-ONLY. Credit history, previous deliveries
  (amount + products per date), schemes. Does NOT take orders, does NOT edit anything.
• Support (Lyra Support Agent): complaints, damaged goods, returns, opt-out, and writes notes
  for anything unexpected (e.g. owner not available for delivery). Receives all anger/stop/damage.

HANDOFF RULES: order → Order Taker; history/credit/schemes question → Business; complaint/
anger/damage/return → Support. Always hand back cleanly; on handoff, introduce yourself in the
caller's language (see SELF-INTRODUCTION below).
```

### 6.2 Hard-fix the self-introduction (applies to Reception, Order Taker, Business, Support)

**Step 1 — Handoff reason (the "small query").** Every handoff passes the **reason/query** along with the shop context (projected into the receiving agent's context), so the receiving agent already knows *why* it was handed the call and **never asks "enna venum?" / "how can I help?" again**. Format passed into the receiving prompt:

```
HANDOFF REASON (this is why you received this call):
<one-line description of the open task or question from the caller>
SHOP CONTEXT: <shop_id, shop_name, owner, language, all_phones, credit, pending order/cart if any>
```

The receiving agent should **address the handoff reason first**, introduce itself briefly, then continue — it must not re-open a generic "what do you need?"

**Step 2 — Self-introduction wording.** Replace the generic squad receiving greeting ("I've been briefed on your conversation so far") with a language-aware intro driven by the **detected shop language** + **agent name**. Brand = **Shree Agencies**, agent brand = **Lyra**. Drop the old "Enna venum?" closing; instead acknowledge the handoff reason:

```
SELF-INTRODUCTION (say when you start after a handoff, in the CALLER'S language):
- Tamil/Tanglish: "Vanakkam! Naan Lyra… Shree Agencies oda business assistant. <acknowledge reason>."
- Order Assistant self-intro: "Vanakkam! Naan Lyra… Shree Agencies oda order assistant. <acknowledge reason>."
- Reception self-intro: "Vanakkam! Naan Lyra, Shree Agencies oda reception. <acknowledge reason>."
- Support self-intro: "Vanakkam! Naan Lyra… Shree Agencies oda support assistant. <acknowledge reason>."
- Hindi: "Namaste! Main Lyra… Shree Agencies ka business assistant…" / "...order assistant…"
- English: "Hello! I'm Lyra, the business assistant from Shree Agencies…" / "...order assistant…"
Use the caller's language (language_detected / shop.preferred_language). NEVER say
"I've been briefed on your conversation so far" or "you have been transferred".
Address the caller by owner/shop name once known: "Kannan Stores, Vanakkam!"
```
Keep the agent names fixed to what you chose: **Reception**, **Order Assistant**, **Business Assistant** (spoken as "business assistant"), **Support Assistant**.

### 6.3 Reception / Router (#797) — new prompt + tools

**Tools to add (SnapServe):** `create_shop`, `add_shop_phone`, `update_shop`, `list_beats` (tool endpoints in §5). Keep `identify_shop_by_phone`.

**Behavioral rules to encode in the prompt:**
1. `identify_shop_by_phone` first. If it returns `new_shop`/404 → treat as **onboarding**.
2. **Onboarding (create a new shop)** — ask, one field at a time:
   - Shop name, owner name, preferred language, call window (preferred call start/end).
   - **Ask for the shop's location / area, OR directly ask which beat it falls under.** The receptionist knows the beats (from the pre-loaded `routes` table) and can name them. If the owner asks **"what beats are available?"**, call `list_beats` and read out the beat names (the 5 area-based beats, e.g. Tambaram Main, Chromepet, Pallavaram, Guduvancheri, Tiruporur). The owner picks their beat.
   - **Do NOT ask for credit limit** → hard-code default `credit_limit = 5000` on the backend.
   - **Confirm-with-owner rule:** after gathering, **read back ALL details — including the chosen beat/route — and ask the owner to confirm**. Only call `create_shop` on the owner's confirmation, and pass the owner-confirmed `beat_route_id`. **Never auto-assign a route/beat; do not create the shop (or set its beat) until the owner has confirmed it.**
3. **Existing shop:** allow "add a phone number", or "update my details" → gather new details, **read back, confirm**, then `update_shop`.
4. Route per intent to Order Taker (order), Business (history/credit/schemes), Support (complaint/anger). Always pass the **handoff reason** (§6.2) so the receiving agent doesn't ask "enna venum?" again.

### 6.4 Order Taker / Order Assistant (#799) — new prompt + tools

**Tools to add:** `list_products`, `search_catalog`, `find_product_by_brand_price`, `reserve_stock`, `send_payment_upi`. Keep `get_suggested_order`, `check_stock`, `check_credit`, `create_order`, `send_whatsapp_summary`. (`confirm_order` is **human-triggered** in the portal, not called by the agent.)

**Behavioral rules to encode:**
1. **Never ask for shop id / phone / shop name** — you already know it from the phone via the shared context Reception set. (Take it from `identify_shop_by_phone` result passed through squad memory.)
2. **"What products are available?"** → call `list_products` and **report by BRAND** (e.g. "Personal care: Clinic Plus, Lifebuoy, Lux…; Oral care: Pepsodent, Colgate…"), with prices.
3. **Fast order entry "i need pepsodent 10rs 12 pieces"** → call `find_product_by_brand_price` (brand=Pepsodent, price≈10) → resolve product → `reserve_stock` → add to cart. Filter order: **brand → price → then quantity**. Do not make the caller repeat themselves.
4. **Know price + godown stock** for every product (from `list_products`/`check_stock`). If requested qty > available, say the current godown stock and offer the max.
5. **Credit / payment (your exact flow):** build the whole cart first. **After the owner confirms the final read-back**, call `check_credit`.
   - If **within limit** → `create_order` (status **pending** in the portal until a human confirms) → tell the owner the order is placed. The **human then confirms** it in the portal (→ becomes `confirmed_order=TRUE`, appears in Today's Orders, stock decremented, WhatsApp sent). The agent does not force the confirm.
   - If **exceeds** → tell the owner the order amount vs available credit **once** (not per product), then `send_payment_upi` — a WhatsApp to the owner with the **order total + credit details + Lyra's collection UPI `9042113132@fam`** so they can pay. The order stays **pending**. Once the owner pays, the **human records the payment and confirms the order** in the portal. Meanwhile **offer to remove some products** to fit the credit limit if the owner prefers.
6. Stock is decremented **only on human `confirm_order`**, never by the agent and never on `create_order`.
7. On anger/stop/damage → Support. On a history/credit question → Business. Pass the **handoff reason** (§6.2) with every handoff.

### 6.5 Business Intelligence (#802) — new prompt + tools (read-only analyst, "business assistant")

**Tools to add (remove order-taking capability):** `get_shop_credit_history`, `get_shop_delivery_history`, `get_schemes`, `get_shop_context` (to learn shop from phone). Keep `check_stock`/`check_credit` only for answering standing questions, **but never to place an order**.

**Behavioral rules:**
1. **READ-ONLY** — "You read the database, you do **not** edit, **do not** take or place orders. Direct any ordering to the Order Taker / Order Assistant."
2. Knows the shop from the phone (shared context); **never asks for phone / shop id / shop name**.
3. Answers:
   - Credit: current limit, outstanding, available, payment history.
   - Previous deliveries: per date, amount, and which products/quantities were delivered.
   - Returns/damage history for the shop.
   - Schemes/discounts on offer (informational; "if you want, the Order Assistant can place the order").
4. Speak in the caller's language (currently hard-forced Tamil — **change to follow the shop owner's `preferred_language`/`language_detected`**).
5. Self-introduces per §6.2 as **"Shree Agencies oda business assistant"** and addresses the incoming **handoff reason** first.

### 6.6 Support / Complaints (#803) — new prompt + tools

**Tools to add:** `write_today_note`. Keep `save_complaint`, `create_return`, `mark_opt_out`, `send_whatsapp_summary`.

**Behavioral rules:**
1. Appears on **frustration/anger, damaged goods, returns, opt-out** (as Reception/Order/Business route to it).
2. Handles all of the above with empathy; **language-aware** (fix the current strict-Tamil wording → follow the caller's language). Self-introduces per §6.2 as **"Shree Agencies oda support assistant"** and addresses the incoming **handoff reason** first.
3. **Write today notes** for anything unexpected — e.g. "owner not available for the delivery window today", "expects delivery morning", "wants callback at 5pm". Every such note goes to `write_today_note` so it shows in the shop's **Today's details** view in the portal.
4. Receives and hands off exactly like the other agents — **support uses the same squad handoff, no separate phone number** (same handoff mechanism as the rest). Resolves the issue, then hands back to Order Taker if an order is pending, else closes politely. Keep `end_call` graceful; do **not** route through a broken external human call-transfer that drops the line.

---

## 7. Handoff fix (speed, cutoffs, self-intro, capability map)

Root causes and the concrete fixes (these are the highest-value changes):

### 7.1 Speed (any agent ↔ Business)
- **Pre-fetch context once.** Reception calls `identify_shop_by_phone` and stores `{shop_id, shop_name, owner, language, all_phones, credit, pending order/cart if any}` in **squad shared memory** so Order Taker/Business/Support never re-fetch or re-ask.
- **Fewer hops.** Keep logic in the agent that has the data: Order Taker can call `check_*` directly; only hand to Business when the caller asks a *business question*. Only cross to Support on anger/stop/damage.
- **Pass the handoff reason (§6.2).** Every handoff includes the one-line reason so the receiving agent addresses it immediately and never re-asks "enna venum?".
- **Short pre-call messages** ("Oru nimisham…") so the model speaks before the tool returns — less dead air.
- **Idempotent, retry-safe endpoints** so a flaky HTTP call doesn't make the agent give up mid-handoff.

### 7.2 Cutoffs (especially Order Taker → Support)
- **Remove the human Call-Transfer action from Order Taker** (it's the likely cause of the dropped line — confirmed in the live "Transfer to human agent and support failed" notes). Use **squad live handoff** to Support instead of "transfer to human number".
- **Support uses the same handoff as every other agent — there is NO separate phone number for Support** (same mechanism as Order Taker / Business).
- Make Support's endpoints retry-able and non-throwing.

### 7.3 Self-introduction
Replace the squad receiving greetings (see §6.2). Each agent introduces itself with **"Vanakkam! Naan Lyra… Shree Agencies oda <role> assistant"** in the shop owner's language. This directly removes the "hi I've been transferred with your conversation" turn your users dislike.

### 7.4 Capability map
Inject the §6.1 block into **all four** prompts so every agent knows its own and others' abilities. Make this **strict**: no agent may do another agent's job, and every agent knows exactly which teammate can do what.

### 7.5 Reconfigure the live squad in SnapServe
- Squad v3 → set each agent's **receiving greeting** to empty (so the model's own language-aware self-intro + handoff reason are used) OR to the localized line.
- Enable **End Call** and **disable human Call Transfer everywhere** except where truly intended — anger/stop/damage routes to Support via squad handoff, not an external number.
- **Order Taker / Business / Support all use the same squad handoff — no extra number for Support.**
- Confirm `Share what it knows` (squad shared memory, including the handoff reason) is ON in v3.

---

## 8. Portal changes (Receptionist, Orders, Today's details)

### 8.1 Orders — Pending / Today's Orders filter
- `/orders`: add a **"Pending"** tab that shows orders with `confirmed_order = FALSE` (the ones awaiting human confirmation / payment), and a **"Today"** tab that shows orders with `order_date = today` **and** `confirmed_order = TRUE` (per §9 they only appear once a human confirms). Highlight the payment/credit reason on pending rows.
- Add a **"Confirm"** action on a pending order (the human step that flips `confirmed_order=TRUE` and decrements stock).

### 8.2 Shop record / shop detail
- `/shops` and `/shops/[id]`: expose the **multiple phone numbers** (`shop_phones`) with "Add phone number" (Reception on the voice side calls the API; a human can also add here).
- Show `credit_limit` (default 5000 at creation) and call window.
- "Edit" flow stays **confirm-first** like the Reception prompt.

### 8.3 Today's details (per shop) — NEW panel
- On `/` dashboard and `/shops/[id]`, add a **"Today's details"** section per shop showing:
  - Today's orders (confirmed) + their items/totals.
  - Today's deliveries (from `today_notes`/`delivery_summary` for today).
  - **Today_notes stream** — anything Support wrote (owner unavailable for delivery, delivery-exception, damage, callback, etc.), with type badge + timestamp + source.
- Backing query in `src/lib/data.ts`: `getTodayDetails(shopId)` → reads `today_notes(note_date=today)` + today's orders + today's deliveries.
- Human can also add/clear a note.

---

## 9. Order lifecycle (satisfies your credit / UPI rules)

This is the flow the Order Assistant follows; implement it in `backend.ts` and the portal:

```
1. Build cart (reserve_stock for each line; no decrement).
2. Read back full order + total.
3. Owner CONFIRMS the order → check_credit ONCE (whole order).
4. If within credit limit:
     create_order (status PENDING, confirmed_order=FALSE)
     → order appears in the portal's PENDING list (not yet in Today's Orders)
     → HUMAN confirms in the portal → status confirmed, confirmed_order=TRUE,
       inventory DECREMENT, stock_movements
       → shows in Today's Orders → send_whatsapp_summary (owner's number)
   Else (credit exceeded):
     → tell owner amount vs available (ONCE)
     → send_payment_upi: WhatsApp to owner with order total + credit details
       + LYRA COLLECTION UPI "9042113132@fam" (Shree Agencies' collection UPI)
     → "order will be confirmed once the office records your payment"
     → order stays PENDING and is NOT shown as confirmed in Today's Orders
     → if owner prefers: offer to REMOVE some products to fit credit
        → go back to step 2 with updated cart
5. HUMAN step (portal): after the owner pays to 9042113132@fam, a human records
   the payment (portal /payments or shop credit page) → payments table →
   outstanding_balance drops → order becomes confirmed_order=TRUE → appears in
   Today's Orders. Until this human confirmation, the order stays PENDING.
```

**Collection UPI (constant):** `9042113132@fam` — this is **Shree Agencies' own UPI ID** that the owner pays *into*. It is not per-shop; it is a single app-wide constant (§4.4).

Why this satisfies your asks: credit is checked **only after** the owner confirms (no per-product "wait I'll check your credit…"), the order is **finalised only after a human confirms in the portal** (so it stays **pending** until then), the UPI **`9042113132@fam` together with the credit details** is sent to the owner when credit is exceeded, and only after the human records the payment does the order land in Today's Orders; otherwise we offer to remove products to fit the limit.

---

## 10. Implementation order + phases

Do these in order; each phase is independently testable.

### Phase A — Database (foundation)
1. Write & run `20260829000000_multi_agent_mvp.sql` (`shop_phones`, `today_notes`, shop columns, order columns, RLS).
2. Backfill `shop_phones` from existing `shops.phone_number`.

### Phase B — Backend functions + endpoints
3. Extend `backend.ts`: `identifyShopByAnyPhone`, `createShop` (default 5000 credit + chosen beat, phones), `addShopPhone`, `updateShop` (confirm-first), `listBeats`, `findProductByBrandPrice`, `reserveStock`, `confirmOrder` (human-triggered: decrement+stock_movements+whatsapp), `getShopCreditHistory`, `getShopDeliveryHistory`, `writeTodayNote`, `getTodayDetails`, plus the **`LYRA_COLLECTION_UPI_ID = "9042113132@fam"`** constant used by `send_payment_upi`.
4. Add/extend the API routes in `portal/src/app/api/...` (§5) using `parseBody`; add the **`/api/list-beats`** route (GET) that returns the active beats.
5. Verify each endpoint with curl/powershell against localhost + lyra-gray.

### Phase C — SnapServe agents (prompts + tools)
6. Update Reception, Order Taker, Business, Support prompts with §6 capability map + language-aware self-intro + role rules + the **handoff-reason** behavior.
7. Add the new tools to each agent; point at lyra-gray endpoints.
8. Reconfigure squad v3: remove generic receiving greetings, enable End Call, disable human Call Transfer everywhere, ensure shared memory ON (all agents hand off the same way — **no separate number for Support**).

### Phase D — Portal
9. Orders "Today" + "Pending" tabs, `confirmed_order` gating, and the human **Confirm** action on pending orders.
10. shop_phones UI (list + add) on `/shops` & `/shops/[id]`.
11. Today's details panel on `/` and `/shops/[id]` with today_notes stream.

### Phase E — End-to-end test + tune
12. Run the §11 test script; tune latency/self-intro/wording.

---

## 11. Verification / test script

Run a real call (or Live test) and a portal check for each scenario:

1. **Onboarding:** unknown phone → Reception greets, gathers name/owner/language/call-window, **asks location or beat** (and can list available beats with `list_beats`), does **not** ask credit, reads back, confirms → creates shop with `credit_limit=5000` + chosen beat + primary phone. (Check DB.)
2. **Identify by any phone:** call from a secondary `shop_phones` number → correct shop resolved, no re-asking.
3. **Add phone / edit shop:** Reception edits details, confirms before applying.
4. **Brands listing:** "what products are available?" → Order Taker reports **brands**.
5. **Fast order:** "i need pepsodent 10rs 12 pieces" → resolves brand→price→qty without repeating.
6. **Order within credit:** owner confirms → order created in **PENDING**; human confirms in portal → appears in Today's Orders, stock decremented, WhatsApp sent.
7. **Order over credit:** owner confirms → told once, **UPI `9042113132@fam` + credit details** sent on WhatsApp, order stays **PENDING** (not on Today's Orders); after human records payment + confirms → appears; else offer to remove items.
8. **Business read-only:** "what's the shop's payment history / last week's delivery / products" → Business answers from history, takes no order.
9. **Support + note:** "damaged/not available for delivery" → Support empathetic, writes a `today_note`; note appears in shop's Today's details in portal.
10. **Handoff health:** run Reception→Order→Business→Order→Support and back; confirm **no cutoff**, each agent self-introduces (**"Vanakkam! Naan Lyra… Shree Agencies oda <role> assistant"** in the shop's language) and addresses the **handoff reason** first — never "enna venum?" again, < ~1.5s dead air.

---

## 12. Acceptance criteria

- [ ] Any phone number (primary or added) resolves a shop; unknown → clean onboarding.
- [ ] New shops get `credit_limit=5000` (never asked) + call window + **owner-chosen beat** — the beat/route is **never auto-assigned**; it is recorded only after the owner confirms the full read-back.
- [ ] Shop edits are confirm-first.
- [ ] Order Taker lists products **by brand** and takes fast brand→price orders without re-asking.
- [ ] Credit is checked **once after owner confirmation**; on exceed the owner gets **UPI `9042113132@fam` + credit details**; the order stays **PENDING** until a **human confirms** it in the portal (then it appears in Today's Orders); stock decremented only on that human confirm.
- [ ] Business agent is **read-only** (credit + delivery history + schemes), never takes/places orders, knows shop from phone.
- [ ] Support handles anger/damage, writes `today_notes`, and its handoffs never cut the call — handed off exactly like the other agents (no separate number).
- [ ] Every agent self-introduces in the **shop owner's language** as **"Lyra… Shree Agencies oda <role> assistant"** — never "I've been briefed on your conversation so far".
- [ ] Every handoff passes a **handoff reason**; the receiving agent addresses it first and never asks "enna venum?" / "how can I help?" generically.
- [ ] Every agent knows each teammate's capabilities (capability map injected); no agent does another's job.
- [ ] Portal: **Pending** + **Today's Orders** tabs (with human Confirm action), shop_phones, Today's details per shop (orders + deliveries + notes).
- [ ] End-to-end happy path and all §11 scenarios pass.

---

## 13. Decided details (answers you've given, locked into the plan)

The following were open during planning but are now **decided**. The plan above already reflects them:

1. **UPI:** Lyra (Shree Agencies) sends its own collection UPI **`9042113132@fam`** to the shop owner along with the credit details. Fixed app-wide constant `LYRA_COLLECTION_UPI_ID = "9042113132@fam"` (§4.4). No per-shop UPI.
2. **Payment → human confirmation:** once the owner pays, the **human confirms the order in the portal**; until then the order stays **pending** (never in Today's Orders, stock not decremented). Agent never confirms — human only (§9, §8.1).
3. **Beats (data, not delivery-schedule):** 5 beats/routes exist as **data** (see §15) — Reception asks the shop's location/area or directly its beat, and can list available beats to the owner via `list_beats`. There is no per-shop delivery-day/time (no `beat_day`/`beat_time` columns); the beat is just the route the shop belongs to (`beat_route_id`).
4. **Agent names (kept):** Reception, **Order Assistant**, **Business Assistant**, **Support Assistant**. Use the same names you set — do not rename.
5. **Self-intro wording / brand:** language-aware, brand = Shree Agencies, agent brand = Lyra — e.g. Tamil "Vanakkam! Naan Lyra… Shree Agencies oda order assistant", "…business assistant", "…support assistant" (§6.2).
6. **Handoff with the reason (small query):** every handoff passes the **one-line handoff reason** so the receiving agent addresses it first and **never asks "enna venum?" / "how can I help?"** again (§6.2, §7.1).
7. **Strict capability map:** every agent must know exactly what each other agent can and cannot do, injected into all four prompts (§6.1, §7.4).
8. **Support handoff = same as others:** Support has **no separate phone number**; it is handed off to exactly like Order Taker / Business (§7.2, §7.5).

Only one item still needs your confirmation (it changes an endpoint): **should the read-only Business Assistant still answer "is X in stock right now?"** as a read-only standing question, or is stock only ever checked by the Order Assistant during an order? *(Assumption: Business may answer read-only standing stock/credit/scheme questions but never place orders.)*

---

## 14. Additional suggestions beyond the plan

These are improvements that materially increase the odds the MVP works reliably on the first real call. They are complementary to (and partly folded into) the sections above.

1. **Disable the human "Call Transfer" action (all agents).**
   The dropped call happened on a *human call-transfer*, not a squad handoff (the live log recorded *"Transfer to human agent and support failed"*). Route all handoffs (including to Support) through **squad live-handoff**, and disable the external/`transfer to human` action everywhere it isn't strictly required, so a line is never dropped onto an external number. Support has no separate number — this is the same as every other handoff.

2. **Clear/replace the squad-level receiving greetings (all agents).**
   The greeting *"I've been briefed on your conversation so far. How can I help?"* is configured at the **squad level**, not in the per-agent prompts. Leaving it in place works against the language-aware self-intro in §6.2. Set each agent's receiving greeting to empty (or to the localized line) so the model's own self-introduction + handoff reason are used.

3. **Make every tool endpoint idempotent and non-throwing.**
   The failed handoff notes also said *"Attempts to check stock and credit failed."* SnapServe retries flaky HTTP calls and **aborts the handoff if a tool call hard-fails**. Wrap tool handlers so they return a structured `{ok:false, reason}` instead of throwing, and make writes retry-safe (unique keys / upserts). This removes a whole class of mid-call cutoffs.

4. **Remove the Business Brain's Tamil-only lock.**
   Its current prompt hard-forces **"You speak ONLY in Tamil."** That must follow the shop owner's detected / preferred language (Tanglish, Hindi, English), the same as the other agents — otherwise a Hindi or English-speaking owner gets a mismatched experience after handoff.

5. **Reserve stock during cart build; decrement only on human confirm.**
   Use `inventory.reserved_qty` (already in the schema) while the Order Assistant builds the cart, and decrement `available_qty` only on the human's `confirm_order` step. This prevents two concurrent calls from over-selling, and lets us safely undo a cart without losing inventory.

6. **Validate handoff latency and the handoff reason on every test call.**
   Use the squad "share what it knows" (shared memory) for shop context + cart + language + the **handoff reason**, so agents never re-fetch, never re-ask "enna venum?", and always address the incoming reason first. Target < ~1.5s of dead air per handoff; tune pre-call phrases ("Oru nimisham…") to speak before tool returns.

7. **Keep a release discipline.**
   Ship the DB migration and portal endpoints first (§§4–5), then the SnapServe prompt/tool changes (§6), then reconfigure the squad (§7.5). Don't reconfigure live squad v3 until the endpoints are verified, so a broken tool change doesn't hit real calls.

---

## 15. Beats & shop dataset (applied)

Applied to BOTH the live DB (lyra-gray) and `supabase/seed.sql`. Verified live: **5 routes, 30 shops, exactly 6 shops per beat, all 30 names unique, all 30 phone numbers unique.**

### The 5 beats
| Route | Name | Salesperson | Area |
|---|---|---|---|
| R001 | Tambaram Main Beat | Rajesh Kumar | Tambaram, Chennai |
| R002 | Chromepet Beat | Kumaravel | Chromepet, Chennai |
| R003 | Pallavaram Beat | Santhosh | Pallavaram, Chennai |
| R004 | Guduvancheri Beat | Manikandan | Guduvancheri, Chennai |
| R005 | Tiruporur Beat | Praveen | Tiruporur, Chennai |

### Shops per beat (6 each, all names/phones unique)
- **R001 Tambaram Main:** S101 Kannan Stores, S102 Murugan Store, S103 Shanthi General Store, S110 Rajesh Kirana Stores, S111 Meena General Stores, S112 Raja Provision Stores
- **R002 Chromepet:** S104 Lakshmi Traders, S105 Anand Provision Store, S120 Selvam Super Market, S121 Srinivasa Stores, S122 Annapoorna Provision, S123 Ganesh Kirana
- **R003 Pallavaram:** S907 QA Alpha Supermarket, S920 Vel Murugan Stores, S130 Lakshmi Kirana, S131 Valluvar Stores, S132 Sundaram Traders, S133 Anbu Kirana
- **R004 Guduvancheri:** S090 Sri Murugan Provision, S140 Kannagi Stores, S141 Murugesan Kirana, S142 Mani Provision Store, S143 Rani General Store, S144 Sri Renga Stores
- **R005 Tiruporur:** S439 Karthik Provision, S150 Kumar Traders, S151 Sangeetha Provision, S152 Kumaran Kirana, S153 Meenakshi Stores, S154 Venkatesh Supply Stores

> Note: the three old test entries were renamed — S920 "Test Kirana Store"→**Vel Murugan Stores**, S090 "Test Shop 2"→**Sri Murugan Provision**, S439 "New shop"→**Karthik Provision**. S907 keeps its name (referenced by the QA e2e docs).

### The shop-identity rule (critical) — resolve by `shop_id`, never `shop_name`
Even though every shop name is already unique, the agents must **always** resolve a shop from the **phone number → `shop_id`** and use that `shop_id` for every subsequent call (`get_shop_context`, `check_stock`, `check_credit`, `create_order`, etc.). This makes it impossible for an agent to confuse two shops — including two that could share a name across beats. Concretely:
- `identifyShopByPhone` (`portal/src/lib/voice/backend.ts:231`) already matches **phone only** and returns `shop_id` — keep it that way; never add shop_name matching.
- In every agent prompt, encode: *"You identify the shop ONLY by phone number → `shop_id`. Never look up a shop by its name. Use the returned `shop_id` in all tools. If two shops ever sound similar by name, rely on the `shop_id` from the phone, not the name."*
- The `identify_shop_by_phone` tool response must always include `shop_id` and the agent must echo it back into every tool call.
- On handoff, the `shop_id` (not just the name) travels in the shared context (§6.2 HANDOFF/SHOP CONTEXT), so the receiving agent continues against the same `shop_id`.

### Code gap to fix (createShop defaults)
`createShop` in `backend.ts:1136` currently hard-codes `credit_limit: 5000` — **this is correct and stays as 5000** (your decided default; the agent must never ask the owner for a credit limit). The gap is that it **always assigns the default route `R001` — this must NOT happen.** The route/beat is chosen by the owner during onboarding and is only written to `beat_route_id` **when the owner confirms the full read-back**. `createShop` should accept the owner-confirmed `beat_route_id` (and never invent a default). This is part of Phase B (§5).

---

*Plan written after reading the live SnapServe squad v3 (Reception #797, Order Taker #799, Business Brain #802, Support #803), the live lyra-gray portal dashboard, and the full Lyra repo (voice engine, tools, backend, schema, migrations, portal pages).*
