-- ============================================================================
-- Lyra MIS Portal — Phase 0 Database Migration
-- Complete end-to-end operations portal for Shree Agencies FMCG distributor
-- Run this AFTER the initial schema (20260816000000_initial_schema.sql)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0.1 NEW TABLES
-- ============================================================================

-- payments: every cash/cheque/upi collection against a shop
CREATE TABLE public.payments (
  payment_id      BIGSERIAL PRIMARY KEY,
  shop_id         TEXT NOT NULL REFERENCES public.shops(shop_id),
  order_id        TEXT REFERENCES public.orders(order_id),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method          TEXT NOT NULL, -- 'cash', 'cheque', 'upi', 'bank', 'credit_note', 'adjustment'
  reference       TEXT, -- cheque no, UPI ref, etc.
  collected_by    TEXT, -- salesperson name
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX idx_payments_shop ON public.payments(shop_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_collected_at ON public.payments(collected_at);

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
CREATE INDEX idx_deliveries_date ON public.deliveries(delivery_date);

-- delivery_items: actual qty delivered per line (supports short delivery)
CREATE TABLE public.delivery_items (
  delivery_item_id BIGSERIAL PRIMARY KEY,
  delivery_id      BIGINT NOT NULL REFERENCES public.deliveries(delivery_id) ON DELETE CASCADE,
  order_item_id    BIGINT NOT NULL REFERENCES public.order_items(order_item_id),
  delivered_qty    NUMERIC(12,2) NOT NULL CHECK (delivered_qty >= 0),
  returned_qty     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (returned_qty >= 0)
);

CREATE INDEX idx_delivery_items_delivery ON public.delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_order_item ON public.delivery_items(order_item_id);

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
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at);

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
CREATE INDEX idx_order_status_log_created_at ON public.order_status_log(created_at);

-- ============================================================================
-- 0.2 TRIGGERS / FUNCTIONS
-- ============================================================================

-- When payment inserted → reduce shop.outstanding_balance
CREATE OR REPLACE FUNCTION public.apply_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.shops
  SET outstanding_balance = GREATEST(outstanding_balance - NEW.amount, 0),
      updated_at = NOW()
  WHERE shop_id = NEW.shop_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_applied
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.apply_payment();

-- When return credit_issued → reduce outstanding_balance
CREATE OR REPLACE FUNCTION public.apply_credit_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'credit_issued' AND OLD.status != 'credit_issued' THEN
    UPDATE public.shops
    SET outstanding_balance = GREATEST(outstanding_balance - NEW.credit_note_amount, 0),
        updated_at = NOW()
    WHERE shop_id = NEW.shop_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_return_credit_issued
AFTER UPDATE ON public.returns
FOR EACH ROW EXECUTE FUNCTION public.apply_credit_note();

-- When order status changes → log to order_status_log
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.order_status IS DISTINCT FROM NEW.order_status THEN
    INSERT INTO public.order_status_log (order_id, old_status, new_status, changed_by, notes)
    VALUES (NEW.order_id, OLD.order_status, NEW.order_status, COALESCE(NEW.created_by, 'SYSTEM'), NULL);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_order_status_log
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- When delivery completed → decrement inventory, create stock_movements
CREATE OR REPLACE FUNCTION public.record_delivery_stock_out()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  di RECORD;
  inv RECORD;
BEGIN
  -- Only fire when status changes TO 'delivered' from something else
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- For each delivery_item, reduce inventory and create stock_movement
    FOR di IN
      SELECT di.order_item_id, di.delivered_qty, oi.product_id
      FROM public.delivery_items di
      JOIN public.order_items oi ON oi.order_item_id = di.order_item_id
      WHERE di.delivery_id = NEW.delivery_id
    LOOP
      -- Update inventory (reduce available_qty)
      UPDATE public.inventory
      SET available_qty = GREATEST(available_qty - di.delivered_qty, 0)
      WHERE product_id = di.product_id;

      -- Create stock_movement record
      INSERT INTO public.stock_movements (product_id, change_qty, reason, reference_id, reference_type, performed_by)
      VALUES (di.product_id, -di.delivered_qty, 'order_delivery', NEW.delivery_id::TEXT, 'delivery', NEW.delivery_person);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_delivery_stock_out
AFTER INSERT OR UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.record_delivery_stock_out();

-- When return received/collected → increment inventory, create stock_movement
CREATE OR REPLACE FUNCTION public.record_return_stock_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- When return status changes to 'collected' or 'credit_issued', add stock back
  IF NEW.status IN ('collected', 'credit_issued') AND OLD.status NOT IN ('collected', 'credit_issued') THEN
    -- Update inventory (increase available_qty)
    UPDATE public.inventory
    SET available_qty = available_qty + NEW.quantity
    WHERE product_id = NEW.product_id;

    -- Create stock_movement record
    INSERT INTO public.stock_movements (product_id, change_qty, reason, reference_id, reference_type, performed_by)
    VALUES (NEW.product_id, NEW.quantity, 'return_received', NEW.return_id::TEXT, 'return', 'SYSTEM');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_return_stock_in
AFTER UPDATE ON public.returns
FOR EACH ROW EXECUTE FUNCTION public.record_return_stock_in();

-- ============================================================================
-- 0.3 SCHEMA EXTENSIONS (ALTER TABLE)
-- ============================================================================

-- Add invoice_number to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add gst_number and address to shops
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add is_deleted and supplier_id to products (soft delete)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS supplier_id TEXT;

-- Update products index to account for is_deleted
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products (is_deleted) WHERE is_deleted = FALSE;

-- ============================================================================
-- 0.4 HELPER VIEWS (Extended)
-- ============================================================================

-- Shop payment ledger with running balance
CREATE OR REPLACE VIEW public.shop_payment_ledger
WITH (security_invoker = true) AS
SELECT
  s.shop_id,
  s.shop_name,
  s.credit_limit,
  s.outstanding_balance,
  (s.credit_limit - s.outstanding_balance) AS available_credit,
  CASE WHEN s.credit_limit - s.outstanding_balance < 0 THEN TRUE ELSE FALSE END AS credit_exceeded,
  p.payment_id::TEXT AS entry_id,
  p.amount,
  p.method,
  p.reference,
  p.collected_by,
  p.collected_at,
  p.notes,
  'payment' AS entry_type
FROM public.shops s
LEFT JOIN public.payments p ON p.shop_id = s.shop_id
UNION ALL
SELECT
  s.shop_id,
  s.shop_name,
  s.credit_limit,
  s.outstanding_balance,
  (s.credit_limit - s.outstanding_balance) AS available_credit,
  CASE WHEN s.credit_limit - s.outstanding_balance < 0 THEN TRUE ELSE FALSE END AS credit_exceeded,
  r.return_id::TEXT AS entry_id,
  r.credit_note_amount AS amount,
  'credit_note' AS method,
  r.reason AS reference,
  NULL AS collected_by,
  r.created_at AS collected_at,
  r.reason AS notes,
  'credit_note' AS entry_type
FROM public.shops s
LEFT JOIN public.returns r ON r.shop_id = s.shop_id AND r.status = 'credit_issued'
UNION ALL
SELECT
  s.shop_id,
  s.shop_name,
  s.credit_limit,
  s.outstanding_balance,
  (s.credit_limit - s.outstanding_balance) AS available_credit,
  CASE WHEN s.credit_limit - s.outstanding_balance < 0 THEN TRUE ELSE FALSE END AS credit_exceeded,
  o.order_id AS entry_id,
  -o.total_amount AS amount,
  'order' AS method,
  o.invoice_number AS reference,
  o.created_by AS collected_by,
  o.created_at AS collected_at,
  NULL AS notes,
  'order' AS entry_type
FROM public.shops s
LEFT JOIN public.orders o ON o.shop_id = s.shop_id AND o.order_status = 'delivered'
ORDER BY shop_id, collected_at DESC;

-- Delivery summary with order details
CREATE OR REPLACE VIEW public.delivery_summary
WITH (security_invoker = true) AS
SELECT
  d.delivery_id,
  d.order_id,
  o.shop_id,
  s.shop_name,
  d.delivery_date,
  d.delivery_slot,
  d.vehicle_no,
  d.delivery_person,
  d.status,
  d.pod_photo_url,
  d.notes,
  d.created_at,
  COUNT(di.delivery_item_id) AS total_lines,
  SUM(di.delivered_qty) AS total_qty_delivered,
  SUM(di.returned_qty) AS total_qty_returned
FROM public.deliveries d
JOIN public.orders o ON o.order_id = d.order_id
JOIN public.shops s ON s.shop_id = o.shop_id
LEFT JOIN public.delivery_items di ON di.delivery_id = d.delivery_id
GROUP BY d.delivery_id, d.order_id, o.shop_id, s.shop_name, d.delivery_date, d.delivery_slot, d.vehicle_no, d.delivery_person, d.status, d.pod_photo_url, d.notes, d.created_at;

-- ============================================================================
-- 0.5 RLS POLICIES (Permissive for hackathon demo)
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'payments','deliveries','delivery_items','stock_movements','order_status_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      'p_all_access_' || t, t
    );
  END LOOP;
END $$;

COMMIT;