-- ============================================================================
-- Multi-agent MVP (v3) — Phase A: foundation for shop_phones, today_notes,
-- order lifecycle (confirmed/pending), and optional onboarding columns.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 Multiple phone numbers per shop
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_phones (
  phone_id     BIGSERIAL PRIMARY KEY,
  shop_id      TEXT NOT NULL REFERENCES public.shops(shop_id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_shop_phones_shop   ON public.shop_phones (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_phones_number ON public.shop_phones (phone_number);

-- ---------------------------------------------------------------------------
-- 4.2 Today's details / support notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.today_notes (
  note_id     BIGSERIAL PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES public.shops(shop_id) ON DELETE CASCADE,
  note_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  note_type   TEXT NOT NULL DEFAULT 'general',
  note_text   TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'AI',
  agent_role  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_today_notes_shop ON public.today_notes (shop_id);
CREATE INDEX IF NOT EXISTS idx_today_notes_date ON public.today_notes (note_date);

-- ---------------------------------------------------------------------------
-- 4.1b Optional onboarding column on shops (business_type)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS business_type TEXT;

-- ---------------------------------------------------------------------------
-- 4.3 Order lifecycle support
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmed_order BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS credit_checked  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_reason  TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_confirmed ON public.orders (confirmed_order);

-- ---------------------------------------------------------------------------
-- 4.5 RLS: permissive anon/authenticated policies (same pattern as initial schema)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shop_phones', 'today_notes']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'p_all_access_' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
        'p_all_access_' || t, t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Phase A (step 2): backfill shop_phones from existing shops.phone_number
-- (one-time, idempotent — guarded so re-runs do not duplicate).
-- ---------------------------------------------------------------------------
INSERT INTO public.shop_phones (shop_id, phone_number, label, is_primary)
SELECT
  s.shop_id,
  s.phone_number,
  'primary',
  TRUE
FROM public.shops s
WHERE NOT EXISTS (
  SELECT 1 FROM public.shop_phones sp
  WHERE sp.shop_id = s.shop_id AND sp.phone_number = s.phone_number
);

COMMIT;
