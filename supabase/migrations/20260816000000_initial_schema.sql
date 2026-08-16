-- ============================================================================
-- Lyra 2.0 — Data Brain: Schema
-- AI Order Co-Pilot for FMCG distributors (Shree Agencies demo)
--
-- Run this in the Supabase SQL Editor (or `supabase db push` when CLI is set up).
-- To create everything, run this file first, then run supabase/seed.sql.
--
-- NOTE: RLS is intentionally OFF for the hackathon demo (no login system).
-- Enable RLS + policies before any production use.
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE public.app_language AS ENUM (
  'tamil', 'tanglish', 'hindi', 'english'
);

CREATE TYPE public.memory_type AS ENUM (
  'timing',
  'language',
  'product_preference',
  'negative_memory',
  'payment_behavior',
  'complaint_history'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending', 'partial', 'paid', 'overdue'
);

CREATE TYPE public.order_status AS ENUM (
  'draft',
  'awaiting_confirmation',
  'confirmed',
  'payment_pending',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'exception'
);

CREATE TYPE public.complaint_type AS ENUM (
  'damaged_goods', 'wrong_order', 'late_delivery', 'price_issue', 'other'
);

CREATE TYPE public.severity AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE public.call_sentiment AS ENUM (
  'positive', 'neutral', 'negative', 'angry'
);

CREATE TYPE public.return_status AS ENUM (
  'requested', 'photo_received', 'approved', 'collected', 'credit_issued', 'rejected'
);

CREATE TYPE public.scheme_benefit_type AS ENUM (
  'discount', 'free_units', 'cashback'
);

-- ============================================================================
-- ROUTES (sales beats)
-- ============================================================================

CREATE TABLE public.routes (
  route_id        TEXT PRIMARY KEY,
  route_name      TEXT NOT NULL,
  salesperson     TEXT,
  coverage_area   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- SHOPS (kirana stores)
-- ============================================================================

CREATE TABLE public.shops (
  shop_id             TEXT PRIMARY KEY,
  shop_name           TEXT NOT NULL,
  owner_name          TEXT,
  phone_number        TEXT NOT NULL UNIQUE,
  whatsapp_number     TEXT,
  preferred_language  public.app_language NOT NULL DEFAULT 'tanglish',
  preferred_call_start TIME,
  preferred_call_end   TIME,
  beat_route_id       TEXT REFERENCES public.routes(route_id),
  visit_gap_days      INTEGER NOT NULL DEFAULT 7,
  credit_limit        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (outstanding_balance >= 0),
  voice_consent       BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_consent    BOOLEAN NOT NULL DEFAULT TRUE,
  opt_out             BOOLEAN NOT NULL DEFAULT FALSE,
  last_order_date     DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shops_route ON public.shops (beat_route_id);

-- ============================================================================
-- PRODUCTS (FMCG catalog, database-only pricing)
-- ============================================================================

CREATE TABLE public.products (
  product_id   TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand        TEXT,
  category     TEXT NOT NULL,
  unit_type    TEXT NOT NULL,
  price        NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  tax_rate     NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  launch_date  DATE
);

CREATE INDEX idx_products_category ON public.products (category);
CREATE INDEX idx_products_brand ON public.products (brand);

-- ============================================================================
-- INVENTORY (stock truth, source for available-to-promise)
-- ============================================================================

CREATE TABLE public.inventory (
  inventory_id       BIGSERIAL PRIMARY KEY,
  product_id         TEXT NOT NULL UNIQUE REFERENCES public.products(product_id),
  available_qty      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  reserved_qty       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  restock_date       DATE,
  low_stock_threshold NUMERIC(12,2) NOT NULL DEFAULT 5
);

-- ============================================================================
-- SCHEMES (promotions / offers)
-- ============================================================================

CREATE TABLE public.schemes (
  scheme_id            TEXT PRIMARY KEY,
  scheme_name          TEXT NOT NULL,
  start_date           DATE NOT NULL,
  end_date             DATE,
  eligible_product_ids TEXT[] NOT NULL DEFAULT '{}',
  minimum_quantity     NUMERIC(12,2) NOT NULL DEFAULT 1,
  benefit_type         public.scheme_benefit_type NOT NULL,
  benefit_value        NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- CALL LOGS (what happened in each call, incl. language detection)
-- ============================================================================

CREATE TABLE public.call_logs (
  call_id           TEXT PRIMARY KEY,
  shop_id           TEXT NOT NULL REFERENCES public.shops(shop_id),
  start_time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time          TIMESTAMPTZ,
  language_detected public.app_language,
  sentiment         public.call_sentiment NOT NULL DEFAULT 'neutral',
  order_placed      BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_sent     BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_to_human BOOLEAN NOT NULL DEFAULT FALSE,
  transcript_summary TEXT
);

CREATE INDEX idx_call_logs_shop ON public.call_logs (shop_id);
CREATE INDEX idx_call_logs_start ON public.call_logs (start_time);

-- ============================================================================
-- ORDERS (order header)
-- ============================================================================

CREATE TABLE public.orders (
  order_id       TEXT PRIMARY KEY,
  shop_id        TEXT NOT NULL REFERENCES public.shops(shop_id),
  call_id        TEXT REFERENCES public.call_logs(call_id),
  order_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date  DATE,
  delivery_slot  TEXT,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  credit_used    NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  order_status   public.order_status NOT NULL DEFAULT 'draft',
  created_by     TEXT NOT NULL DEFAULT 'AI',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_shop ON public.orders (shop_id);
CREATE INDEX idx_orders_date ON public.orders (order_date);
CREATE INDEX idx_orders_status ON public.orders (order_status);

-- ============================================================================
-- ORDER ITEMS (line items)
-- ============================================================================

CREATE TABLE public.order_items (
  order_item_id BIGSERIAL PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES public.products(product_id),
  quantity      NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit          TEXT NOT NULL,
  price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX idx_order_items_order ON public.order_items (order_id);
CREATE INDEX idx_order_items_product ON public.order_items (product_id);

-- ============================================================================
-- SHOP MEMORY (AI-learned preferences)
-- ============================================================================

CREATE TABLE public.shop_memory (
  memory_id       BIGSERIAL PRIMARY KEY,
  shop_id         TEXT NOT NULL REFERENCES public.shops(shop_id),
  memory_text     TEXT NOT NULL,
  memory_type     public.memory_type NOT NULL,
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shop_memory_shop ON public.shop_memory (shop_id);
CREATE INDEX idx_shop_memory_type ON public.shop_memory (memory_type);

-- ============================================================================
-- BLACKLIST (products a shop never wants pitched)
-- ============================================================================

CREATE TABLE public.blacklist (
  blacklist_id BIGSERIAL PRIMARY KEY,
  shop_id      TEXT NOT NULL REFERENCES public.shops(shop_id),
  product_id   TEXT NOT NULL REFERENCES public.products(product_id),
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, product_id)
);

CREATE INDEX idx_blacklist_shop ON public.blacklist (shop_id);

-- ============================================================================
-- COMPLAINTS
-- ============================================================================

CREATE TABLE public.complaints (
  complaint_id       BIGSERIAL PRIMARY KEY,
  shop_id            TEXT NOT NULL REFERENCES public.shops(shop_id),
  call_id            TEXT REFERENCES public.call_logs(call_id),
  complaint_type     public.complaint_type NOT NULL,
  description        TEXT,
  severity           public.severity NOT NULL DEFAULT 'medium',
  status             TEXT NOT NULL DEFAULT 'open',
  callback_requested BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complaints_shop ON public.complaints (shop_id);
CREATE INDEX idx_complaints_status ON public.complaints (status);

-- ============================================================================
-- RETURNS
-- ============================================================================

CREATE TABLE public.returns (
  return_id         BIGSERIAL PRIMARY KEY,
  shop_id           TEXT NOT NULL REFERENCES public.shops(shop_id),
  order_id          TEXT REFERENCES public.orders(order_id),
  product_id        TEXT REFERENCES public.products(product_id),
  quantity          NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  reason            TEXT,
  photo_url         TEXT,
  credit_note_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            public.return_status NOT NULL DEFAULT 'requested',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_returns_shop ON public.returns (shop_id);
CREATE INDEX idx_returns_status ON public.returns (status);

-- ============================================================================
-- UPDATED_AT TRIGGER (keeps shops.updated_at fresh)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- HELPER VIEWS (used by business rules in Phase 5)
-- ============================================================================

-- Available credit per shop: available_credit = credit_limit - outstanding_balance
CREATE OR REPLACE VIEW public.shop_credit
WITH (security_invoker = true) AS
SELECT
  s.shop_id,
  s.shop_name,
  s.credit_limit,
  s.outstanding_balance,
  (s.credit_limit - s.outstanding_balance) AS available_credit,
  (s.credit_limit - s.outstanding_balance) < 0 AS credit_exceeded
FROM public.shops s;

-- Low-stock products (used by the stock rule)
CREATE OR REPLACE VIEW public.low_stock_products
WITH (security_invoker = true) AS
SELECT
  i.product_id,
  p.product_name,
  p.brand,
  p.category,
  p.unit_type,
  p.price,
  i.available_qty,
  i.low_stock_threshold,
  i.restock_date
FROM public.inventory i
JOIN public.products p ON p.product_id = i.product_id
WHERE i.available_qty <= i.low_stock_threshold;

-- RLS: enable on every table with a permissive policy so the anon-key portal
-- demo keeps working (single-tenant hackathon scope, no login system).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'routes','shops','products','inventory','schemes','call_logs',
    'orders','order_items','shop_memory','blacklist','complaints','returns'
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
