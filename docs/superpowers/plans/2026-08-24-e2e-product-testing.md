# Lyra 2.0 — Full Product End-to-End Testing Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task = one dedicated tester subagent with its own Chrome tab. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Human-quality end-to-end QA of the live Lyra portal at https://lyra-gray.vercel.app — every page, every CRUD flow, every money calculation, every state machine branch — executed by a team of specialist subagent testers, each in its own Chrome tab via the chrome-devtools MCP.

**Architecture:** An orchestrator dispatches 11 sequential tester subagents. Each subagent opens its own tab (`chrome-devtools_new_page`), tests one module like a human QA engineer would (act → observe → hard-reload → re-verify → check console/network), writes a findings report to `docs/superpowers/plans/e2e-findings/`, then closes its tab. A final task consolidates everything into one QA verdict. **Testers run strictly ONE AT A TIME** because the chrome-devtools MCP has a single browser with global "selected page" state — two agents driving tabs concurrently would click in each other's tabs.

**Tech Stack:** chrome-devtools MCP (`new_page`, `take_snapshot`, `click`, `fill`, `fill_form`, `evaluate_script`, `list_console_messages`, `list_network_requests`, `close_page`), Task tool for subagent dispatch, Markdown findings reports.

---

## Global Constraints

Every task implicitly includes this section.

- **App under test:** `https://lyra-gray.vercel.app` (live Vercel + live Supabase). This is PRODUCTION demo data — never destructive against seed rows.
- **Seed data (do NOT mutate):** Shops `S101 Kannan Stores` (credit limit ₹10,000, outstanding ₹7,500 → available ₹2,500; blacklists P005/P006/P007), `S102 Murugan Store` (blacklist P013; seeded complaint #1; seeded return #1 status photo_received), `S103 Shanthi General Store` (clean, Tamil), `S104 Lakshmi Traders` (Hindi), `S105 Anand Provision Store` (English). Orders `ORD1019`–`ORD1023`. Products `P001`–`P033` (e.g., P002 Clinic Plus 340ml ₹155/bottle, P004 Sachet box ₹250, P010 Surf Excel 4kg ₹720 with only 3 units vs threshold 5 = LOW STOCK, P014 Rin 250gx24 ₹700, P015 Wheel 1kg ₹125, P017 Pepsodent 80g ₹55, P020 Boost 200g ₹110, P024 Red Label 500g ₹210). Schemes `SCH01`–`SCH03`. Route `R001 Tambaram Main Beat (Rajesh Kumar)`.
- **QA test-data convention:** every created entity is prefixed `QA` (shop name starts `QA `, product_id `QA-P90x`, scheme_id `SCH-QAxx`, route_id `R-QAxx`, phones `9199000001NN` unique per module). QA records must be identifiable and are cleaned up/deactivated in Task 11.
- **Money format:** UI renders INR as `₹1,400` (en-IN, no decimals). Date format `10 Aug 2026`.
- **Deep-verify rule (the core of this plan):** after ANY mutation, verify at least THREE ways: (1) immediate UI feedback (toast/list/modal state), (2) **hard-reload the page** (`navigate_page` type=reload) and confirm the record persisted server-side — optimistic client state (`setShops(...)`) can mask DB failures, only a reload proves persistence, (3) an aggregate/related page reflects it (stat card, shop detail, payments ledger, catalog inventory). Where relevant also check `list_console_messages` for errors and `list_network_requests` for failed requests.
- **Math is verified exactly.** Every rupee assertion below is pre-computed. If actual ≠ expected, that is a BUG — record it, do not adjust expectations.
- **Known DB behavior to verify against** (from `supabase/migrations/20260823000000_mis_portal.sql`):
  - Payment inserted → shop.outstanding_balance = GREATEST(outstanding − amount, 0) (overpay clamps at ₹0).
  - Return status transitioned TO `credit_issued` → outstanding −= credit_note_amount (clamped at 0). Creating the return alone does NOT change outstanding.
  - Return status transitioned TO `collected` or `credit_issued` (first time) → inventory available_qty += quantity, stock_movement reason `return_received`.
  - Delivery created → order becomes `delivered`; trigger decrements inventory ONLY if delivery status is exactly `delivered`, but `createDelivery` inserts status `"completed"` → **inventory likely does NOT decrease — verify live, this is a suspected bug (BUG-HUNT target).**
  - Order status change → row appended to `order_status_log`.
- **Browser discipline:** each tester creates its own tab via `chrome-devtools_new_page` and works ONLY there; never calls `select_page`; closes its page with `close_page` when done (the orchestrator keeps tab 0 parked on `about:blank`). Viewport: default desktop.
- **Interaction pattern:** always `take_snapshot` first, act on the `uid` of the visible label text given in steps (labels are exact UI strings from source). Prefer `fill_form` for multi-field forms. Use `chrome-devtools_evaluate_script` for numeric assertions by parsing `document.body.innerText`.
- **Findings report per task:** write `docs/superpowers/plans/e2e-findings/<task-slug>.md` containing: module name, tester, date, environment (URL), a PASS/FAIL table (one row per step), BUG list (id `BUG-<module>-<nn>`, severity Critical/High/Medium/Low, repro steps, expected vs actual, evidence quote), and residue created (entity IDs).
- **Bug severity guide:** Critical = data corruption/money miscalculation/crash. High = feature dead or wrong business rule. Medium = wrong display/state glitch. Low = cosmetic/UX.
- **No test framework exists in this repo** — verification IS the browser evidence. Do not invent npm test commands.
- Dispatch order is fixed (Tasks 1→11); later tasks depend on entities created earlier (QA shop from Task 2 used everywhere; QA order from Task 4 used by Tasks 5, 6, 7).

---

### Task 1: Smoke Test & Baseline Capture

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/baseline.md`

**Interfaces:**
- Produces: baseline numbers every later task compares deltas against — shops count & per-shop outstanding, orders count, payments stats, inventory qty for P010/P002/P015, returns count, schemes/routes counts. Written as a table in `baseline.md`.

- [ ] **Step 1: Open app and park orchestrator tab**

Run: `chrome-devtools_new_page` url=`about:blank` (this is tab 0 — never close it).

- [ ] **Step 2: Open tester tab on /shops**

Run: `chrome-devtools_new_page` url=`https://lyra-gray.vercel.app/shops`
Expected: page loads, title/nav shows all 10 items: Shops, Orders, AI Memory, Exceptions, Voice AI, Catalog, Deliveries, Payments, Schemes, Routes.

- [ ] **Step 3: Smoke every route**

For each URL below: `navigate_page` type=url, wait for load, `take_snapshot`, record HTTP success (no error boundary / "Application error" text):

`/shops`, `/orders`, `/memory`, `/exceptions`, `/voice`, `/catalog`, `/deliveries`, `/payments`, `/admin/schemes`, `/admin/routes`, `/shops/S101`, `/shops/S102`, `/shops/S103`, `/orders/ORD1019`, plus a bogus route `/qa-nope` expecting the not-found page.

- [ ] **Step 4: Console sweep**

Run: `list_console_messages` on each of the 10 main routes. Expected: zero `error` level messages (warnings acceptable). Any error = BUG-SMOKE-01+.

- [ ] **Step 5: Capture baseline numbers into baseline.md**

On `/shops`: read the 4 stat cards (Total shops, Credit at risk, Overdue visits, Orders placed) and each seed shop's Credit cell ("available" and "X owed") via snapshot. On `/orders`: Total orders, Order value, Active, Delivered. On `/payments`: Total Collected, Credit Notes, Total Orders, Net Position. On `/catalog`: stock qty shown for P010, P002, P015 cards/rows. On `/exceptions`: number of open returns listed. Write all values verbatim into `baseline.md`.

- [ ] **Step 6: Report + close tab**

Write findings to `e2e-findings/baseline.md` (PASS/FAIL table + console errors). Close own tab: `close_page` its pageId.

---

### Task 2: Shops Module — Create, Deep-Verify, Edit, Pay, Deactivate

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/shops.md`

**Interfaces:**
- Consumes: baseline.md numbers.
- Produces: **QA shop with known identity** — shop name `QA Alpha Supermarket`, owner `QA Tester One`, phone `919900000101`, language English, route R001, visit gap 5, credit limit ₹5000. Later tasks look it up by name `QA Alpha Supermarket` on `/shops` and navigate to its detail link.

- [ ] **Step 1: Open tab on /shops**

Run: `chrome-devtools_new_page` url=`https://lyra-gray.vercel.app/shops`.

- [ ] **Step 2: Create shop — fill the Add Shop form like a human**

Snapshot → click button labelled `Add Shop` → dialog `Add New Shop` appears. Fill via `fill_form`:
- `Shop Name` = `QA Alpha Supermarket`
- `Owner Name` = `QA Tester One`
- `Phone Number` = `919900000101`
- `WhatsApp Number` = `919900000101`
- `Preferred Language` = `English`
- `Route` = `Tambaram Main Beat (Rajesh Kumar)`
- `Visit Gap (days)` = `5`
- `Credit Limit` = `5000`
- `Call Window Start` = `09:00`, `Call Window End` = `18:00`
- `Address` = `12 QA Street, Chennai`
Click `Create Shop`.

- [ ] **Step 3: Verify creation — deep, not shallow**

Expected in dialog-closed list: row `QA Alpha Supermarket` with subtitle `QA Tester One · S<new id>` (note the generated shop_id — save it), Language badge `English`, credit cell `₹5,000` available and `₹0 owed`, Orders `0`, no flags. Stats card `Total shops` incremented by 1 vs baseline.
Then HARD RELOAD (`navigate_page` type=reload) → row still present with identical values (proves Supabase persist, not just client state).

- [ ] **Step 4: Negative input — required fields enforced**

Click `Add Shop`, leave everything empty, click `Create Shop`. Expected: browser blocks submit (HTML required validation on Shop Name / Owner Name / Phone Number), dialog stays open, no new row appears after cancel. Cancel the dialog.

- [ ] **Step 5: Edit shop**

In the QA row click `Edit`. Modal `Edit Shop` appears prefilled. Change `Credit Limit` to `8000`, set `Visit Gap (days)` to `3`, tick checkbox `Opt Out`. Click `Save`. Expected without reload: row credit shows `₹8,000` and Flags column gains badge `Opted out`. Hard reload → both persist. Then Edit again, untick `Opt Out`, Save, reload → flag gone.

- [ ] **Step 6: Record payment from the shops list**

First give the shop debt: nothing owes yet (₹0), so instead pay on a seed shop READ-ONLY-safe? NO — payments mutate seed shops. Skip seed shops. Instead: verify the modal opens and validates. Click `Payment` in QA row → modal `Record Payment for QA Alpha Supermarket` shows line `Outstanding: ₹0 | Available Credit: ₹8,000`. Enter Amount `-50` → expect HTML min=1 blocks submit. Enter Amount `100`, Method `UPI`, Reference `QA-REF-01`, click `Record Payment`. Modal closes. **Hard reload /shops** → QA row still shows `₹0 owed` (₹0 − 100 clamps at 0 per trigger — correct behavior, note as PASS with clamp observation). Verify ledger proof in Task 6 (payment row exists there).

- [ ] **Step 7: Deactivate guard rail**

Click `Deactivate` in QA row → confirm dialog `Deactivate Shop` with description about opting out. Click `Deactivate` → QA row disappears from list. Hard reload → STILL gone (soft-delete sets opt_out; list hides it). Stats `Total shops` back to baseline count.
Recovery path check: the shop still exists at direct URL `https://lyra-gray.vercel.app/shops/<saved shop_id>` (detail page renders). Re-activate? Not possible from list since hidden — document as finding (Medium UX: deactivated shop unreachable from UI even though description says reversible by editing).

- [ ] **Step 8: Recreate the canonical QA shop for later tasks**

Repeat Step 2 EXACTLY (same values, same phone is OK if unique constraint allows; if duplicate-phone error alert appears, use phone `919900000102` and note it). This second instance is THE QA shop for Tasks 3–11. Save its shop_id and detail URL. Leave it active (opt_out false). Hard reload → present.

- [ ] **Step 9: Console + network sweep, report**

`list_console_messages` → no errors. Write `e2e-findings/shops.md`. Close own tab.

---

### Task 3: Shop Detail Page — Credit Math, Blacklist, Memory, Sections

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/shop-detail.md`

**Interfaces:**
- Consumes: QA shop URL from Task 2 Step 8.
- Produces: confirmation that S101/S102 seeded integrity displays correctly; memory confirm/delete exercised ONLY on a QA-created memory (created here via API if no UI add exists — see Step 4).

- [ ] **Step 1: Open S101 detail (read-only math check)**

Navigate `https://lyra-gray.vercel.app/shops/S101`.
Verify Credit Health card: limit `₹10,000`, owed `₹7,500`, available `₹2,500`, bar width ≈ 25% and amber (below 25% threshold uses `< 0.25` → amber; if exactly 2500/10000 renders emerald, note formula edge). Profile: phone `919840011234`, window `09:00–11:00`, Tanglish badge. Blacklist section lists 3 Lux entries (P005/P006/P007) with reasons incl. `Lux Soap venaam...`. Memories list ≥3 S101 memories incl. `Do not pitch Lux Soap` (negative_memory, 98%). Orders section shows `ORD1019` total `₹1,400` delivered with 3 line items (Clinic Plus 340ml ×2 = ₹310, Red Label 500g ×1 = ₹210, Lux Soap 100g×20 ×1 = ₹880 — sum must equal 1400).

- [ ] **Step 2: S102 sections render**

Navigate `/shops/S102`. Complaints section: `damaged_goods`, severity medium, status open, callback requested TRUE, description mentions Pepsodent tubes. Returns section: return #1, product Rin Soap (P014), qty 1, status `photo_received`, credit note `₹0`. Call Logs: CALL102 tamil positive with transcript summary.

- [ ] **Step 3: QA shop detail matches what was typed**

Navigate to QA shop URL. Verify: available `₹8,000`… NOTE: Task 2 recorded a ₹100 overpay → trigger clamped outstanding at 0, so available stays `₹8,000` — assert exactly that (cross-module consistency proof). Orders empty state, no blacklist, no complaints.

- [ ] **Step 4: Memory confirm/delete round-trip**

If the detail page offers no way to ADD a memory, create one as power-user: `chrome-devtools_evaluate_script`:
```js
async () => {
  const res = await fetch("https://lyra-gray.vercel.app/api/save-memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: "<QA_SHOP_ID>", memory_text: "QA memory - prefers evening calls", memory_type: "timing", confidence_score: 0.9 })
  });
  return { status: res.status, body: await res.text() };
}
```
Expected status 200. Reload QA detail page → memory `QA memory - prefers evening calls` appears unconfirmed. Navigate `/memory`, find that memory card, click its `Confirm` button → badge flips to confirmed without reload; then click `Delete` → accept native `confirm()` dialog (handle_dialog accept) → card gone. Hard reload `/memory` → still gone; hard reload QA detail → memory absent. If any step fails, BUG-MEM-01.

- [ ] **Step 5: Navigation integrity**

From `/shops` click the `QA Alpha Supermarket` link → lands on QA detail URL. Browser back → list. Nav item `Shops` highlighted when inside `/shops/<id>`.

- [ ] **Step 6: Console sweep, report, close**

No console errors. Write `e2e-findings/shop-detail.md`. Close tab.

---

### Task 4: Orders Module — Manual Order With Exact Money Math + Lifecycle

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/orders.md`

**Interfaces:**
- Consumes: QA shop `QA Alpha Supermarket` from Task 2.
- Produces: **QA order** — shop QA Alpha, items: P017 Pepsodent Germicheck 80g × 3 @ ₹55 = ₹165 AND P020 Boost Chocolate 200g × 2 @ ₹110 = ₹220 → total `₹385`, status draft. Tasks 5/6/7 reference this order (find its order_id on the QA shop detail page Orders section; format ORD####). Also produces knowledge of filter/search correctness.

- [ ] **Step 1: Open tab on /orders**

Record baseline stats (from baseline.md) then click `Create Manual Order`.

- [ ] **Step 2: Build the order like a human**

Dialog `Create Manual Order`. Select `Shop` = `QA Alpha Supermarket (…)`. Click `Add Item` twice. Row 1: Product `Pepsodent Germicheck 80g (P017)` → unit auto-fills `tube`, price auto-fills `55`; Qty `3`; Discount `0`. Row 2: Product `Boost Chocolate 200g (P020)` → unit `jar`, price `110`; Qty `2`. Click `Create Order`.
Expected: dialog closes, new row at top of table: order id (save it), shop `QA Alpha Supermarket`, status badge Draft, Payment badge pending/unpaid per app convention, Total `₹385`. Stat `Order value` increased by 385 vs baseline; `Active` +1.

- [ ] **Step 3: Deep-verify the math server-side**

Hard reload `/orders` → row persists, total still `₹385`. Navigate QA shop detail → Orders section shows this ORD, total `₹385`, and shop credit/outstanding: outstanding should now be `₹385` (create-order increments outstanding per backend contract; if unchanged, BUG-ORD-MONEY-01 CRITICAL). Cross-check `/shops` QA row shows `₹385 owed` and available `₹7,615` (8000−385).

- [ ] **Step 4: Filters and search actually filter**

Set `Status` filter = `Delivered` → QA order row hidden, only delivered seed orders remain; count equals baseline Delivered stat. Set Status back to All. Type `QA Alpha` in `Search` → only QA order(s) remain. Search garbage `ZZZZ` → EmptyState `No matching orders`. Clear search.

- [ ] **Step 5: Confirm → Schedule lifecycle**

On QA order row (status draft/awaiting_confirmation) click `Confirm` → badge becomes `confirmed` WITHOUT reload; handle native dialogs if any appear. Hard reload → still confirmed. Click `Schedule` → native prompt 1: enter `2026-09-01`; prompt 2: enter `Morning`. Expected badge `out_for_delivery`, Delivery column shows `1 Sep 2026`. Hard reload → persists.

- [ ] **Step 6: Cancel branch on a SECOND order**

Create another manual order (same shop, single item P023 Red Label Tea 250g × 1 @ ₹110 → `₹110`). Click `Cancel` on its row → prompt asks reason → enter `QA cancel test`. Badge `cancelled`. Hard reload → persists. Note: cancelled orders move to history bucket (Stat Delivered counts delivered+cancelled per code — verify stat semantics match reality and note discrepancy if `Delivered` stat includes the cancelled order → Medium display bug candidate BUG-ORD-STAT).

- [ ] **Step 7: Bulk select + Confirm Selected**

Tick checkboxes on TWO draft/confirmable orders (use the ₹110 one if still confirmable + any other non-destructive target — prefer creating a third QA order P015 Wheel Active 1kg × 1 = `₹125` to avoid touching seeds). Banner `2 order(s) selected` appears with `Confirm Selected`. Click it. Both badges become confirmed. `Clear Selection` empties banner.

- [ ] **Step 8: Over-credit guard (business rule)**

Edit nothing in DB; instead attempt a manual order for seed shop `Kannan Stores` worth > ₹2,500 available credit: Create Manual Order → shop `Kannan Stores (S101)`, item P032 Dove Cream Beauty 75g x 12 × 5 @ ₹720 = `₹3,600`. Submit. EXPECTED per spec: rejection/partial-payment rule fires (alert with credit error). If order silently creates and S101 outstanding jumps past limit, BUG-ORD-CREDIT-01 HIGH (money-rule breach). If created, immediately `Cancel` it with reason `QA credit cleanup` and verify S101 outstanding returned to prior value on hard reload (cancel does NOT refund outstanding automatically per actions.ts — if S101 outstanding stays inflated, that is CRITICAL BUG-ORD-CREDIT-02; restore manually by recording a compensating payment via Task-6-style flow? NO seed mutation allowed — instead record exact damage in report and flag for manual DB fix).

- [ ] **Step 9: Order Detail page**

Open `/orders/<QA_order_id>` (click the order id link). Verify header fields (status, dates, totals), item table lines with per-line totals matching Step 2 math, and any timeline/status log rendering. Back to `/orders`.

- [ ] **Step 10: Console/network sweep, report, close**

Write `e2e-findings/orders.md` including final QA order ids + amounts table. Close tab.

---

### Task 5: Deliveries — Partial Quantities, Stock-Out Trigger Hunt

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/deliveries.md`

**Interfaces:**
- Consumes: QA confirmed/out_for_delivery order `₹385` (items P017 ×3, P020 ×2) from Task 4; catalog quantities captured in baseline.md (P017, P020).

- [ ] **Step 1: Open tab on /deliveries**

Note existing deliveries list content. Click `Create Delivery` (or equivalent opening button).

- [ ] **Step 2: Record delivery of the QA order with PARTIAL qty**

Select order = QA ₹385 order → item rows autofill ordered qty (P017 3, P020 2). Set delivered qty: P017 = `3`, P020 = `1` (partial!). Date = today, slot `Morning`, vehicle `KA01QA1111`, person `QA Courier`. Submit.
Expected: delivery row appears; QA order status becomes `delivered`; on `/orders` the row shows Delivered and its row action becomes `View`.

- [ ] **Step 3: STOCK-OUT TRIGGER HUNT (suspected bug)**

Navigate `/catalog`. Compare P017 and P020 available qty against baseline (P017 baseline N, P020 baseline M). Per schema intent, delivering should decrement inventory (trigger `record_delivery_stock_out`) — BUT `createDelivery` inserts status `"completed"` while trigger only fires on `'delivered'`.
- If P017 dropped by 3 and P020 by 1 → PASS (trigger fine).
- If quantities UNCHANGED → **BUG-DLV-STOCK-01 HIGH**: deliveries through the portal never decrement inventory and never write `stock_movements`. Evidence: before/after numbers quoted.

- [ ] **Step 4: Order detail reflects delivery**

Open `/orders/<QA_385_id>` → status Delivered; delivery info visible if surfaced. `/deliveries` row shows person `QA Courier`, vehicle, date.

- [ ] **Step 5: Console sweep, report, close**

Include inventory before/after table in `e2e-findings/deliveries.md`. Close tab.

---

### Task 6: Payments — Ledger Math, Overpay Clamp, Filters, Net Position

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/payments.md`

**Interfaces:**
- Consumes: QA shop (available ₹7,615 / owed ₹385 after Task 4 — recompute from current UI at start), Task 2's ₹100 UPI payment (should already exist in ledger), QA ₹385 order.

- [ ] **Step 1: Open tab on /payments**

Read stats. Recompute by hand from the visible ledger: TotalCollected = Σ entry_type payment (excluding credit_note/order methods per code), CreditNotes = Σ credit_note entries, TotalOrders = Σ |order| entries, NetPosition = collected + notes − orders. All four stat cards must equal your sums exactly — mismatch = BUG-PAY-STAT-01.

- [ ] **Step 2: Verify Task 2's overpaid payment exists**

Filter Method = `UPI` → the `QA-REF-01` ₹100 cash—correction: UPI payment row for QA shop is present with correct method/reference/collected_by blank. Filter Method = `Cash` → QA rows hidden. Reset filters.

- [ ] **Step 3: Record a real partial payment and watch THREE surfaces update**

Click `Record Payment`. Shop = `QA Alpha Supermarket`, Order id = QA ₹385 order id, Amount `200`, Method `Cash`, Collected By `QA Collector`, Notes `partial payment QA`. Submit.
Surface 1 — `/payments`: new row amount `₹200`, entry_type payment, method Cash. Stats: TotalCollected +200.
Surface 2 — hard reload `/payments`: row persists.
Surface 3 — `/shops` QA row: owed drops `₹385 → ₹185`, available rises to `₹7,815`. And `/shops/<QA>` detail credit card agrees. Any divergence = BUG-PAY-MONEY-01 CRITICAL.

- [ ] **Step 4: Overpay clamp re-verified on real debt**

Record another payment: QA shop, Amount `5000`, Method `Cheque`, Ref `QA-OVERPAY`. Expected: succeeds; QA shop owed clamps to `₹0` (GREATEST(outstanding−amount,0)), available back to full `₹8,000`. Ledger shows both rows. Hard reload all three surfaces.

- [ ] **Step 5: Shop-filter combo**

Filter Shop = QA shop AND Method = `Cheque` → exactly 1 row (₹5000). Change Method = `Credit Note` → 0 rows today (returns not yet credited; Task 7 will add one — note count for cross-check later).

- [ ] **Step 6: Console sweep, report, close**

Report includes running ledger table for QA shop. Close tab.

---

### Task 7: Exceptions — Return Lifecycle With Credit-Note Money Flow

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/exceptions.md`

**Interfaces:**
- Consumes: QA order ₹385 (item P017 @ ₹55); QA shop owed currently `₹0` (after Task 6 overpay — perfect clean slate for credit-note math); baseline returns count.
- Produces: QA return on P017 walked through every status; final state `credit_issued`.

- [ ] **Step 1: Open tab on /exceptions**

Verify seeded return #1 (Murugan Store · Rin × 1 · `photo_received`) is listed under Open Returns.

- [ ] **Step 2: Dead-button hunt**

Click `Create Return`. NOTHING happens (handler is `onClick={() => {}}` in source). Confirm live: no dialog, no navigation → **BUG-EXC-01 HIGH: primary CTA is a no-op**.

- [ ] **Step 3: Create a return via the app's own API (power-user path)**

```js
async () => {
  const res = await fetch("https://lyra-gray.vercel.app/api/create-return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: "<QA_SHOP_ID>", order_id: "<QA_385_ORDER_ID>", product_id: "P017", quantity: 3, reason: "damaged_goods" })
  });
  return { status: res.status, body: await res.text() };
}
```
Expected 200 with `credit_note_amount` = 165 (3 × ₹55 ORDER-item price — proves it prices from order_items, not catalog). Reload `/exceptions` → new row `QA Alpha Supermarket … P017 × 3` status `requested`, reason `Damaged Goods` label. **Money invariant:** QA shop outstanding must be UNCHANGED (`₹0`) right now — credit note applies only at `credit_issued`.

- [ ] **Step 4: Walk the status machine forward**

Row dropdown options must follow `nextStatusMap`. From `requested` select `Photo Received` → badge updates, dropdown now offers Approved/Rejected only (no Photo Received again). Hard reload → persisted. `requested → approved` skip-ahead must have been offered too (map allows) — note if transitions ever offer illegal moves like rejected→anything (should offer none).

- [ ] **Step 5: collected → stock-in trigger**

Set status `Collected`. Then `/catalog`: P017 available must be baseline_P017 + 3 (return_stock_in adds quantity back; note Task 5 may have proven deliveries don't decrement — so compare against CURRENT reading taken just before this step, delta +3 expected). Also verify a second walk to `collected`-adjacent statuses doesn't double-add (transition collected→credit_issued must NOT add another +3).

- [ ] **Step 6: credit_issued → money lands**

Set status `Credit Issued`. Expected: row leaves "Open Returns" (subtitle says not-yet-credited) or shows terminal state; QA shop outstanding drops by `₹165` → but owed was ₹0 and GREATEST() clamps at 0 → stays `₹0` (correct; note clamp made the visible-money assertion inert — instead prove the credit note economically via `/payments`: Credit Notes stat +165 and a `credit_note` ledger row of `₹165` appears; Shop filter QA + Method `Credit Note` → exactly 1 row now, updating Task 6 Step 5's zero-row observation). Hard reload everything. Inventory P017 unchanged by this step (+0).

- [ ] **Step 7: rejected branch**

Create a second return via API: P020 qty 1 reason `expired`, then in UI set it `Rejected` → terminal, dropdown offers nothing further, no money/inventory movement anywhere (verify `/payments` Credit Notes unchanged, P020 qty unchanged).

- [ ] **Step 8: Seeded return untouched**

Return #1 still `photo_received` with credit note `₹0` — we never mutated it.

- [ ] **Step 9: Console sweep, report, close**

Close tab.

---

### Task 8: Catalog & Inventory — Product CRUD, Adjust +/- , Low-Stock

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/catalog.md`

**Interfaces:**
- Produces: QA product `QA-P901` (`QA Test Toothpaste 100g`, brand `QABrand`, category Oral Care, unit tube, price ₹60, tax 18) used nowhere else but referenced in cleanup.

- [ ] **Step 1: Open tab on /catalog**

Verify 33 seed products render with prices/taxes (spot-check P002 ₹155, P010 ₹720, P033 ₹840) and category badges. Find low-stock indicator for P010 (3 units < threshold 5) — if NO visual low-stock cue exists, BUG-CAT-LOWSTOCK Medium (spec bakes this demo scenario).

- [ ] **Step 2: Admin mode gate**

Toggle admin/edit mode control (`isAdminMode`) if present — verify product action buttons (Add/Edit/Adjust/Deactivate) only usable in admin mode; note behavior either way.

- [ ] **Step 3: Create product**

Click `Add Product`. Fill: ID `QA-P901`, name `QA Test Toothpaste 100g`, brand `QABrand`, category `Oral Care`, unit `tube`, price `60`, tax `18`. Submit. Row appears (top). Hard reload → persists with exact values.

- [ ] **Step 4: Duplicate-ID negative test**

Add product again with SAME id `QA-P901` → expect visible error alert (Supabase PK violation surfaced via result.error), row count unchanged.

- [ ] **Step 5: Adjust inventory +10 then −3, verify arithmetic and audit trail**

On `QA-P901` open `Adjust Inventory`. Change qty `+10`, reason `Restock`, notes `QA restock`. Available must show `10` (0+10; insert creates inventory row). Reopen: change `−3`, reason `Damage`. Available `7`. Hard reload → `7` persists. If a stock-movements list is rendered anywhere, both movements (+10 restock, −3 damage) must appear; if not displayed anywhere in the product, note observability gap Low.

- [ ] **Step 6: Negative clamp**

Adjust `−999` reason `Transfer`. Expected available `0` (Math.max(...,0)) and NO crash. Then adjust `+5` → `5`.

- [ ] **Step 7: Zero/negative qty inputs rejected by form**

Try change_qty `0` then `-0` via form if min attribute blocks — document actual gating (form min may allow negatives intentionally for reductions; PASS if server clamp held in Step 6 regardless).

- [ ] **Step 8: Edit product**

Edit `QA-P901` price to `75`, untick active? NO — keep active until cleanup; just change price + name suffix ` v2`. Row reflects edits after reload.

- [ ] **Step 9: Deactivate product**

Deactivate `QA-P901` accepting native confirm → row disappears. Hard reload → still gone. (Cleanup note recorded.)

- [ ] **Step 10: Console sweep, report, close**

Close tab.

---

### Task 9: Admin — Schemes & Routes

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/admin.md`

**Interfaces:**
- Produces: scheme `SCH-QA01` (Boost 200g buy-3 cashback ₹50, 2026-09-01→2026-09-30) and route `R-QA01 QA Test Beat` — both referenced in cleanup. Route also proves cross-page propagation into Shops form.

- [ ] **Step 1: Open tab on /admin/schemes**

Verify SCH01–SCH03 render with benefit labels (free_units 1, discount 10%, cashback 100 — display formatting checked against data above; e.g., SCH02 shows discount value 10.00 in whatever unit UI chooses — note ambiguity if unclear).

- [ ] **Step 2: Create scheme**

Click create. Fill: id `SCH-QA01`, name `QA Boost Cashback`, start `2026-09-01`, end `2026-09-30`, eligible products select `Boost Chocolate 200g (P020)`, min qty `3`, benefit `cashback`, value `50`. Submit → row appears ACTIVE. Hard reload → persists. Duplicate-id retry → error alert (same negative pattern as Task 8).

- [ ] **Step 3: Deactivate scheme**

Deactivate `SCH-QA01` → disappears from active list; hard reload → gone from active (is_active=false in DB).

- [ ] **Step 4: Routes page**

Open `/admin/routes`. R001 visible with salesperson Rajesh Kumar. Create `R-QA01` / `QA Test Beat` / salesperson `QA Sales` / coverage `QA Area`. Appears in table. Edit it → rename salesperson `QA Sales 2`. Save, reload → persisted.

- [ ] **Step 5: Cross-page propagation — route feeds Shops form**

Open `/shops` → `Add Shop` → open `Route` dropdown → option `QA Test Beat (QA Sales 2)` MUST exist alongside R001 (routes fetched server-side). Close dialog. Deactivate `R-QA01` on `/admin/routes`; reopen Shops Add Shop after a hard reload → `QA Test Beat` gone from dropdown. Restore nothing.

- [ ] **Step 6: Console sweep, report, close**

Close tab.

---

### Task 10: Voice AI Simulator — Full State Machine + Business Rules

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/voice.md`

**Interfaces:**
- Consumes: QA shop (owed ₹0, available ₹8,000, English, no orders yet → suggested order empty path), S103 Shanthi (last order ORD1021: Red Label 500g ×2 @210 + Boost 500g ×1 @250 = ₹670), S101 blacklist rules.
- Produces: voice-created orders + one voice-created return (residue documented). Keep TTS checkbox OFF ("Speak responses" unchecked) to keep tests fast and headless-friendly.

- [ ] **Step 1: Open tab on /voice**

Shop dropdown lists all shops. Right panel shows Database Trace, Call Flow progress, System Prompt, Tool Schemas. No messages in transcript initially.

- [ ] **Step 2: HAPPY PATH on S103 with repeat order + change + WhatsApp=no**

Select shop `Shanthi General Store`. Click `Start call (simulator)`.
Transcript expectations:
1. Lyra greets by owner name: message containing `Shanthi` and `Lyra from Shree Agencies`. Trace shows `identify_shop` + `suggested_order` ok. State pill `good_time` next.
2. Type `yes` send → state `repeat_order`, Lyra reads suggestion: `Red Label Tea 500g` ×2 and `Boost Chocolate 500g` ×1, Total `₹670` (exact strings contain `670`). Progress bar advances.
3. Type `remove boost` → intent CHANGE → state `read_back`, order now only Red Label ×2, Total `₹420`.
4. Type `sari` → CONFIRM: order CREATED. Green banner `Order saved to database — ORD<nnnn> · ₹420 · <status>` with working `View in portal →` link. Trace rows include `create_order ok`. State `confirm`, Lyra asks WhatsApp summary.
5. Type `illa` (NO) → ends without WhatsApp; trace must NOT contain send_whatsapp. State `end`.

- [ ] **Step 3: Verify the voice order in the relational world**

Open banner's `View in portal →` (or `/orders`): find ORD with total `₹420` shop `Shanthi General Store`. Hard reload `/shops`: Shanthi owed increased 2000→`₹2,420`, available 6000→`₹5,580`. `/shops/S103` Orders section lists it. Call Logs gains a new entry (createOrder inserts call_logs). If ANY of these diverge: BUG-VOICE-MONEY-01 CRITICAL.

- [ ] **Step 4: Blacklist enforcement on S101**

New call, shop `Kannan Stores`. After greeting type `yes` → repeat_order suggestion must EXCLUDE all Lux SKUs (P005/P006/P007 blacklisted) even though last order ORD1019 included Lux 100gx20 — suggestion filters blacklist per getSuggestedOrder contract. Then type `add lux soap 100g x 20` → Lyra must respond with the BLACKLISTED script (`not available for your shop`) instead of adding it. Then type `stop` → immediate end from any state (STOP priority rule).

- [ ] **Step 5: Complaint flow on S102**

New call, `Murugan Store`. Greeting → type `yes` → repeat_order → type `complaint` (COMPLAINT beats YES in priority — verify Lyra enters complaint, not confirmation) → type `boxes were crushed` → type `pills were leaking` (desc state) → end; trace contains `save_complaint ok`. Verify `/shops/S102` complaints list gained a new open complaint with that description. 

- [ ] **Step 6: Return flow with credit-note math on S102**

New call, `Murugan Store`. `yes` → `return` → type `Wheel Active 1kg` (product-match step; P015 ₹125) → type `2` → type `packets damaged` → end. Lyra's RETURN CONFIRM must say credit note of `₹250` (2 × 125). Trace `create_return ok`. Verify `/exceptions` new row Murugan · Wheel × 2 status `requested` (portal-created returns start requested even via API — voice path may differ; record ACTUAL). Money: S102 owed BEFORE minus? Portal rule says outstanding changes only at credit_issued — verify S102 owed on `/shops` unchanged immediately after call ends (if it already dropped, note engine-vs-portal inconsistency BUG-VOICE-RET-01 MEDIUM).

- [ ] **Step 7: Edge branches**

(a) New call S104 → greeting must reflect Hindi shop context per language strategy (observe actual language of scripts; note finding). Type `no` at good_time → polite END (`I'll call you another time`), trace has NO create_order.
(b) New call S105 → at repeat_order type random gibberish `xyzzy` → treated as OTHER→ read_back full repeat order; then type `no` once → back to changes; type `nothing` → read_back again; type `no` SECOND time → force-confirm rule fires (order auto-created per engine rule "2nd no → force confirm") — verify banner ORD appeared and note whether force-create without explicit yes is desired (spec says yes; PASS if created).
(c) Mid-call on any shop type `stop` at EVERY state reachable cheaply (good_time, changes, confirm) — stop always wins, call ends, nothing saved after stop.

- [ ] **Step 8: Live-call buttons fail gracefully**

Click `Live call (Twilio)` then `Live call (Exotel)` on a fresh idle simulator. EXPECTED: visible error banner (DB lookup failed / call failed) OR graceful alert — NOT a silent hang or unhandled promise. Document actual behavior (external telephony can't complete in test env; criterion = graceful degradation only).

- [ ] **Step 9: TTS smoke (optional, cheap)**

Tick `Speak responses`, one-turn call on S103, verify `/api/tts` request appears in `list_network_requests` returning 200 audio/*; untick after.

- [ ] **Step 10: Console sweep across whole session, report, close**

List ALL residue orders/returns/complaints created (ids + amounts). Close tab.

---

### Task 11: Cross-Module Integrity Sweep, Cleanup & Final QA Verdict

**Files:**
- Create: `docs/superpowers/plans/e2e-findings/final-report.md`
- Modify: none in app.

**Interfaces:**
- Consumes: all ten findings reports + baseline.md.

- [ ] **Step 1: Open tab; replay the money story end-to-end on QA shop**

Walk the FULL lifecycle narrative on fresh eyes: `/shops` QA row → detail → its orders (₹385 delivered via delivery, ₹420-equivalent flows where applicable) → `/payments` ledger rows (₹100 overpay-clamped, ₹200 partial, ₹5000 cheque clamp) → `/exceptions` credit-issued ₹165 → `/catalog` P017 inventory delta. Numbers must reconcile: owed_final = Σorders − Σpayments_applied − Σcredits_issued (with GREATEST clamps). Produce one reconciliation table in final-report.md. Any break = CRITICAL finding linking the owning module bug.

- [ ] **Step 2: Stale-cache hunt**

Hit `/shops` then immediately `/shops/QA` via client-side nav link (not hard nav) — Next.js cached RSC payloads can serve stale credit numbers; compare vs hard reload. Document any staleness (revalidatePath coverage gap) as BUG-INT-MEDIUM with the exact pair of differing values.

- [ ] **Step 3: Cleanup pass**

Deactivate/reverse what UI allows: QA shops → Deactivate (both instances); `/catalog` QA-P901 already deactivated; `/admin/routes` R-QA01 already deactivated; `/admin/schemes` SCH-QA01 already deactivated. List UNREMOVABLE residue explicitly (orders, returns, complaints, payments, call logs, voice-created records) with ids in final-report.md so the owner can purge via SQL if desired. Seed rows must equal baseline.md values except documented intentional deltas (S103 +420 order, S102 complaint/return, inventory deltas) — diff and list every drift honestly.

- [ ] **Step 4: Final consolidated report**

Merge all module reports into `final-report.md`: executive summary (X passed / Y failed / Z blocked), bug register sorted by severity with module cross-links, coverage matrix (page × tested-flows), residue appendix, and explicit GO / NO-GO recommendation for demo-readiness.

- [ ] **Step 5: Close tab; done**

Close tester tab (orchestrator `about:blank` tab remains).

---

## Execution Notes for the Orchestrator

1. **Sequential dispatch only** (see Architecture). One `Task` subagent at a time; paste in: Global Constraints + that task's full text + reminder that its chrome-devtools tools operate on the currently selected page and it must only use the page IT created.
2. Before dispatching Task N≥2, read the produced findings files of prior tasks and inject the concrete entity ids (QA shop_id, QA order ids) into the subagent prompt replacing `<QA_SHOP_ID>` / `<QA_385_ORDER_ID>` placeholders.
3. If a subagent reports the app is down or a Critical money bug makes later tasks meaningless, STOP and surface to the user before continuing.
4. After Task 11, present `final-report.md` to the user with the GO/NO-GO verdict.

## Self-Review

- **Spec coverage:** user asked for: Vercel app opened via devtools MCP ✓ (every task), subagents each with own tab ✓ (browser discipline + sequential rationale), human-like depth not just existence ✓ (hard-reload persistence rule, three-surface rule, exact rupee math, trigger-level expectations), returns with amount/negative direction ✓ (Tasks 6/7 clamp + credit-note timing), everything E2E not just shops ✓ (all 10 pages + FSM branches + cross-module reconciliation + cleanup).
- **Placeholder scan:** all steps carry exact URLs, field labels, values, expected outputs; dynamic ids are explicit runtime captures with named placeholders that the orchestrator injects (documented in Execution Notes) — not TBDs.
- **Type/name consistency:** entity names (`QA Alpha Supermarket`, `QA-P901`, `SCH-QA01`, `R-QA01`), file slugs, and bug-id conventions match across tasks; Task 7 consumes exactly what Task 4 produces (order ₹385 with P017×3@55); Task 6 Step 5's zero credit-note rows is consciously revisited in Task 7 Step 6.
