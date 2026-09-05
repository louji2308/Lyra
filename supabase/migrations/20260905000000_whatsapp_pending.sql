-- ============================================================================
-- whatsapp_pending queue: agents queue messages, office sends manually from dashboard
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_pending (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         TEXT NOT NULL REFERENCES public.shops(shop_id) ON DELETE CASCADE,
  order_id        TEXT,
  kind            TEXT NOT NULL DEFAULT 'summary',
  message         TEXT NOT NULL,
  wa_link         TEXT,
  whatsapp_number TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  agent_role      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_status ON public.whatsapp_pending (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_shop   ON public.whatsapp_pending (shop_id);

-- ---------------------------------------------------------------------------
-- RLS: permissive anon/authenticated policies (same pattern as initial schema)
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_pending ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_pending' AND policyname='p_all_access_whatsapp_pending'
  ) THEN
    CREATE POLICY p_all_access_whatsapp_pending ON public.whatsapp_pending FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;