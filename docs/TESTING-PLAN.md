# Lyra — End-to-End Test Plan

**App:** Shree Agencies FMCG Distribution Co-Pilot (Lyra)
**URL:** https://lyra-gray.vercel.app
**Date:** 31 Aug 2026
**Method:** Every page loaded in real Chrome via DevTools MCP + Playwright headless. All interactive elements catalogued from a11y snapshots. Every user flow traced before writing a single test case.

---

## 1. App Map (verified from a11y tree)

```
Overview
  +-- Dashboard (/)
Shops
  +-- All Shops (/shops)
  +-- Credit & Payments (/shops/credit)
  +-- Blacklist (/shops/blacklist)
  +-- AI Memory (/shops/memory)
Orders
  +-- All Orders (/orders)
  +-- Create Order (/orders/create)
Operations
  +-- Deliveries (/deliveries)
  +-- Routes (/admin/routes)
  +-- Payments (/payments)
  +-- Exceptions (/exceptions)
AI Co-Pilot
  +-- Voice AI (/voice)
  +-- AI Memory (/shops/memory) [duplicate]
Catalog
  +-- Products (/catalog)
  +-- Inventory (/catalog/inventory) [404 -- does not exist]
  +-- Schemes (/admin/schemes)
```

### Interactive elements per page

| Page | Buttons | Inputs | Tables |
|------|---------|--------|--------|
| `/` | 0 | 0 | 0 |
| `/shops` | 93 (31x3 + Add) | 0 | 1 (31 rows) |
| `/shops/S105` | 17 | 0 | 0 (10 tabs) |
| `/shops/credit` | 6 | 0 | 1 |
| `/shops/blacklist` | 6 | 0 | 1 |
| `/shops/memory` | 6 | 0 | 1 |
| `/orders` | 29 | 1 select + 1 search + 5 checkboxes | 1 (5 rows) |
| `/orders/create` | 6 | 0 | 0 |
| `/orders/ORD1023` | 13 | 0 | 1 (2 items) |
| `/deliveries` | 8 | 0 | 1 (1 row) |
| `/payments` | 7 | 2 selects | 1 (93 rows) |
| `/exceptions` | 7 | 0 | 1 |
| `/admin/routes` | 18 | 0 | 1 (5 rows) |
| `/admin/schemes` | 14 | 0 | 1 (3 rows) |
| `/catalog` | 7 | 1 search | 1 (33 rows) |
| `/voice` | 13 | 5 (selects + search + text) | 0 |

---

## 2. Test Environment

- **Browser:** Chrome latest via Playwright headless or Chrome DevTools MCP
- **URL:** https://lyra-gray.vercel.app
- **Data:** Live Supabase production (shared demo)
- **Auth:** None (public demo)
- **Known state:** 31 shops, 5 orders (ORD1019-1023), 33 products, 5 routes, 3 schemes, 93 payment records, 1 return, 1 complaint

---

## 3. Module 1 -- Dashboard Smoke (12 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 1.1 | Page loads without errors | Navigate `/` | Title "Dashboard", no console errors, no error boundary | P0 |
| 1.2 | Stat cards render | Read 6 stat cards | TOTAL SHOPS=31, others non-zero where expected | P0 |
| 1.3 | Revenue Summary math | Read Total/Orders/Avg | Total = sum delivered, Avg = Total/Orders | P1 |
| 1.4 | Shop Health counts | Read 4 health cards | Sum should equal total shops | P1 |
| 1.5 | Overdue Visits section | Read Urgent Actions | Each entry: shop name, days, gap, "Visit Due" badge | P1 |
| 1.6 | Open Complaints section | Read Urgent Actions | Shop name, complaint type, severity badge | P1 |
| 1.7 | Recent Payments list | Read Recent Activity | Shop names, payment types, amounts | P2 |
| 1.8 | Recent Returns list | Read Recent Activity | Product name, qty, status badge | P2 |
| 1.9 | Recent Complaints list | Read Recent Activity | Shop name, type, severity | P2 |
| 1.10 | Deliveries section | Read section | Empty state OR delivery list | P2 |
| 1.11 | Notes section | Read bottom | Note count or "No notes today" | P2 |
| 1.12 | Sidebar nav expands | Click all 6 nav groups | Each expands, sub-links navigate correctly | P0 |

---

## 4. Module 2 -- Shops CRUD (16 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 2.1 | Page loads | Navigate `/shops` | Title "Shops", "31 stores", 4 stats, table 31 rows | P0 |
| 2.2 | Stat cards | Read 4 cards | TOTAL SHOPS, CREDIT AT RISK, OVERDUE VISITS, ORDERS PLACED | P0 |
| 2.3 | Shop row data | Read any row | Name, owner, shop_id, language, credit, last order, flags | P0 |
| 2.4 | Shop link nav | Click shop name | Navigates to `/shops/{id}` | P0 |
| 2.5 | Language column | Check various rows | English/Tamil/Tanglish/Hindi correct per shop | P1 |
| 2.6 | Credit display | Check credit column | Available + owed shown, progress bar | P1 |
| 2.7 | Visit due badge | Check overdue shops | "Visit due" badge on Kannan S101, Murugan S102, etc. | P1 |
| 2.8 | Blacklist count | Check shops with blacklist | Item count shown (e.g. "3 items") | P1 |
| 2.9 | Payment button | Click "Payment" on a row | Modal opens with amount, method, reference fields | P0 |
| 2.10 | Payment submission | Fill + submit payment | Outstanding decreases, toast shown, stat updates | P0 |
| 2.11 | Edit button | Click "Edit" on a row | Modal opens with shop fields | P0 |
| 2.12 | Edit submission | Change + save | Record updated, table reflects change | P0 |
| 2.13 | Deactivate button | Click "Deactivate" | Confirmation, then shop removed from list | P1 |
| 2.14 | Add Shop button | Click "Add Shop" | Modal with new shop form | P0 |
| 2.15 | Add Shop submission | Fill + submit | New shop in table, TOTAL SHOPS increments | P0 |
| 2.16 | 404 shop | Navigate `/shops/S999` | 404 or "not found" message | P1 |

---

## 5. Module 3 -- Shop Detail (16 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 3.1 | Detail loads | Navigate `/shops/S105` | Title "Anand Provision Store", 4 stat cards | P0 |
| 3.2 | Profile tab (default) | Read tab content | Phone, WhatsApp, language, call window, visit gap, route, consent flags | P0 |
| 3.3 | Edit Profile | Click "Edit Profile" | Form opens with editable fields | P1 |
| 3.4 | Phone Numbers tab | Click tab | Phone numbers displayed | P1 |
| 3.5 | Today's Details tab | Click tab | Today's order/delivery or empty state | P1 |
| 3.6 | Credit tab | Click tab | Credit history, outstanding, limit | P1 |
| 3.7 | Blacklist tab | Click tab | Blacklisted products or empty | P1 |
| 3.8 | Memory tab | Click tab | AI memories or empty | P1 |
| 3.9 | Orders tab | Click tab | Order history for shop | P1 |
| 3.10 | Complaints tab | Click tab | Complaints or empty | P1 |
| 3.11 | Returns tab | Click tab | Returns or empty | P1 |
| 3.12 | Call Logs tab | Click tab | Call log history or empty | P1 |
| 3.13 | Rapid tab switching | Click all 10 tabs fast | No errors, no stale data | P0 |
| 3.14 | Subtitle rendering | Check subtitle text | Shows "Anand . S105 . 919840055678" NOT "{shop.shop_id}" | P0 |
| 3.15 | Different shop | Navigate `/shops/S101` | Same structure, Kannan's data | P1 |
| 3.16 | Non-existent shop | Navigate `/shops/S999` | 404 page | P1 |

---

## 6. Module 4 -- Credit Overview (6 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 4.1 | Page loads | Navigate `/shops/credit` | Title "Shop Credit & Payments", table renders | P0 |
| 4.2 | Table columns | Read headers | Shop, credit limit, outstanding, available, terms, last payment | P0 |
| 4.3 | Math consistency | Cross-check with `/shops` | Available + outstanding = limit per shop | P0 |
| 4.4 | Shop links | Click shop name | Navigates to shop detail | P1 |
| 4.5 | Back link | Click "Back to Shops" | Returns to `/shops` | P1 |
| 4.6 | No errors | Console check | Zero error messages | P0 |

---

## 7. Module 5 -- Blacklist (5 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 5.1 | Page loads | Navigate `/shops/blacklist` | Table renders or empty state | P0 |
| 5.2 | Table data | Read rows | Shop, product, reason, date per entry | P0 |
| 5.3 | Shop links | Click shop name | Navigates to detail | P1 |
| 5.4 | Empty state | No blacklist items | "No blacklisted items" message | P1 |
| 5.5 | No errors | Console check | Zero error messages | P0 |

---

## 8. Module 6 -- AI Memory (7 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 6.1 | Page loads | Navigate `/shops/memory` | Table or empty state | P0 |
| 6.2 | Table data | Read rows | Shop, type, text, confidence, confirmed, date | P0 |
| 6.3 | Confidence score | Check column | Progress bar + percentage 0-100% | P1 |
| 6.4 | Type badges | Check type column | Timing/Language/Product Preference/Negative/Payment/Complaint | P1 |
| 6.5 | Confirmed status | Check column | "Yes" green or "Pending" gray badge | P1 |
| 6.6 | Shop links | Click shop name | Navigates to detail | P1 |
| 6.7 | Hydration test | Reload + console | No React #418 hydration mismatch | P0 |

---

## 9. Module 7 -- Orders Lifecycle (19 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 7.1 | Page loads | Navigate `/orders` | Title "Orders", stats + filters + table | P0 |
| 7.2 | Stat cards | Read 4 cards | TOTAL=5, ORDER VALUE=4315, PENDING=4, CONFIRMED TODAY=0 | P0 |
| 7.3 | Filter: All | Click "All" | Shows all orders | P0 |
| 7.4 | Filter: Pending | Click "Pending (4)" | Only pending orders | P0 |
| 7.5 | Filter: Today | Click "Today's Orders" | Today's orders only | P1 |
| 7.6 | Status dropdown | Select "Draft" | Filters to draft | P1 |
| 7.7 | All dropdown options | Test all 9 status values | Each filters correctly | P1 |
| 7.8 | Search by ID | Type "ORD1023" | Only ORD1023 shown | P0 |
| 7.9 | Search by shop | Type "Kannan" | Only Kannan orders | P0 |
| 7.10 | No results search | Type "NONEXISTENT" | Empty state | P1 |
| 7.11 | Clear search | Clear + Enter | All orders reappear | P1 |
| 7.12 | Row data check | Read ORD1023 row | ID(link), shop, date, status, payment, total, delivery, actions | P0 |
| 7.13 | View button | Click "View" | Navigates to order detail | P0 |
| 7.14 | WhatsApp button | Click "WhatsApp" on pending order | Opens wa.me link or triggers flow | P0 |
| 7.15 | Confirm button | Click "Confirm" on pending | Status -> Confirmed, row updates | P0 |
| 7.16 | Cancel button | Click "Cancel" on pending | Confirmation prompt, status -> Cancelled | P0 |
| 7.17 | Create Manual Order | Click button | Navigates to `/orders/create` | P0 |
| 7.18 | Pagination | If >20 orders exist | All accessible via scroll/pagination | P2 |
| 7.19 | Column sorting | Click headers (if sortable) | Table re-sorts | P2 |

---

## 10. Module 8 -- Create Order (12 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 8.1 | Page loads | Navigate `/orders/create` | Form with shop selector, product selector, quantity | P0 |
| 8.2 | Shop selector | Click dropdown | All 31 shops listed | P0 |
| 8.3 | Product search | Type in search | Matching products shown | P0 |
| 8.4 | Add item | Select product + qty + Add | Item in summary: qty x price = subtotal | P0 |
| 8.5 | Multiple items | Add 3+ products | All listed, total correct | P0 |
| 8.6 | Remove item | Click remove/X | Item removed, total recalculates | P1 |
| 8.7 | Credit check | Exceed shop credit limit | Warning or blocked | P0 |
| 8.8 | Blacklist check | Add blacklisted product | Warning or blocked | P1 |
| 8.9 | Submit order | Fill shop + items + Submit | Order created, appears in `/orders` | P0 |
| 8.10 | No shop validation | Submit without shop | Error, not submitted | P1 |
| 8.11 | No items validation | Submit with no items | Error, not submitted | P1 |
| 8.12 | Cancel | Click back | Returns to orders, no order created | P2 |

---

## 11. Module 9 -- Order Detail (12 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 9.1 | Detail loads | Navigate `/orders/ORD1023` | Title: order ID, shop, status, date | P0 |
| 9.2 | Items table | Read items | Product, qty, unit price, total per line | P0 |
| 9.3 | Order total | Read total | Sum of line items = header total | P0 |
| 9.4 | Status badge | Read status | Correct status text + color | P0 |
| 9.5 | Payment status | Read payment | Paid/Pending/Partial shown | P0 |
| 9.6 | Confirm action | Click Confirm (if pending) | Status updates | P0 |
| 9.7 | Cancel action | Click Cancel (if pending) | Confirmation + status update | P0 |
| 9.8 | WhatsApp action | Click WhatsApp | Opens wa.me link with message | P0 |
| 9.9 | Return items | Check return section | Product, qty, reason, status shown | P1 |
| 9.10 | Return status dropdown | Change return status | Status updates (Photo Received -> Approved/Rejected) | P1 |
| 9.11 | Shop link | Click shop name | Navigates to shop detail | P1 |
| 9.12 | Back navigation | Browser back | Returns to orders list | P2 |

---

## 12. Module 10 -- Deliveries (8 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 10.1 | Page loads | Navigate `/deliveries` | Title "Deliveries", stats + table | P0 |
| 10.2 | Stat cards | Read 4 cards | TOTAL, TODAY, COMPLETED, PARTIAL | P0 |
| 10.3 | Table data | Read rows | Order ID, shop, date, status, items | P0 |
| 10.4 | Empty state | If no deliveries | "No deliveries yet" message | P1 |
| 10.5 | Per-row actions | Click action buttons on rows | Mark delivered, partial, or exception | P1 |
| 10.6 | Shop links | Click shop name | Navigates to detail | P1 |
| 10.7 | Order links | Click order ID | Navigates to order detail | P1 |
| 10.8 | No errors | Console check | Zero error messages | P0 |

---

## 13. Module 11 -- Payments (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 11.1 | Page loads | Navigate `/payments` | Title "Payments", stats + filters + table 93 rows | P0 |
| 11.2 | Stat cards | Read 3 cards | TOTAL COLLECTED, CREDIT NOTES, TOTAL ORDERS | P0 |
| 11.3 | Shop filter | Select shop from dropdown | Filters to that shop's payments | P0 |
| 11.4 | Method filter | Select payment method | Filters by method (cash/online/credit/UPI/etc.) | P1 |
| 11.5 | Combined filters | Select both shop + method | AND logic applied | P1 |
| 11.6 | Clear filters | Reset both dropdowns | All 93 rows reappear | P1 |
| 11.7 | Table data | Read rows | Shop, type, date, method, reference, amount | P0 |
| 11.8 | Payment types | Check type badges | order/payment/credit_note shown correctly | P1 |
| 11.9 | Amount formatting | Check amounts | Correct currency format (INR) | P1 |
| 11.10 | No errors | Console check | Zero error messages | P0 |

---

## 14. Module 12 -- Exceptions (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 12.1 | Page loads | Navigate `/exceptions` | Title "Exceptions", 5 stat cards | P0 |
| 12.2 | Stat cards | Read 5 cards | LOW STOCK, CREDIT RISK, PENDING ORDERS, OPEN COMPLAINTS, OPEN RETURNS | P0 |
| 12.3 | Low stock section | Read section | Product, category, available/threshold, restock date | P0 |
| 12.4 | Credit risk section | Read section | Shop name, amount over limit | P0 |
| 12.5 | Pending orders section | Read section | Order ID, shop, status, payment, total, items | P0 |
| 12.6 | Open complaints section | Read section | Shop, type, severity, callback, date, description | P0 |
| 12.7 | Open returns section | Read section | Product, qty, status badge, reason, date | P0 |
| 12.8 | Return status dropdown | Change return status | Select Approved/Rejected, status updates | P0 |
| 12.9 | Create Return button | Click "Create Return" | Form/modal opens | P1 |
| 12.10 | Shop links | Click shop names | Navigate to shop detail | P1 |

---

## 15. Module 13 -- Admin Routes (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 13.1 | Page loads | Navigate `/admin/routes` | Title "Routes & Sales Beats", 5 routes | P0 |
| 13.2 | Stat cards | Read 4 cards | TOTAL ROUTES=5, ACTIVE=5, INACTIVE=0, TOTAL SHOPS=31 | P0 |
| 13.3 | Table data | Read rows | Route ID, name, salesperson, coverage, shop count, status | P0 |
| 13.4 | Create Route | Click "Create Route" | Modal/form opens | P0 |
| 13.5 | Create submission | Fill + submit | New route appears in table | P0 |
| 13.6 | Edit button | Click "Edit" on route | Form opens with route data | P1 |
| 13.7 | Edit submission | Change + save | Route updated | P1 |
| 13.8 | Deactivate button | Click "Deactivate" | Confirmation, status -> Inactive | P1 |
| 13.9 | Shop count accuracy | Verify shop counts | Sum of route shops = total shops (31) | P1 |
| 13.10 | No errors | Console check | Zero error messages | P0 |

---

## 16. Module 14 -- Admin Schemes (8 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 14.1 | Page loads | Navigate `/admin/schemes` | Title "Promotion Schemes", 3 schemes | P0 |
| 14.2 | Table data | Read rows | Scheme ID, name, type, discount, valid dates, status | P0 |
| 14.3 | Create Scheme | Click "Create Scheme" | Form opens | P0 |
| 14.4 | Create submission | Fill + submit | New scheme appears | P0 |
| 14.5 | Edit button | Click "Edit" | Form opens with data | P1 |
| 14.6 | Edit submission | Change + save | Scheme updated | P1 |
| 14.7 | Deactivate | Click "Deactivate" | Confirmation + status change | P1 |
| 14.8 | No errors | Console check | Zero error messages | P0 |

---

## 17. Module 15 -- Product Catalog (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 15.1 | Page loads | Navigate `/catalog` | Title "Product Catalog", 33 products | P0 |
| 15.2 | Stat cards | Read 4 cards | TOTAL=33, ACTIVE=33, INACTIVE=0, LOW STOCK=0 | P0 |
| 15.3 | Table data | Read rows | SKU, product, brand, category, unit, price, GST, stock, status | P0 |
| 15.4 | Search | Type "Surf" in search | Only Surf Excel products shown | P0 |
| 15.5 | Search by brand | Type "Clinic Plus" | Only Clinic Plus products | P0 |
| 15.6 | Search by category | Type "Beverages" | Only beverage products | P1 |
| 15.7 | Clear search | Clear search | All 33 products reappear | P1 |
| 15.8 | Admin Mode toggle | Click "Admin Mode" | Edit/delete buttons appear per row | P1 |
| 15.9 | Stock values | Check stock column | Verify vs exceptions page (known bug: all show 0) | P0 |
| 15.10 | No errors | Console check | Zero error messages | P0 |

---

## 18. Module 16 -- Catalog Inventory (3 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 16.1 | Page loads | Navigate `/catalog/inventory` | Should show inventory OR 404 (currently 404) | P0 |
| 16.2 | 404 handling | If 404 | Shows custom 404 page, not crash | P1 |
| 16.3 | Nav link works | Click "Inventory" in sidebar | Navigates to inventory page | P1 |

---

## 19. Module 17 -- Voice AI (15 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 17.1 | Page loads | Navigate `/voice` | Title "Voice AI", all sections render | P0 |
| 17.2 | Shop selector | Open dropdown | All 31 shops listed with phone numbers | P0 |
| 17.3 | Shop selection | Select "Kannan Stores" | Phone shows 919840011234, language shows Tanglish | P0 |
| 17.4 | Start call (simulator) | Click "Start call (simulator)" | Call begins, greeting shown in chat | P0 |
| 17.5 | Chat input during call | Type in text input | Sends message to agent | P0 |
| 17.6 | Send button | Click "Send" | Message sent, response received | P0 |
| 17.7 | Voice toggle | Check/uncheck "Speak responses" | TTS on/off | P1 |
| 17.8 | Voice selector | Change voice dropdown | Male/Female ta-IN selected | P1 |
| 17.9 | Product search | Type in product search box | Products matching query shown | P0 |
| 17.10 | Cart display | Add items during call | Cart shows added items | P0 |
| 17.11 | Database trace | Check trace section | Shows API calls made during call | P1 |
| 17.12 | System prompt copy | Click "Copy" on system prompt | Copied to clipboard | P1 |
| 17.13 | Tools copy | Click "Copy" on tools | JSON copied to clipboard | P1 |
| 17.14 | Call flow steps | Read 16-step flow | All steps visible: Greeting through Ended | P1 |
| 17.15 | Live call buttons | Click "Live call (Twilio/Exotel)" | Either triggers live call or shows "not configured" | P1 |

---

## 20. Module 18 -- WhatsApp Integration (8 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 18.1 | Preview API | POST `/api/whatsapp/preview` with order_id | Returns wa_link, phone, message | P0 |
| 18.2 | Payment message | POST with kind="payment" | Message includes credit info + UPI ID | P0 |
| 18.3 | Order message | POST with kind="order" | Message includes itemized list | P0 |
| 18.4 | Missing consent | Use shop without consent | Returns null or consent warning | P1 |
| 18.5 | Portal WhatsApp button | Click "WhatsApp" on orders page | Opens wa.me link in new tab | P0 |
| 18.6 | wa.me link format | Check generated link | https://wa.me/91XXXXXXXXXX?text=... (digits only, no +) | P0 |
| 18.7 | Confirm API returns wa_link | POST `/api/whatsapp/confirm` | Response includes wa_link field | P0 |
| 18.8 | Payment API returns wa_link | POST `/api/whatsapp/payment` | Response includes wa_link field | P0 |

---

## 21. Module 19 -- Cross-Module Flows (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 19.1 | Shop -> Order flow | Visit shop detail -> Orders tab -> click order | Navigates shop -> order detail | P0 |
| 19.2 | Order -> Shop flow | Visit order detail -> click shop name | Navigates to shop detail | P0 |
| 19.3 | Dashboard -> Exceptions | Click COLLECTIONS DUE or OPEN COMPLAINTS | Navigates to relevant section | P1 |
| 19.4 | Exceptions -> Shop | Click shop link in exceptions | Navigates to shop detail | P0 |
| 19.5 | Credit flow | Shop list -> Payment button -> submit | Payment recorded, credit tab reflects it | P0 |
| 19.6 | Order confirm flow | Orders -> Confirm -> check order detail | Status changed, reflected everywhere | P0 |
| 19.7 | WhatsApp flow | Orders -> WhatsApp -> wa.me opens | Correct phone + message | P0 |
| 19.8 | Blacklist check | Shop with blacklist -> try order with blacklisted item | Blocked or warned | P1 |
| 19.9 | Credit limit check | Shop near limit -> create order exceeding | Warning or blocked | P1 |
| 19.10 | Return flow | Exceptions -> Create Return -> fill form | Return appears in shop detail Returns tab | P1 |

---

## 22. Module 20 -- API Endpoints (12 tests)

| # | Endpoint | Method | Test | Expected | P |
|---|----------|--------|------|----------|---|
| 20.1 | `/api/shops` | GET | Fetch all shops | Array of 31 shops | P0 |
| 20.2 | `/api/shops/S105` | GET | Fetch single shop | Shop object with all fields | P0 |
| 20.3 | `/api/orders` | GET | Fetch all orders | Array of orders | P0 |
| 20.4 | `/api/orders/ORD1023` | GET | Fetch single order | Order with items | P0 |
| 20.5 | `/api/catalog` | GET | Fetch products | Array of 33 products | P0 |
| 20.6 | `/api/whatsapp/preview` | POST | Preview WhatsApp | wa_link returned | P0 |
| 20.7 | `/api/whatsapp/confirm` | POST | Confirm order | wa_link in response | P0 |
| 20.8 | `/api/whatsapp/payment` | POST | Send payment | wa_link in response | P0 |
| 20.9 | `/api/get-schemes` | GET | Fetch schemes | Array of active schemes | P0 |
| 20.10 | `/api/get-schemes` | POST | Invalid method | 405 Method Not Allowed | P1 |
| 20.11 | Non-existent API | GET | `/api/nonexistent` | 404 response | P1 |
| 20.12 | Error handling | POST | Invalid JSON body | 400 Bad Request, not 500 | P1 |

---

## 23. Module 21 -- Data Integrity (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 21.1 | Credit math | For each shop: limit - outstanding = available | Math correct on shops list AND shop detail | P0 |
| 21.2 | Order total math | Sum line items | Equals order header total | P0 |
| 21.3 | Dashboard vs detail | TOTAL SHOPS on dashboard = count on `/shops` | Identical | P0 |
| 21.4 | Orders cross-check | TOTAL ORDERS on dashboard = `/orders` page count | Identical | P0 |
| 21.5 | Payment totals | Sum all payments | Matches payments page stat card | P1 |
| 21.6 | Route shop count | Sum shops across routes | Equals total shops (31) | P1 |
| 21.7 | Catalog stock vs exceptions | Low stock items match | Surf Excel 4kg shows correct stock on both pages | P0 |
| 21.8 | Complaint links | Open complaint in dashboard | Same complaint in exceptions page | P1 |
| 21.9 | Return consistency | Return in exceptions | Same return in shop detail Returns tab | P1 |
| 21.10 | Memory consistency | Memory in `/shops/memory` | Same memory in shop detail Memory tab | P1 |

---

## 24. Module 22 -- UI/UX & Accessibility (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 22.1 | Responsive layout | Resize to 768px width | Tables scroll horizontally, nav collapses | P1 |
| 22.2 | Mobile nav | Resize to 375px | Hamburger menu works, sidebar hidden | P1 |
| 22.3 | Loading states | Refresh pages | Skeleton/spinner shown while loading (no flash of empty) | P1 |
| 22.4 | Empty states | Pages with no data | Friendly messages, not blank screens | P1 |
| 22.5 | Toast notifications | Perform CRUD action | Success/error toast appears and auto-dismisses | P1 |
| 22.6 | Form validation | Submit empty required fields | Inline error messages | P1 |
| 22.7 | Keyboard navigation | Tab through a page | Focus order logical, visible focus ring | P2 |
| 22.8 | Consistent header | Check every page | h1 present, title format consistent | P2 |
| 22.9 | Back links | Check sub-pages | "Back to X" link present and functional | P2 |
| 22.10 | Page titles | Check `<title>` tag per page | Unique, descriptive title per page | P2 |

---

## 25. Module 23 -- Edge Cases (10 tests)

| # | Test | Steps | Expected | P |
|---|------|-------|----------|---|
| 23.1 | Bogus URL | Navigate `/shops/nonexistent` | 404 page, not crash | P0 |
| 23.2 | Bogus order ID | Navigate `/orders/FAKE123` | 404 or "not found" | P0 |
| 23.3 | SQL injection in search | Type `' OR 1=1--` in search | No error, no data leak | P0 |
| 23.4 | XSS in shop name | If name contains `<script>` | Rendered as text, not executed | P0 |
| 23.5 | Double-click submit | Double-click any Submit button | Only one record created | P1 |
| 23.6 | Rapid navigation | Click through 5+ pages fast | No stale data, no console errors | P1 |
| 23.7 | Back/forward nav | Navigate back and forward | Pages restore correctly | P1 |
| 23.8 | Large input | Paste 1000-char string in search | No crash, truncated or filtered | P2 |
| 23.9 | Negative amount | Enter -500 in payment form | Validation error | P1 |
| 23.10 | Zero quantity | Add item with qty=0 in order | Validation error or auto-corrected | P1 |

---

## 26. Module 24 -- Regression (Known Bugs)

These bugs were found in prior testing. Re-test to confirm fix or document as still broken.

| # | Bug ID | Description | Repro | Status | P |
|---|--------|-------------|-------|--------|---|
| 24.1 | BUG-SMOKE-01 | React #418 hydration mismatch on `/memory` and order detail | Navigate, check console | **FIXED** (timezone pinned) | P0 |
| 24.2 | BUG-SMOKE-02 | `/catalog` stock = 0 for all 33 products, contradicts `/exceptions` | Check catalog stock column | **KNOWN** | P0 |
| 24.3 | BUG-SMOKE-03 | Shop detail subtitle shows `{shop.shop_id}` literal text | Navigate `/shops/S101` | **TO VERIFY** | P0 |
| 24.4 | BUG-SMOKE-04 | `/catalog` has duplicate h1 and nested main landmarks | Inspect DOM | **KNOWN** | P2 |
| 24.5 | Hydration | shops/credit, shops/blacklist, shops/memory had #441 errors | Navigate pages, check console | **FIXED** (client components) | P0 |
| 24.6 | `/orders/create` | Page shows empty skeleton, no form renders | Navigate to page | **TO VERIFY** | P0 |
| 24.7 | `/catalog/inventory` | Returns 404 | Navigate to page | **TO VERIFY** | P1 |

---

## 27. Pass/Fail Criteria

### BLOCKER (must pass, zero tolerance)
- All P0 tests pass
- No React error boundaries visible
- No 500 errors on any page
- No console error-level messages on core pages (dashboard, shops, orders)
- WhatsApp wa.me links open correctly with valid phone numbers

### CRITICAL (should pass)
- All P1 tests pass
- Data integrity cross-checks pass
- All CRUD operations complete without errors
- All filters/search produce correct results

### NICE TO HAVE
- P2 tests pass
- No accessibility violations
- Loading states smooth
- Responsive layout works

### Test Execution Order
1. Module 24 (Regression) -- confirm known bugs first
2. Module 1 (Dashboard Smoke) -- baseline
3. Modules 2-6 (Shops ecosystem)
4. Modules 7-9 (Orders ecosystem)
5. Modules 10-12 (Operations)
6. Modules 13-16 (Admin/Catalog)
7. Module 17 (Voice AI)
8. Module 18 (WhatsApp)
9. Module 19 (Cross-module flows)
10. Module 20 (API endpoints)
11. Module 21 (Data integrity)
12. Modules 22-23 (UI/Edge cases)
