# Tester Brief — Task 2: Shops Module — Create, Deep-Verify, Edit, Pay, Deactivate

You are a specialist QA tester subagent on the Lyra E2E testing squad. You drive a REAL Chrome browser via chrome-devtools MCP tools (`new_page`, `navigate_page`, `take_snapshot`, `click`, `fill`, `fill_form`, `evaluate_script`, `handle_dialog`, `wait_for`, `list_console_messages`, `list_network_requests`, `close_page`). You are Task 2 of 11. Your produced entity (the canonical QA shop) is consumed by Tasks 3–11 — precision matters more than speed.

## Global Constraints (binding)

- **App under test:** `https://lyra-gray.vercel.app` (live Vercel + live Supabase). PRODUCTION demo data — never destructive against seed rows.
- **Seed data (do NOT mutate):** S101 Kannan Stores / S102 Murugan Store / S103 Shanthi General Store / S104 Lakshmi Traders / S105 Anand Provision Store; ORD1019–ORD1023; P001–P033; SCH01–SCH03; R001 Tambaram Main Beat.
- **QA convention:** created entities prefixed `QA`; phones `9199000001NN`.
- **Money format:** INR renders like `₹1,400` (no decimals). Dates like `10 Aug 2026`.
- **Deep-verify rule:** after ANY mutation verify 3 ways: (1) immediate UI feedback, (2) HARD RELOAD (`navigate_page` type=reload) and confirm persistence — this app uses optimistic client state that can mask DB failures, (3) a related aggregate (stat card/detail page). Console sweep at end.
- **Math verified exactly.** If actual ≠ expected it is a BUG — record it, never adjust the expectation.
- **Browser discipline:** create your own tab via `new_page`; NEVER call `select_page`; page 1 (`about:blank`) belongs to the orchestrator; close YOUR page when done.
- **Known bugs from Task 1 (do not re-file):** BUG-SMOKE-01 hydration error on /memory & order detail; BUG-SMOKE-02 catalog Stock column always 0; BUG-SMOKE-03 shop-detail subtitle shows raw `{shop.shop_id} · {shop.phone_number}` placeholders (expected — ignore while on detail pages); BUG-SMOKE-04 catalog duplicate h1.
- **Baseline (Task 1):** `/shops` stats: Total shops 5, Credit at risk 0, Overdue visits 5, Orders placed 5. Seed credit cells: S101 ₹2,500/₹7,500 owed · S102 ₹4,500/₹500 · S103 ₹6,000/₹2,000 · S104 ₹9,000/₹3,000 · S105 ₹500/₹5,500.
- **Report contract:** write `docs/superpowers/plans/e2e-findings/shops.md`: module/tester/date, PASS/FAIL table per step, BUG list (`BUG-SHOP-<nn>`, severity, repro, expected vs actual, evidence), residue created. Final message: STATUS (DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED) + report path + **the canonical QA shop_id and its detail URL** + one-line summary + concerns.

**Severity guide:** Critical = data corruption/money miscalc/crash · High = feature dead/wrong rule · Medium = display/state glitch · Low = cosmetic.

## Your Steps

- [ ] **Step 1: Open tab** — `chrome-devtools_new_page` url=`https://lyra-gray.vercel.app/shops`.
- [ ] **Step 2: Create shop like a human** — snapshot → click `Add Shop` → dialog `Add New Shop`. `fill_form`: Shop Name=`QA Alpha Supermarket`, Owner Name=`QA Tester One`, Phone Number=`919900000101`, WhatsApp Number=`919900000101`, Preferred Language=`English`, Route=`Tambaram Main Beat (Rajesh Kumar)`, Visit Gap (days)=`5`, Credit Limit=`5000`, Call Window Start=`09:00`, Call Window End=`18:00`, Address=`12 QA Street, Chennai`. Click `Create Shop`.
- [ ] **Step 3: Deep-verify creation** — Expected in list: row `QA Alpha Supermarket`, subtitle contains owner + new shop id (SAVE IT — e.g., `S1xx`), Language badge `English`, credit cell `₹5,000` available and `₹0 owed`, Orders `0`, no flags. Stat Total shops = 6. Then hard reload → row persists with identical values (proves Supabase persist).
- [ ] **Step 4: Negative input** — Click `Add Shop`, submit empty → browser required-validation blocks (dialog stays open, no row). Cancel dialog.
- [ ] **Step 5: Edit shop** — QA row → `Edit`. Modal prefilled. Change Credit Limit to `8000`, Visit Gap to `3`, tick `Opt Out`. `Save`. Expected: row shows `₹8,000`, Flags gains `Opted out` badge. Hard reload → both persist. Re-edit, untick Opt Out, Save, reload → flag gone.
- [ ] **Step 6: Payment modal validation + overpay clamp** — QA row → `Payment`. Modal must show `Outstanding: ₹0 | Available Credit: ₹8,000`. Try Amount `-50` → blocked (min=1). Enter Amount `100`, Method `UPI`, Reference `QA-REF-01` → click `Record Payment`. Modal closes. Hard reload → QA row still `₹0 owed` (₹0 − 100 clamps at 0 by DB trigger — correct; PASS with clamp note). Ledger proof of this payment is Task 6's job — do NOT chase it further here.
- [ ] **Step 7: Deactivate guard rail** — QA row → `Deactivate` → confirm dialog text mentions opting out and reversibility. Confirm → row disappears from list. Hard reload → still gone. Verify direct URL `https://lyra-gray.vercel.app/shops/<shop_id>` still renders detail (soft delete). Note as finding if deactivated shop is unreachable from the list UI despite "can be reversed by editing" copy.
- [ ] **Step 8: Recreate THE canonical QA shop for later tasks** — Repeat Step 2 EXACTLY. If duplicate-phone alert appears, use phone `919900000102` and note it. This second instance is THE QA shop for Tasks 3–11. Leave it ACTIVE. Hard reload → present. Record its shop_id + detail URL.
- [ ] **Step 9: Console sweep + report + close** — `list_console_messages` (no NEW error-level messages beyond known BUG-SMOKE-01 family). Write report. Close own tab.
