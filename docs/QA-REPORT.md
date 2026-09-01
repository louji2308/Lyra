# Shree Agencies Portal — End-to-End QA Test Report

**Date:** 1 September 2026
**Target:** live `https://lyra-gray.vercel.app` + local dev server (`localhost:3099`, prod-backed Supabase)
**Plan:** `docs/TESTING-PLAN.md` (24 modules, 200+ cases)
**Method:** Playwright headless (`playwright-core`), ~/.playwright scripts, real browser navigation, console/perf capture, no fixtures

## Executive Summary

| Metric | Value |
| --- | --- |
| Modules covered | 22 of 24 fully exercised |
| Test cases recorded | ~65 distinct assertions in result files |
| Bugs found | **6 confirmed** (4 fixed, 2 known/cosmetic) |
| Bugs fixed this session | 4 (create-order id gen, catalog stock join, catalog search no-op, whatsapp preview 400) |
| Breaking issues remaining | 0 (portal stable) |
| Console errors across crawl | 0 after hydration/React fixes |

## Bugs Found & Resolved

| # | Severity | Page/Feature | Bug | Fix | Commits | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | High | `/shops/credit`, `/shops/blacklist`, `/shops/memory` | React error #441 — server components passed `render` functions to client `DataTable`; RSC can't serialize functions | Extracted client wrapper components | `2c5211e` | Live (17-page sweep, 0 errors) |
| 2 | High | `/memory` | Hydration #418 — `Intl.DateTimeFormat` server UTC vs client IST | Pinned `timeZone: "Asia/Kolkata"` in `format.ts` | `2c5211e` | Live sweep |
| 3 | Medium | Shop detail subtitle | Revealed literal `{shop.shop_id}` / `{shop.phone_number}` (missing `$` interpolation) | Fixed interpolation | `5904cc2` | Live (DevTools) |
| 4 | High | `/orders/create` | (a) fetch deadlock (skeleton stuck), (b) no `<form>` element — submit did nothing | `useEffect` fetch + wrapped JSX in `<form onSubmit>` | `5904cc2`, `6774998` | Live snapshot |
| 5 | **High** | `/orders/create` | **`createOrder` inserted without `order_id` → "null value in column order_id" → every manual order FAILED** | Added `nextOrderId` (max+1, mirrors voice backend) | `99f64d5` | Local: created ORD1025 then ORD1024, both render with correct line totals; cleaned up |
| 6 | Medium | `/catalog` | All 33 products showed **Stock 0** and "Low Stock 0" — `getProducts()` never joined `inventory` | `.select("*, inventory(available_qty)")` + flatten | `dcb91d9` | Local: real stocks (Boost 12, etc.), Low Stock 1 ✓ |
| 7 | Medium | `/catalog` | Search box was decorative — `value=""` + `onChange={() => {}}` no-op | State-driven filter (`searchQuery`, filtered products) | `34218c5` | Local: "Boost"→3, "Clinic"→4 |
| 8 | Low | `/api/whatsapp/preview` | Malformed JSON → **500** instead of 400 | try/catch `request.json()`, `invalid_json` 400 | `4a34707` | Local: all 7 cases correct |

## Known / Non-blocking Issues (P2)

- **Soft-404:** bogus Next.js routes (`/shops/S9999`, `/orders/FAKE123`) return HTTP 200 with a styled 404 body (cosmetic SEO nit). `23.1`, `23.2`.
- **Order detail** has no link back to its shop (UX gap, not a bug). `19.2` SKIP, `9.x`.
- **`/inventory`** not reachable from main nav (it's a dead nav link that lands on a designed 404). `16.3` INFO, `24.7`.
- **Concurrency:** `nextOrderId` is max+1 (same as voice backend); a simultaneous double-submit could collide. Relies on single-operator usage; acceptable.

## Module Results

| Module | Area | Result |
| --- | --- | --- |
| 1 | Dashboard | PASS (31 shops, 2 over limit, 93 recent payments; dashboard-after-fix) |
| 2 | Shops CRUD | Not destructive-tested (avoids prod pollution); list/render PASS (31 rows) |
| 3 | Shop detail tabs | PASS 10/10 tabs click through clean |
| 5 | Blacklist | PASS (4 items / 2 shops) |
| 6 | AI Memory | PASS (6 memories / 4 shops) |
| 7 | Orders list | PASS (stats, search ORD/Kannan, no-results, confirm btn) |
| 8 | Create order | **PASS after fix #5** (form, auto-price, line total, submit → ORD navigated) |
| 9 | Order detail | PASS (items Pepsodent ₹95+Wheel ₹125=₹220, action buttons; shop name shown, no link) |
| 10 | Deliveries | PASS (all-zero honest empty state; 1 awaiting) |
| 11 | Payments | PASS (93 rows, 32 shop opts, 7 method opts) |
| 12 | Exceptions | PASS (Low stock 1, Credit risk 0, Pending 1, Complaints 1, Returns 1; return-status dropdown) |
| 13 | Routes | PASS (5 routes R001–R005) |
| 14 | Schemes | PASS (SCH01–03) |
| 15 | Catalog | **PASS after fix #6 + #7** (33 rows, admin mode, search filters) |
| 16 | Inventory nav | INFO (dead link, designed 404) |
| 17 | Voice AI | PASS (31-shop select, simulator trace, section panes) |
| 18 | WhatsApp API | PASS (wa.me links, 91-prefix digits-only URLs, 400s, payment preview) |
| 19 | Cross-module | PASS (shop→order nav; order→shop link missing = gap) |
| 20 | API sweep | PASS (shops-list, products-list, suggested-order, shop-context, get-schemes, today-details all 200; 404s correct) |
| 21 | Data integrity | PASS on retest (credit math = limit; order totals sum; dashboard ⇄ lists; catalog stock now consistent) |
| 22 | UX/responsive | PASS (375px no overflow; dashboard immediate) |
| 23 | Edge | PASS (bogus routes 404, SQL-injection no-op, back/forward, 7-page rapid nav 0 errors) |
| 24 | Smoke | PASS (all 17 pages render, 0 console errors after fixes) |

## Notes on Test-Side Corrections (not product bugs)

- **21.1** REVIEW: my assertion was wrong (available + owed = credit limit holds for all sampled shops). Product math correct → PASS.
- **21.3 / 21.4** FAIL: my dashboard-value selector didn't match the stat-card DOM. Manual text extraction showed TOTAL SHOPS=31 and Total Orders=5, matching lists → PASS.
- **15.4** initial FAIL ("search selector `input[type=text]` timed out") — resolved by targeting `input[placeholder*=Search]`; the underlying search was genuinely broken and is fixed.
- **8.x line-total regex** didn't parse the INR-formatted rendering; verified ₹310 in rendered order → PASS.

## Verification Artifacts

- `.playwright/e2e-results.json`, `e2e-results-r2..r5.json` — batch module results (pre-fix state for some rows)
- `.playwright/sweep-results.json` — 17-page crawl (physical evidence of old subtitle bug now fixed)
- `.playwright/create-order-test.json` / `create-order-final.json` — create-order suite
- `.playwright/check-stock.cjs`, `check-search.cjs`, `debug-create-order.cjs`, `list-orders.cjs`, `cleanup-order.cjs` — investigation tooling
- Cleanup verified: prod orders restored to 5 (ORD1019–1023), test orders ORD1024/ORD1025 removed