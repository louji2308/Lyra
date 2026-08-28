# Baseline Report — Task 1: Smoke Test & Baseline Capture

- **Module:** All routes (smoke) + baseline numbers
- **Tester:** Task 1 QA subagent (ox-alpha)
- **Date:** 24 Aug 2026
- **App:** https://lyra-gray.vercel.app (production demo data; read-only session)
- **Method:** Real Chrome via chrome-devtools MCP. Own tab only; orchestrator page 1 (`about:blank`) untouched. Every route navigated → full a11y snapshot → console sweep. Suspicious values re-verified with hard reload (ignoreCache) and cross-page aggregates.

---

## 1. Route smoke results (15/15 loaded)

| # | Route | Loads | Error boundary / "Application error" | Console errors | Verdict |
|---|-------|-------|--------------------------------------|----------------|---------|
| 1 | `/shops` | Yes | None | None | PASS |
| 2 | `/orders` | Yes | None | None | PASS |
| 3 | `/memory` | Yes | None | **1 error** (React #418, reproduced on reload) | PASS w/ BUG-SMOKE-01 |
| 4 | `/exceptions` | Yes | None | 0 errors (issue-level notices only) | PASS |
| 5 | `/voice` | Yes | None | 0 errors (issue-level notices only) | PASS |
| 6 | `/catalog` | Yes | None | 0 errors (issue-level notices only) | PASS w/ BUG-SMOKE-02/04 |
| 7 | `/deliveries` | Yes | None | None | PASS |
| 8 | `/payments` | Yes | None | None | PASS |
| 9 | `/admin/schemes` | Yes | None | None | PASS |
| 10 | `/admin/routes` | Yes | None | None | PASS |
| 11 | `/shops/S101` | Yes | None | None | PASS w/ BUG-SMOKE-03 |
| 12 | `/shops/S102` | Yes | None | None | PASS w/ BUG-SMOKE-03 |
| 13 | `/shops/S103` | Yes | None | None | PASS w/ BUG-SMOKE-03 |
| 14 | `/orders/ORD1019` | Yes | None | **1 error** (React #418, reproduced on reload) | PASS w/ BUG-SMOKE-01 |
| 15 | `/qa-nope` (bogus) | Yes | Custom 404 shown as designed: `404` / `Page not found` / "The page you are looking for does not exist or has been moved." + `Go to Shops` link | n/a (expected) | PASS |

**Global nav check:** sidebar on every page shows exactly the 10 required items: Shops, Orders, AI Memory, Exceptions, Voice AI, Catalog, Deliveries, Payments, Schemes, Routes. Sidebar footer text: "AI Order Co-Pilot for FMCG distributors." / "Live demo · data from Supabase".

---

## 2. Baseline numbers (verbatim, captured 24 Aug 2026)

> Later testers: diff against these. Values are quoted exactly as rendered.

### `/shops`
Stat cards:
- TOTAL SHOPS: **5**
- CREDIT AT RISK: **0**
- OVERDUE VISITS: **5**
- ORDERS PLACED: **5**

Subtitle above cards: "5 stores".

Credit cells per shop row (available / owed):
| Shop | Available | Owed |
|------|-----------|------|
| Kannan Stores · S101 | ₹2,500 | ₹7,500 owed |
| Murugan Store · S102 | ₹4,500 | ₹500 owed |
| Shanthi General Store · S103 | ₹6,000 | ₹2,000 owed |
| Lakshmi Traders · S104 | ₹9,000 | ₹3,000 owed |
| Anand Provision Store · S105 | ₹500 | ₹5,500 owed |

Cross-check vs seed spec: S101 ₹10,000 limit − ₹7,500 outstanding = ₹2,500 available ✓. Every row also shows flag "Visit due"; last orders 9–14 Aug 2026 (9–15 days ago).

### `/orders`
- TOTAL ORDERS: **5**
- ORDER VALUE: **₹4,315**
- ACTIVE: **0**
- DELIVERED: **5**

Rows: ORD1019 Kannan ₹1,400 Delivered/Paid; ORD1020 Murugan ₹825; ORD1021 Shanthi ₹670; ORD1022 Lakshmi ₹1,200; ORD1023 Anand ₹220. Row sum = ₹4,315 = stat card ✓.

### `/payments`
- TOTAL COLLECTED: **₹0**
- CREDIT NOTES: **₹0**
- TOTAL ORDERS: **₹4,315** (matches `/orders` ORDER VALUE ✓)
- NET POSITION: **-₹4,315**

Payment History ledger shows rows typed `payment` / `credit_note` / `order`, but most non-order rows render "—" in Date/Method/Reference/Amount columns (see Observations).

### `/catalog`
Stat cards: TOTAL PRODUCTS **33** · ACTIVE **33** · INACTIVE **0** · LOW STOCK **0**. Subtitle: "33 products".

Stock column values (re-verified after hard reload via DOM query):
- P010 Surf Excel Matic Top Load 4kg → Stock **0**
- P002 Clinic Plus Shampoo 340ml → Stock **0**
- P015 Wheel Active 1kg → Stock **0**

⚠️ All 33 SKUs display Stock **0** — see BUG-SMOKE-02 before diffing this number.

### `/exceptions`
Stat cards: LOW STOCK **1** · CREDIT RISK **0** · PENDING ORDERS **0** · OPEN COMPLAINTS **1**.

**Open returns listed: 1** — "Rin Soap 250g x 24 × 1", badge "Photo Received", status dropdown "Current: Photo received", reason "Damaged goods", "Created: 23 Aug 2026".

Low-stock row: "Surf Excel Matic Top Load 4kg … AVAILABLE 3 / 5, THRESHOLD 5, RESTOCK BY 18 Aug 2026" (contradicts catalog — see BUG-SMOKE-02).

---

## 3. Bug list

### BUG-SMOKE-01 — React hydration error #418 on `/memory` and `/orders/ORD1019` (console, error level)
- **Severity:** Medium
- **Repro:** Navigate to `/memory` (or `/orders/ORD1019`) → open console. Also reproduces after hard reload (Ctrl-shift-R equivalent, cache bypassed).
- **Console evidence:** `Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= …` (React #418 = hydration text-content mismatch between server HTML and client render).
- **Expected:** zero error-level console messages.
- **Actual:** 1 error on each of the two routes; pages still render fully.
- **Notes for later testers:** both affected pages render timestamps in the form "23 Aug, 06:44 am" ("CREATED AT" on order detail; memory card timestamps). Timezone/locale-sensitive formatting is the prime suspect — verify on your modules if you show similar timestamps.
- **Not affected (clean console):** /shops, /orders, /deliveries, /payments, /admin/schemes, /admin/routes, all three shop detail pages.

### BUG-SMOKE-02 — `/catalog` Stock column shows 0 for all 33 products; contradicts `/exceptions` low-stock data
- **Severity:** High
- **Repro:** Open `/catalog`; observe Stock column = `0` for every SKU (incl. P010, P002, P015) and stat card LOW STOCK = `0`. Hard reload does not change it. Then open `/exceptions`: LOW STOCK = `1` with row "Surf Excel Matic Top Load 4kg … 3 / 5".
- **Expected:** Catalog stock reflects real availability (P010 should read 3 per Exceptions; LOW STOCK should be ≥ 1).
- **Actual:** Every product renders Stock `0`; catalog's own LOW STOCK card says `0`.
- **Evidence quotes:** catalog row `"P010 | Surf Excel Matic Top Load 4kg | Surf Excel | Home Care | pack | ₹720 | 18% | 0 | Active"`; exceptions row `"Surf Excel Matic Top Load 4kg … 3 / 5 … 5 … 18 Aug 2026"`.
- **Impact:** Distributor sees zero stock across the whole catalog; low-stock signal dead on this page. Data is fetched server-side (no client XHR to inspect), so field-mapping mismatch (e.g., reading wrong column) is likely.

### BUG-SMOKE-03 — Shop detail subtitle renders raw template placeholders
- **Severity:** Medium
- **Repro:** Open `/shops/S101`, `/shops/S102`, or `/shops/S103`; look at the line under the shop name heading.
- **Expected:** e.g. `Kannan · S101 · 919840011234`.
- **Actual:** literal uninterpolated string — S101: `Kannan · {shop.shop_id} · {shop.phone_number}`; S102: `Murugan · {shop.shop_id} · {shop.phone_number}`; S103: `Shanthi · {shop.shop_id} · {shop.phone_number}`. (Phone is correctly displayed further down in the Profile card.)
- **Scope note:** only S101–S103 were in scope; S104/S105 detail pages presumably affected too (untested here).

### BUG-SMOKE-04 — `/catalog` duplicated `<h1>` and nested `<main>` landmarks
- **Severity:** Low
- **Repro:** Inspect `/catalog` DOM/a11y tree: two level-1 headings both reading "Product Catalog", and a `<main>` element nested inside the layout `<main>`.
- **Expected:** single h1, single main landmark.
- **Actual:** duplicate header block from an embedded page component.
- **Related cosmetic:** page title format inconsistent — `Product Catalog | Shree Agencies · Lyra` vs `Shops · Lyra` style elsewhere.

---

## 4. Observations (not counted as bugs)

1. DevTools issue-level notices (not error-level, so sweep passes): "A form field element should have an id or name attribute" on `/exceptions` (count 1), `/voice` (count 3), `/catalog` (count 1); "No label associated with a form field" on `/catalog` (count 1).
2. `/deliveries` is entirely empty: TOTAL DELIVERIES/TODAY/COMPLETED/PARTIAL all `0`, empty state "No deliveries yet" — while every seeded order has status "Delivered". Deliveries tester to confirm whether deliveries were simply never recorded in seed.
3. `/payments` Payment History: many ledger rows of type `payment` / `credit_note` render "—" for Date, Method, Reference, Amount; the five `order` rows do show dates ("23 Aug 2026") and negative amounts ("-₹1,400", "-₹220", "-₹670", "-₹825", "-₹1,200"). Looks like sparse seed data rather than a rendering fault, but worth scrutiny by the payments tester.
4. `/orders/ORD1019` subtitle casing inconsistency: "Status: delivered" (lowercase) vs ORDER STATUS field "Delivered".
5. `/shops` CREDIT AT RISK = 0 is consistent with "Credit healthy — No shop is over its limit." on `/exceptions`.
6. ORD1019 math verified: 2×₹155 + 1×₹210 + 1×₹880 = ₹1,400 = header Total/Credit Used ✓.

## 5. Residue created

**None.** Read-only session: no mutating button clicked (Add/Edit/Deactivate/Payment/Create*/Start call/Return all untouched); no form submitted; no QA-prefixed entities created.
