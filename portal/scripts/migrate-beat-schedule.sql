-- =============================================
-- BEAT SCHEDULE MIGRATION
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mxjsnhbziewlpnsybbvq/sql/new
-- =============================================

-- 1. Add beat_day and delivery_days to routes
ALTER TABLE routes ADD COLUMN IF NOT EXISTS beat_day INTEGER CHECK (beat_day BETWEEN 1 AND 6);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS delivery_days INTEGER DEFAULT 3;

-- 2. Create beat_calls table
CREATE TABLE IF NOT EXISTS beat_calls (
  id BIGSERIAL PRIMARY KEY,
  call_date DATE NOT NULL DEFAULT CURRENT_DATE,
  route_id TEXT NOT NULL REFERENCES routes(route_id),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','calling','completed','failed','skipped')),
  order_id TEXT REFERENCES orders(order_id),
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beat_calls_date_route ON beat_calls(call_date, route_id);
CREATE INDEX IF NOT EXISTS idx_beat_calls_shop ON beat_calls(shop_id);

-- 3. Seed beat days (Mon-Sat rotation)
UPDATE routes SET beat_day = 1, delivery_days = 3 WHERE route_id = 'R001';
UPDATE routes SET beat_day = 2, delivery_days = 3 WHERE route_id = 'R002';
UPDATE routes SET beat_day = 3, delivery_days = 3 WHERE route_id = 'R003';
UPDATE routes SET beat_day = 4, delivery_days = 3 WHERE route_id = 'R004';
UPDATE routes SET beat_day = 5, delivery_days = 3 WHERE route_id = 'R005';
-- R006 (Saturday) reserved for make-up calls

-- 4. Create auto-deliver function (called by cron)
CREATE OR REPLACE FUNCTION auto_complete_deliveries()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE orders
  SET order_status = 'delivered'
  WHERE order_status = 'confirmed'
    AND delivery_date <= CURRENT_DATE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to generate today's beat calls
CREATE OR REPLACE FUNCTION generate_today_beat_calls()
RETURNS TABLE(shop_id TEXT, shop_name TEXT, route_id TEXT) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO beat_calls (call_date, route_id, shop_id, status)
  SELECT 
    CURRENT_DATE,
    r.route_id,
    s.shop_id,
    'pending'
  FROM shops s
  JOIN routes r ON r.route_id = s.beat_route_id
  WHERE r.beat_day = EXTRACT(DOW FROM CURRENT_DATE)::INTEGER
    AND s.opt_out = FALSE
    AND s.voice_consent = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM beat_calls bc 
      WHERE bc.call_date = CURRENT_DATE 
        AND bc.shop_id = s.shop_id
    )
  RETURNING beat_calls.shop_id, shops.shop_name, beat_calls.route_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Verify
SELECT r.route_id, r.route_name, r.beat_day, r.delivery_days,
  CASE r.beat_day
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name,
  (SELECT COUNT(*) FROM shops WHERE beat_route_id = r.route_id AND opt_out = FALSE) as shop_count
FROM routes r
WHERE r.is_active = TRUE
ORDER BY r.beat_day;
