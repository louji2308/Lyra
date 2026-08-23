# Lyra MIS Portal — Implementation Plan
**Complete end-to-end operations portal for Shree Agencies FMCG distributor**

---

## Current State Analysis

### Existing Pages (Read-Only)
| Page | Shows | Actions |
|------|-------|---------|
| `/` | Redirects to `/shops` | None |
| `/shops` | Shop list with credit health, order counts, blacklist counts | View only → links to detail |
| `/shops/[id]` | 360° shop view: credit, profile, memory, blacklist, orders, complaints, call logs, returns | **Read-only** — no edit, confirm, resolve buttons |
| `/orders` | Order list with stats, active/history split, line items | **Read-only** — no status change, cancel, deliver |
| `/exceptions` | 5 queues: low stock, credit risk, pending orders, open complaints, open returns | **Read-only** — no resolve/close/issue-credit |
| `/catalog` | Product grid with search, filters, stock badges | **Read-only** — no product/inventory CRUD |
| `/memory` | AI memories grouped by type with confidence | **Read-only** — no confirm/delete |
| `/voice` | Voice simulator (only page with mutations via API) | Creates orders/returns/complaints/shops |

### Database Schema (13 Tables)
Core: `routes`, `shops`, `products`, `inventory`, `schemes`, `orders`, `order_items`, `call_logs`, `shop_memory`, `blacklist`, `complaints`, `returns`
Views: `shop_credit`, `low_stock_products`

### Critical Gaps Identified
1. **No dashboard** — just redirects to shops list
2. **No admin mutations** — zero create/edit/delete on any admin page
3. **No payments table** — `outstanding_balance` on shops has no transaction history
4. **No deliveries table** — `order_status` has `out_for_delivery`/`delivered` but no delivery record (actual qty, vehicle, POD)
4. **No stock movement ledger** — inventory is single row; no history of stock ins/outs
5. **No inventory decrement** on order confirmation/delivery
6. **No credit note auto-apply** — return `credit_note_amount` doesn't reduce `outstanding_balance`
7. **No order editing** (add/remove line items after creation)
8. **No audit trail** for status changes

---

## Phase 0 — Database Migrations (Foundation)

### 0.1 New Tables
```sql
-- payments: every cash/cheque/upi collection against a shop
CREATE TABLE public.payments (
  payment_id      BIGSERIAL PRIMARY KEY,
  shop_id         TEXT NOT NULL REFERENCES public.shops(shop_id),
  order_id        TEXT REFERENCES public.orders(order_id),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method          TEXT NOT NULL, -- 'cash', 'cheque', 'upi', 'bank', 'credit_note'
  reference       TEXT, -- cheque no, UPI ref, etc.
  collected_by    TEXT, -- salesperson name
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);
CREATE INDEX idx_payments_shop ON public.payments(shop_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);

-- deliveries: actual delivery execution record
CREATE TABLE public.deliveries (
  delivery_id     BIGSERIAL PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES public.orders(order_id),
  delivery_date   DATE NOT NULL,
  delivery_slot   TEXT,
  vehicle_no      TEXT,
  delivery_person TEXT,
  status          TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'partial', 'failed'
  pod_photo_url   TEXT, -- proof of delivery photo
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_deliveries_order ON public.deliveries(order_id);

-- delivery_items: actual qty delivered per line (supports short delivery)
CREATE TABLE public.delivery_items (
  delivery_item_id BIGSERIAL PRIMARY KEY,
  delivery_id      BIGINT NOT NULL REFERENCES public.deliveries(delivery_id) ON DELETE CASCADE,
  order_item_id    BIGINT NOT NULL REFERENCES public.order_items(order_item_id),
  delivered_qty    NUMERIC(12,2) NOT NULL CHECK (delivered_qty >= 0),
  returned_qty     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (returned_qty >= 0)
);
CREATE INDEX idx_delivery_items_delivery ON public.delivery_items(delivery_id);

-- stock_movements: full audit trail of inventory changes
CREATE TABLE public.stock_movements (
  movement_id     BIGSERIAL PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES public.products(product_id),
  change_qty      NUMERIC(12,2) NOT NULL, -- positive = in, negative = out
  reason          TEXT NOT NULL, -- 'restock', 'order_delivery', 'return_received', 'adjustment', 'damage', 'transfer'
  reference_id    TEXT, -- order_id, return_id, delivery_id, etc.
  reference_type  TEXT, -- 'order', 'delivery', 'return', 'manual'
  performed_by    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_ref ON public.stock_movements(reference_type, reference_id);

-- order_status_log: audit trail of every status change
CREATE TABLE public.order_status_log (
  log_id          BIGSERIAL PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES public.orders(order_id),
  old_status      public.order_status,
  new_status      public.order_status NOT NULL,
  changed_by      TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_status_log_order ON public.order_status_log(order_id);
```

### 0.2 Triggers / Functions
```sql
-- When payment inserted → reduce shop.outstanding_balance
CREATE OR REPLACE FUNCTION public.apply_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.shops
  SET outstanding_balance = GREATEST(outstanding_balance - NEW.amount, 0),
      updated_at = NOW()
  WHERE shop_id = NEW.shop_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_applied AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.apply_payment();

-- When return credit_issued → reduce outstanding_balance
CREATE OR REPLACE FUNCTION public.apply_credit_note()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'credit_issued' AND OLD.status != 'credit_issued' THEN
    UPDATE public.shops
    SET outstanding_balance = GREATEST(outstanding_balance - NEW.credit_note_amount, 0),
        updated_at = NOW()
    WHERE shop_id = NEW.shop_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_return_credit_issued AFTER UPDATE ON public.returns
FOR EACH ROW EXECUTE FUNCTION public.apply_credit_note();

-- When delivery completed → decrement inventory, create stock_movements
CREATE OR REPLACE FUNCTION public.record_delivery_stock_out()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- For each order item, create stock movement and reduce inventory
    -- (implementation in backend function)
  END IF;
  RETURN NEW;
END $$;
```

### 0.3 Schema Extensions
- Add `invoice_number` TEXT to `orders`
- Add `gst_number` TEXT to `shops`
- Add `address` TEXT to `shops`
- Add `is_deleted` BOOLEAN DEFAULT FALSE to `products` (soft delete)
- Add `supplier_id` TEXT to `products` (for future PO module)

---

## Phase 1 — Shared Infrastructure

### 1.1 Server Actions Library (`src/lib/actions.ts`)
```typescript
// Pattern: export async function actionName(input: InputType): Promise<Result>
// Uses supabaseAdmin (service role) for writes, revalidatePath for cache invalidation
// Returns { success: true, data } | { success: false, error: string }
```
- `createShop`, `updateShop`, `deleteShop` (soft: set opt_out=true)
- `updateShopCredit` (credit_limit, outstanding_balance)
- `recordPayment` (creates payment + auto-updates outstanding)
- `updateOrderStatus` (with status log + validation: draft→confirmed→out_for_delivery→delivered)
- `createDelivery` (with items, marks order delivered, decrements inventory)
- `createReturn` (from order detail, with items)
- `updateReturnStatus` (requested→photo_received→approved→collected→credit_issued)
- `resolveComplaint`, `closeComplaint`
- `confirmMemory`, `deleteMemory`
- `addBlacklist`, `removeBlacklist`
- `createProduct`, `updateProduct`, `deactivateProduct`
- `adjustInventory` (stock in/out with reason, creates stock_movement)
- `createScheme`, `updateScheme`, `deactivateScheme`
- `createRoute`, `updateRoute`, `deactivateRoute`

### 1.2 Form UI Components (`src/components/ui/`)
- `FormField`, `SelectField`, `DatePicker`, `NumberInput`, `Textarea`
- `DataTable` with sorting, pagination, row actions
- `ConfirmDialog`, `Toast` (using sonner)
- `StatusBadge` with consistent colors per enum

### 1.3 Revalidation Helpers
- `revalidateShops`, `revalidateOrders`, `revalidateShop(id)`, `revalidateCatalog`, `revalidateExceptions`

---

## Phase 2 — Shops Module

### 2.1 `/shops` Page Enhancements
- [ ] "Add Shop" button → modal/form (name, owner, phone, WhatsApp, language, route, credit_limit, call window, visit gap, address, GST)
- [ ] Inline edit: click row → edit credit_limit, route, language, visit_gap_days, consents
- [ ] "Record Payment" button per row → opens payment modal
- [ ] Toggle opt_out, whatsapp_consent, voice_consent with confirm
- [ ] Bulk actions: assign route, update credit limit

### 2.2 `/shops/[id]` Page — Make It Actionable
**Tabs:**
1. **Profile** — edit all fields, toggle consents
2. **Credit** — show ledger (payments table), "Record Payment" button, manual adjust outstanding (with audit note)
3. **Blacklist** — list + "Add to Blacklist" (product picker), "Remove" buttons
4. **Memory** — "Confirm" / "Delete" buttons per memory
5. **Orders** — existing + "Create Manual Order" button
6. **Complaints** — "Resolve" / "Close" buttons
7. **Returns** — existing + "Create Return" (from recent orders)
8. **Call Logs** — read-only (voice writes these)

### 2.3 API / Actions
- `POST /api/shops` → `createShop`
- `PATCH /api/shops/[id]` → `updateShop`
- `POST /api/shops/[id]/payment` → `recordPayment`
- `POST /api/shops/[id]/blacklist` → `addBlacklist`
- `DELETE /api/shops/[id]/blacklist/[productId]` → `removeBlacklist`
- `POST /api/shops/[id]/memory/[memoryId]/confirm` → `confirmMemory`
- `DELETE /api/shops/[id]/memory/[memoryId]` → `deleteMemory`

---

## Phase 3 — Orders Module

### 3.1 `/orders` Page
- [ ] Status filter tabs: All / Draft / Awaiting Confirmation / Confirmed / Out for Delivery / Delivered / Cancelled
- [ ] Row actions per status:
  - Draft → "Confirm", "Edit", "Delete"
  - Awaiting Confirmation → "Confirm", "Cancel"
  - Confirmed → "Schedule Delivery", "Cancel"
  - Out for Delivery → "Mark Delivered", "Mark Partial"
  - Delivered → "View Delivery"
  - Cancelled → "Restore" (if recent)
- [ ] "Create Manual Order" button (shop picker + product lines)
- [ ] Bulk confirm selected orders

### 3.2 `/orders/[id]` Page (NEW)
- Order header: status badge, shop link, dates, total, payment status
- Line items table: product, ordered qty, price, discount, line total
- **Actions bar** (context-aware):
  - `confirmOrder()` → status=confirmed, created_by='MANUAL'
  - `scheduleDelivery(date, slot)` → status=out_for_delivery, delivery_date set
  - `recordDelivery(deliveryItems[])` → creates delivery + delivery_items, status=delivered, decrements inventory
  - `cancelOrder(reason)` → status=cancelled
  - `editLines()` → add/remove/modify lines (if draft/awaiting)
- Payment section: show payments, "Record Payment" button
- Returns section: show returns for this order, "Create Return" button
- Status history log (from `order_status_log`)

### 3.3 Actions
- `confirmOrder(orderId, by)` — validates credit, blacklist, stock
- `scheduleDelivery(orderId, date, slot, by)`
- `recordDelivery(orderId, deliveryItems[], by)` — atomic: creates delivery, delivery_items, stock_movements, updates order_status, inventory
- `cancelOrder(orderId, reason, by)`

---

## Phase 4 — Deliveries Module

### 4.1 `/deliveries` Page (NEW)
- List all deliveries with filters: date range, status, vehicle, delivery person
- "Create Delivery" button (for orders in "out_for_delivery")
- Row actions: "View", "Print POD", "Reopen" (if error)

### 4.2 Delivery Creation Flow
1. Select order(s) for same route/area → assign vehicle + person + date + slot
2. Per order: show line items with ordered qty → enter delivered qty (default = ordered)
3. Short delivery: delivered < ordered → auto-create "pending" return for difference? Or just note
4. On submit: atomic transaction → delivery + delivery_items + inventory decrement + stock_movements + order_status=delivered

---

## Phase 5 — Payments & Credit Management

### 5.1 `/payments` Page (NEW)
- List all payments with filters: date, shop, method, collected_by
- "Record Payment" modal: shop picker (search), amount, method, reference, collected_by, notes
- Auto-fetch shop's outstanding_balance for reference
- Show running balance per shop

### 5.2 Shop Credit Detail (in `/shops/[id]` Credit tab)
- Ledger table: date, type (payment / credit_note / order / adjustment), amount, balance, reference
- "Record Payment" inline
- "Manual Adjustment" (with mandatory note) → creates payment with method='adjustment'

### 5.3 Credit Limit Management
- In `/shops/[id]` Profile: edit credit_limit with validation (≥ 0)
- Show "Available Credit" = limit - outstanding (from `shop_credit` view)
- Warning if new limit < current outstanding

---

## Phase 6 — Returns Workflow Completion

### 6.1 Create Return from Order Detail
- In `/orders/[id]`: "Create Return" → modal with order's line items
- Select product(s), qty, reason (damaged/expired/wrong_item/short_delivery/other)
- Optional: upload photo URL
- Creates return with status='requested', links to order

### 6.2 Returns Management (`/exceptions` → Returns tab enhanced)
- Status workflow buttons per return:
  - Requested → "Mark Photo Received" → "Approve" → "Mark Collected" → "Issue Credit Note"
  - At any step: "Reject" (with reason)
- Credit note amount auto-calculated: qty × price (from order_item) or editable
- On "Issue Credit Note": status=credit_issued → trigger reduces outstanding_balance

### 6.3 Return from Shop Page
- `/shops/[id]` Returns tab: "Create Return" (not tied to specific order, for loose returns)

---

## Phase 7 — Catalog & Inventory Admin

### 7.1 `/catalog` Page — Admin Mode
- Toggle "Admin Mode" (or separate `/admin/catalog`)
- **Add Product** modal: product_id (auto P###), name, brand, category, unit_type, price, tax_rate, supplier, is_active
- **Edit Product** inline or modal: all fields
- **Deactivate** (soft delete: is_active=false)
- **Inventory** column: show available_qty, low_stock_threshold, restock_date
  - "Adjust Stock" button → modal: +qty/-qty, reason (restock/adjustment/damage), notes
  - Creates `stock_movement`, updates `inventory.available_qty`

### 7.2 Low Stock Page (`/exceptions` Low Stock tab enhanced)
- "Create Restock" button per row → pre-fills product, reason='restock'
- Bulk restock entry

---

## Phase 8 — Schemes & Routes Admin

### 8.1 `/admin/schemes` Page (NEW)
- List with active/inactive badges, date ranges
- Create/Edit modal: name, dates, product multi-select, min_qty, benefit type (discount/free_units/cashback), value
- Toggle active/inactive

### 8.2 `/admin/routes` Page (NEW)
- List routes: route_id, name, salesperson, coverage_area, active
- Create/Edit modal
- Assign shops to route (from shops page bulk action)

---

## Phase 9 — Complaints & Memory Actions

### 9.1 Complaints (`/exceptions` Complaints tab + `/shops/[id]`)
- "Resolve" → status='resolved', resolution_notes, resolved_by, resolved_at
- "Close" → status='closed' (after resolution)
- "Escalate to Human" flag
- Filter by status: open/resolved/closed

### 9.2 Memory (`/memory` + `/shops/[id]`)
- "Confirm" → confirmed_by_user=true
- "Delete" → soft delete or hard delete
- Add manual memory: shop_id, type, text, confidence

---

## Phase 10 — Real Dashboard (`/`)

### 10.1 KPI Cards (Row 1)
- Today's Orders (confirmed + out_for_delivery)
- Today's Revenue (delivered orders total)
- Pending Deliveries (out_for_delivery count)
- Collections Due (shops with outstanding > 0, overdue visits)
- Low Stock Products (count)
- Open Exceptions (complaints + returns open)

### 10.2 Tables (Row 2)
- **Urgent Actions**: orders awaiting confirmation > 24h, shops overdue for visit, credit exceeded
- **Today's Schedule**: deliveries out_for_delivery with vehicle/person
- **Recent Activity**: last 10 payments, returns, complaints

### 10.3 Charts (Optional)
- Monthly revenue trend
- Collection efficiency %

---

## Technical Decisions & Trade-offs

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Deliveries table** | Separate table with delivery_items | Track actual vs ordered qty, POD, vehicle, person; supports partial delivery |
| **Payments table** | Yes, with trigger on shops | Proper ledger, audit trail, outstanding_balance derived not manual |
| **Stock movements** | Yes, full audit trail | Inventory is source of truth; need history for discrepancies |
| **Auth** | Defer (keep RLS open) | Hackathon scope; add Supabase Auth + RLS policies later |
| **Server Actions vs API** | Server Actions for admin forms | Cleaner for RSC forms, built-in revalidation, less boilerplate |
| **Order editing** | Only in draft/awaiting_confirmation | After confirmed → delivery flow handles changes |
| **Soft delete** | is_deleted on products, opt_out on shops | Preserves referential integrity for orders/returns |

---

## File Structure (New/Modified)

```
portal/
├── src/
│   ├── lib/
│   │   ├── actions.ts           # NEW: all server actions
│   │   ├── data.ts              # MODIFY: add admin query functions
│   │   └── utils.ts             # NEW: formatCurrency, date helpers
│   ├── components/
│   │   ├── ui/                  # NEW: FormField, DataTable, ConfirmDialog, Toast
│   │   ├── shops/               # NEW: ShopForm, ShopCreditLedger, BlacklistManager
│   │   ├── orders/              # NEW: OrderDetail, OrderActions, DeliveryForm
│   │   ├── catalog/             # NEW: ProductForm, InventoryAdjust
│   │   ├── payments/            # NEW: PaymentForm, PaymentLedger
│   │   ├── returns/             # NEW: ReturnForm, ReturnWorkflow
│   │   ├── complaints/          # NEW: ComplaintActions
│   │   ├── memory/              # NEW: MemoryActions
│   │   └── dashboard/           # NEW: KPICards, UrgentActions, ScheduleTable
│   ├── app/
│   │   ├── page.tsx             # REPLACE: real dashboard
│   │   ├── shops/
│   │   │   ├── page.tsx         # ENHANCE: add shop, inline actions
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # ENHANCE: actionable tabs
│   │   │       └── components/  # NEW: tab components
│   │   ├── orders/
│   │   │   ├── page.tsx         # ENHANCE: filters, bulk actions
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # NEW: order detail with actions
│   │   │       └── components/
│   │   ├── deliveries/
│   │   │   ├── page.tsx         # NEW
│   │   │   └── [id]/
│   │   │       └── page.tsx     # NEW: delivery detail
│   │   ├── payments/
│   │   │   └── page.tsx         # NEW
│   │   ├── catalog/
│   │   │   ├── page.tsx         # ENHANCE: admin mode toggle
│   │   │   └── components/
│   │   ├── admin/
│   │   │   ├── schemes/
│   │   │   │   └── page.tsx     # NEW
│   │   │   └── routes/
│   │   │       └── page.tsx     # NEW
│   │   ├── exceptions/
│   │   │   └── page.tsx         # ENHANCE: actionable queues
│   │   └── memory/
│   │       └── page.tsx         # ENHANCE: confirm/delete
│   └── middleware.ts            # NEW: auth check (future)
├── supabase/
│   └── migrations/
│       └── 20260823000000_mis_portal.sql  # NEW: Phase 0 migration
└── IMPLEMENTATION_PLAN.md
```

---

## Implementation Order & Dependencies

```
Phase 0 (DB) ──────────────────────────────────────►
Phase 1 (Infra) ◄──────────────────────────────────
Phase 2 (Shops) ◄── needs Phase 1
Phase 3 (Orders) ◄── needs Phase 1, 2 (shop picker)
Phase 4 (Deliveries) ◄── needs Phase 0, 3
Phase 5 (Payments) ◄── needs Phase 0, 2
Phase 6 (Returns) ◄── needs Phase 0, 3
Phase 7 (Catalog) ◄── needs Phase 0, 1
Phase 8 (Schemes/Routes) ◄── needs Phase 1
Phase 9 (Complaints/Memory) ◄── needs Phase 1, 2
Phase 10 (Dashboard) ◄── needs all prior phases
```

**Can parallelize:** Phase 2, 7, 8 after Phase 1. Phase 3, 5, 6 after Phase 2.

---

## Acceptance Criteria (Definition of Done)

### Phase 0-1
- [ ] Migration runs clean on Supabase (local + linked)
- [ ] `actions.ts` exports all functions with types
- [ ] Form components render and validate

### Phase 2 (Shops)
- [ ] Create shop → appears in list with correct credit limit
- [ ] Edit shop credit_limit → reflects in shop_credit view
- [ ] Record payment → outstanding_balance decreases, appears in ledger
- [ ] Add/remove blacklist → reflects in shop detail + order suggestions
- [ ] Confirm/delete memory → updates confirmed_by_user / removes row

### Phase 3 (Orders)
- [ ] Create manual order → status=draft, lines editable
- [ ] Confirm order → status=confirmed, credit checked, blacklist checked
- [ ] Schedule delivery → status=out_for_delivery, delivery_date set
- [ ] Record delivery → status=delivered, inventory decremented, stock_movements created
- [ ] Cancel order → status=cancelled, inventory restored if needed

### Phase 4 (Deliveries)
- [ ] Delivery list shows all with filters
- [ ] Create delivery from out_for_delivery orders
- [ ] Short delivery (delivered < ordered) tracked in delivery_items

### Phase 5 (Payments)
- [ ] Payment list with filters
- [ ] Record payment reduces outstanding_balance via trigger
- [ ] Shop credit ledger shows all transactions with running balance

### Phase 6 (Returns)
- [ ] Create return from order detail
- [ ] Return workflow: requested → photo_received → approved → collected → credit_issued
- [ ] Credit issued reduces outstanding_balance via trigger

### Phase 7 (Catalog)
- [ ] Add/edit/deactivate products
- [ ] Adjust inventory with reason → stock_movement created
- [ ] Low stock page → create restock entry

### Phase 8 (Schemes/Routes)
- [ ] CRUD schemes with date ranges, product eligibility
- [ ] CRUD routes with salesperson assignment

### Phase 9 (Complaints/Memory)
- [ ] Resolve/close complaints with notes
- [ ] Confirm/delete memories

### Phase 10 (Dashboard)
- [ ] All KPI cards show live data
- [ ] Urgent actions table actionable
- [ ] Today's schedule shows deliveries

---

## Rollout Strategy

1. **Local dev**: Run migration, test each phase with `npm run dev`
2. **Staging**: Deploy to Vercel preview, test with real Supabase project
3. **Production**: Apply migration to prod Supabase, deploy
4. **Training**: Walk Shree Agencies team through each module

---

## Notes for Future Phases (Post-MVP)

- **Purchase Orders** (supplier orders, GRN, AP)
- **Salesman App** (mobile PWA for beat planning, order taking, delivery confirmation)
- **Analytics** (product velocity, shop growth, scheme effectiveness)
- **Notifications** (WhatsApp/email for low stock, overdue payments, delivery ETA)
- **Multi-tenant** (if other agencies onboarded)
- **Role-based access** (owner, manager, salesman, accountant)

---

*Generated from deep analysis of current Lyra codebase and FMCG distributor operational requirements.*