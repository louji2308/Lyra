-- ============================================================================
-- Lyra 2.0 — Data Brain: Seed Data
-- Sample universe for the Shree Agencies demo (run AFTER the schema migration)
--
-- Contents:
--   5 routes (beats) | 30 shops (6 per beat) | HUL-only SKU products | inventory
--   3 schemes  | 5 past orders | call logs | memory | blacklist | complaint | return
--
-- Beats (each a different area name, with a distinct set of shops):
--   R001 Tambaram Main Beat   R002 Chromepet Beat   R003 Pallavaram Beat
--   R004 Guduvancheri Beat    R005 Tiruporur Beat
--
-- All 30 shop names and phone numbers are UNIQUE. The voice agents ALWAYS
-- resolve a shop by phone -> shop_id (never by shop_name), so shops are never
-- confused even across beats.
--
-- Demo-critical scenarios baked in:
--   * Kannan Stores (S101): credit_limit 10,000, outstanding 7,500 -> available 2,500
--     -> an order of 4,200 triggers the ₹1,700 partial-payment credit rule.
--   * Surf Excel (P006): available_qty 3 -> low-stock exception fires.
--   * Kannan Stores blacklists Lux Soap AND Vim Bar (language-strategy demo).
--   * Shanthi (S103) prefers pure Tamil; Lakshmi Traders (S104) prefers Hindi
--     -> exercises the polyglot language strategy (Tamil / Hindi / Tanglish).
-- ============================================================================

BEGIN;

-- ============================================================================
-- ROUTES (5 sales beats — different area names)
-- ============================================================================

INSERT INTO public.routes (route_id, route_name, salesperson, coverage_area, is_active) VALUES
  ('R001', 'Tambaram Main Beat',   'Rajesh Kumar', 'Tambaram, Chennai',     TRUE),
  ('R002', 'Chromepet Beat',       'Kumaravel',    'Chromepet, Chennai',    TRUE),
  ('R003', 'Pallavaram Beat',      'Santhosh',     'Pallavaram, Chennai',   TRUE),
  ('R004', 'Guduvancheri Beat',    'Manikandan',   'Guduvancheri, Chennai', TRUE),
  ('R005', 'Tiruporur Beat',       'Praveen',      'Tiruporur, Chennai',    TRUE);

-- ============================================================================
-- SHOPS (30 stores, 6 per beat, all names + phones distinct)
-- ============================================================================

INSERT INTO public.shops (
  shop_id, shop_name, owner_name, phone_number, whatsapp_number, preferred_language,
  preferred_call_start, preferred_call_end, beat_route_id, visit_gap_days,
  credit_limit, outstanding_balance, voice_consent, whatsapp_consent, opt_out, last_order_date
) VALUES
  -- ---- R001 Tambaram Main Beat ----
  ('S101', 'Kannan Stores',          'Kannan',    '919840011234', '919840011234', 'tanglish', '09:00', '11:00', 'R001', 7, 10000.00, 7500.00, TRUE, TRUE, FALSE, '2026-08-10'),
  ('S102', 'Murugan Store',          'Murugan',   '919840022345', '919840022345', 'tamil',    '10:00', '12:00', 'R001', 7,  5000.00,  500.00, TRUE, TRUE, FALSE, '2026-08-12'),
  ('S103', 'Shanthi General Store',  'Shanthi',   '919840033456', '919840033456', 'tamil',    '16:00', '18:00', 'R001', 7,  8000.00, 2000.00, TRUE, TRUE, FALSE, '2026-08-13'),
  ('S110', 'Rajesh Kirana Stores',   'Rajesh',    '919840091234', '919840091234', 'tanglish', '09:00', '12:00', 'R001', 7,  7000.00, 1500.00, TRUE, TRUE, FALSE, NULL),
  ('S111', 'Meena General Stores',   'Meena',     '919840092345', '919840092345', 'tanglish', '09:30', '11:30', 'R001', 7,  6000.00, 1000.00, TRUE, TRUE, FALSE, NULL),
  ('S112', 'Raja Provision Stores',  'Raja',      '919840093456', '919840093456', 'tamil',    '10:00', '12:00', 'R001', 7,  9000.00, 3000.00, TRUE, TRUE, FALSE, NULL),

  -- ---- R002 Chromepet Beat ----
  ('S104', 'Lakshmi Traders',        'Lakshmi',   '919840044567', '919840044567', 'hindi',    '11:00', '13:00', 'R002', 7, 12000.00, 3000.00, TRUE, TRUE, FALSE, '2026-08-14'),
  ('S105', 'Anand Provision Store',  'Anand',     '919840055678', '919840055678', 'english',  '09:30', '12:30', 'R002', 7,  6000.00, 5500.00, TRUE, TRUE, FALSE, '2026-08-09'),
  ('S120', 'Selvam Super Market',    'Selvam',    '919840101234', '919840101234', 'tanglish', '09:00', '11:00', 'R002', 7,  8000.00, 2000.00, TRUE, TRUE, FALSE, NULL),
  ('S121', 'Srinivasa Stores',       'Srinivasan', '919840102345', '919840102345', 'tanglish', '10:00', '12:00', 'R002', 7,  7000.00, 1200.00, TRUE, TRUE, FALSE, NULL),
  ('S122', 'Annapoorna Provision',   'Annapoorna','919840103456', '919840103456', 'tamil',    '16:00', '18:00', 'R002', 7,  5000.00,  800.00, TRUE, TRUE, FALSE, NULL),
  ('S123', 'Ganesh Kirana',          'Ganesh',    '919840104567', '919840104567', 'tanglish', '09:30', '11:30', 'R002', 7,  9000.00, 2500.00, TRUE, TRUE, FALSE, NULL),

  -- ---- R003 Pallavaram Beat ----
  ('S907', 'QA Alpha Supermarket',   'QA Tester One', '919900000101', '919900000101', 'english', '09:00', '18:00', 'R003', 7,  8000.00, 1000.00, TRUE, TRUE, FALSE, NULL),
  ('S920', 'Vel Murugan Stores',     'Vel',       '9876543210', '9876543210',      'tanglish', '09:00', '12:00', 'R003', 7,  6000.00, 1500.00, TRUE, TRUE, FALSE, NULL),
  ('S130', 'Lakshmi Kirana',         'Lakshmi',   '919840111234', '919840111234',   'tamil',    '16:00', '18:00', 'R003', 7,  5000.00,  600.00, TRUE, TRUE, FALSE, NULL),
  ('S131', 'Valluvar Stores',        'Valluvar',  '919840112345', '919840112345',   'tanglish', '09:00', '11:00', 'R003', 7,  7000.00, 1800.00, TRUE, TRUE, FALSE, NULL),
  ('S132', 'Sundaram Traders',       'Sundaram',  '919840113456', '919840113456',   'tanglish', '10:00', '12:00', 'R003', 7,  9000.00, 2200.00, TRUE, TRUE, FALSE, NULL),
  ('S133', 'Anbu Kirana',            'Anbu',      '919840114567', '919840114567',   'tamil',    '09:30', '11:30', 'R003', 7,  5000.00,  900.00, TRUE, TRUE, FALSE, NULL),

  -- ---- R004 Guduvancheri Beat ----
  ('S090', 'Sri Murugan Provision',  'Murugesan', '9876543211', '9876543211',      'tanglish', '09:00', '12:00', 'R004', 7,  6000.00, 1000.00, TRUE, TRUE, FALSE, NULL),
  ('S140', 'Kannagi Stores',         'Kannagi',   '919840121234', '919840121234',  'tanglish', '09:30', '11:30', 'R004', 7,  7000.00, 1600.00, TRUE, TRUE, FALSE, NULL),
  ('S141', 'Murugesan Kirana',       'Murugesan', '919840122345', '919840122345',  'tamil',    '10:00', '12:00', 'R004', 7,  8000.00, 2000.00, TRUE, TRUE, FALSE, NULL),
  ('S142', 'Mani Provision Store',   'Mani',      '919840123456', '919840123456',  'tanglish', '16:00', '18:00', 'R004', 7,  6000.00, 1100.00, TRUE, TRUE, FALSE, NULL),
  ('S143', 'Rani General Store',     'Rani',      '919840124567', '919840124567',  'tanglish', '09:00', '11:00', 'R004', 7,  5000.00,  700.00, TRUE, TRUE, FALSE, NULL),
  ('S144', 'Sri Renga Stores',       'Renga',     '919840125678', '919840125678',  'tamil',    '10:00', '12:00', 'R004', 7,  9000.00, 2400.00, TRUE, TRUE, FALSE, NULL),

  -- ---- R005 Tiruporur Beat ----
  ('S439', 'Karthik Provision',      'Karthik',   '654326432',  '62542124',        'tanglish', '09:00', '12:00', 'R005', 7, 10000.00, 2000.00, TRUE, TRUE, FALSE, NULL),
  ('S150', 'Kumar Traders',          'Kumar',     '919840131234', '919840131234',  'tanglish', '09:30', '11:30', 'R005', 7,  7000.00, 1300.00, TRUE, TRUE, FALSE, NULL),
  ('S151', 'Sangeetha Provision',    'Sangeetha', '919840132345', '919840132345',  'tamil',    '10:00', '12:00', 'R005', 7,  8000.00, 2100.00, TRUE, TRUE, FALSE, NULL),
  ('S152', 'Kumaran Kirana',         'Kumaran',   '919840133456', '919840133456',  'tanglish', '16:00', '18:00', 'R005', 7,  6000.00,  950.00, TRUE, TRUE, FALSE, NULL),
  ('S153', 'Meenakshi Stores',       'Meenakshi', '919840134567', '919840134567',  'tamil',    '09:00', '11:00', 'R005', 7,  9000.00, 2800.00, TRUE, TRUE, FALSE, NULL),
  ('S154', 'Venkatesh Supply Stores', 'Venkatesh', '919840135678', '919840135678', 'tanglish', '10:00', '12:00', 'R005', 7,  7000.00, 1200.00, TRUE, TRUE, FALSE, NULL);

-- ============================================================================
-- PRODUCTS (HUL-only SKU catalog with pack-size variants)
-- ============================================================================

INSERT INTO public.products (product_id, product_name, brand, category, unit_type, price, tax_rate, is_active, launch_date) VALUES
  -- Clinic Plus Shampoo variants
  ('P001', 'Clinic Plus Shampoo 180ml',        'Clinic Plus', 'Personal Care', 'bottle',  85.00, 18.00, TRUE,  NULL),
  ('P002', 'Clinic Plus Shampoo 340ml',        'Clinic Plus', 'Personal Care', 'bottle', 155.00, 18.00, TRUE,  NULL),
  ('P003', 'Clinic Plus Shampoo 650ml',        'Clinic Plus', 'Personal Care', 'bottle', 285.00, 18.00, TRUE,  NULL),
  ('P004', 'Clinic Plus Shampoo Sachet 6ml x 50', 'Clinic Plus', 'Personal Care', 'box',    250.00, 18.00, TRUE,  '2026-08-01'),
  -- Lux Soap variants
  ('P005', 'Lux Soap 100g x 10',               'Lux',         'Personal Care', 'carton',  450.00, 18.00, TRUE,  NULL),
  ('P006', 'Lux Soap 100g x 20',               'Lux',         'Personal Care', 'carton',  880.00, 18.00, TRUE,  NULL),
  ('P007', 'Lux Soap 50g x 40',                'Lux',         'Personal Care', 'carton',  840.00, 18.00, TRUE,  NULL),
  -- Surf Excel Detergent variants
  ('P008', 'Surf Excel Matic Top Load 1kg',    'Surf Excel',  'Home Care',     'pack',    195.00, 18.00, TRUE,  NULL),
  ('P009', 'Surf Excel Matic Top Load 2kg',    'Surf Excel',  'Home Care',     'pack',    375.00, 18.00, TRUE,  NULL),
  ('P010', 'Surf Excel Matic Top Load 4kg',    'Surf Excel',  'Home Care',     'pack',    720.00, 18.00, TRUE,  NULL),
  ('P011', 'Surf Excel Easy Wash 1kg',         'Surf Excel',  'Home Care',     'pack',    155.00, 18.00, TRUE,  NULL),
  ('P012', 'Surf Excel Easy Wash 2kg',         'Surf Excel',  'Home Care',     'pack',    295.00, 18.00, TRUE,  NULL),
  -- Rin Soap variants
  ('P013', 'Rin Soap 250g x 12',               'Rin',         'Home Care',     'carton',  360.00, 18.00, TRUE,  NULL),
  ('P014', 'Rin Soap 250g x 24',               'Rin',         'Home Care',     'carton',  700.00, 18.00, TRUE,  NULL),
  -- Wheel Detergent variants
  ('P015', 'Wheel Active 1kg',                 'Wheel',       'Home Care',     'pack',    125.00, 18.00, TRUE,  NULL),
  ('P016', 'Wheel Active 2kg',                 'Wheel',       'Home Care',     'pack',    240.00, 18.00, TRUE,  NULL),
  -- Pepsodent Toothpaste variants
  ('P017', 'Pepsodent Germicheck 80g',         'Pepsodent',   'Oral Care',     'tube',     55.00, 18.00, TRUE,  NULL),
  ('P018', 'Pepsodent Germicheck 150g',        'Pepsodent',   'Oral Care',     'tube',     95.00, 18.00, TRUE,  NULL),
  ('P019', 'Pepsodent Germicheck 200g',        'Pepsodent',   'Oral Care',     'tube',    125.00, 18.00, TRUE,  NULL),
  -- Boost variants
  ('P020', 'Boost Chocolate 200g',             'Boost',       'Beverages',     'jar',     110.00, 18.00, TRUE,  NULL),
  ('P021', 'Boost Chocolate 500g',             'Boost',       'Beverages',     'jar',     250.00, 18.00, TRUE,  NULL),
  ('P022', 'Boost Chocolate 1kg',              'Boost',       'Beverages',     'jar',     460.00, 18.00, TRUE,  NULL),
  -- Red Label Tea variants
  ('P023', 'Red Label Tea 250g',               'Red Label',   'Beverages',     'pack',    110.00, 18.00, TRUE,  NULL),
  ('P024', 'Red Label Tea 500g',               'Red Label',   'Beverages',     'pack',    210.00, 18.00, TRUE,  NULL),
  ('P025', 'Red Label Tea 1kg',                'Red Label',   'Beverages',     'pack',    395.00, 18.00, TRUE,  NULL),
  -- Brooke Bond Taj Mahal Tea variants
  ('P026', 'Brooke Bond Taj Mahal 250g',       'Brooke Bond', 'Beverages',     'pack',    150.00, 18.00, TRUE,  NULL),
  ('P027', 'Brooke Bond Taj Mahal 500g',       'Brooke Bond', 'Beverages',     'pack',    285.00, 18.00, TRUE,  NULL),
  -- Lifebuoy Soap variants (new HUL additions)
  ('P028', 'Lifebuoy Total 100g x 10',         'Lifebuoy',    'Personal Care', 'carton',  380.00, 18.00, TRUE,  NULL),
  ('P029', 'Lifebuoy Total 100g x 20',         'Lifebuoy',    'Personal Care', 'carton',  740.00, 18.00, TRUE,  NULL),
  ('P030', 'Lifebuoy Handwash 200ml',          'Lifebuoy',    'Personal Care', 'bottle',   85.00, 18.00, TRUE,  NULL),
  ('P031', 'Lifebuoy Handwash 500ml Refill',   'Lifebuoy',    'Personal Care', 'pack',    165.00, 18.00, TRUE,  NULL),
  -- Dove Soap variants (premium HUL)
  ('P032', 'Dove Cream Beauty 75g x 12',       'Dove',        'Personal Care', 'carton',  720.00, 18.00, TRUE,  NULL),
  ('P033', 'Dove Cream Beauty 100g x 10',      'Dove',        'Personal Care', 'carton',  840.00, 18.00, TRUE,  NULL);

-- ============================================================================
-- INVENTORY  (Surf Excel 4kg P010 is the low-stock demo: only 3 in stock)
-- ============================================================================

INSERT INTO public.inventory (product_id, available_qty, reserved_qty, restock_date, low_stock_threshold) VALUES
  ('P001', 45, 0, '2026-08-20', 5),
  ('P002', 30, 0, '2026-08-20', 5),
  ('P003', 20, 0, '2026-08-20', 5),
  ('P004', 100, 0, '2026-08-20', 20),
  ('P005', 25, 0, '2026-08-20', 5),
  ('P006', 18, 0, '2026-08-20', 5),
  ('P007', 22, 0, '2026-08-20', 5),
  ('P008', 40, 0, '2026-08-20', 5),
  ('P009', 25, 0, '2026-08-20', 5),
  ('P010',  3, 0, '2026-08-18', 5),   -- LOW STOCK DEMO
  ('P011', 35, 0, '2026-08-20', 5),
  ('P012', 20, 0, '2026-08-20', 5),
  ('P013', 30, 0, '2026-08-20', 5),
  ('P014', 15, 0, '2026-08-20', 5),
  ('P015', 50, 0, '2026-08-20', 10),
  ('P016', 30, 0, '2026-08-20', 5),
  ('P017', 40, 0, '2026-08-20', 5),
  ('P018', 25, 0, '2026-08-20', 5),
  ('P019', 18, 0, '2026-08-20', 5),
  ('P020', 35, 0, '2026-08-20', 5),
  ('P021', 22, 0, '2026-08-20', 5),
  ('P022', 12, 0, '2026-08-20', 5),
  ('P023', 40, 0, '2026-08-20', 5),
  ('P024', 20, 0, '2026-08-20', 5),
  ('P025', 10, 0, '2026-08-20', 5),
  ('P026', 25, 0, '2026-08-20', 5),
  ('P027', 15, 0, '2026-08-20', 5),
  ('P028', 30, 0, '2026-08-20', 5),
  ('P029', 18, 0, '2026-08-20', 5),
  ('P030', 40, 0, '2026-08-20', 5),
  ('P031', 25, 0, '2026-08-20', 5),
  ('P032', 20, 0, '2026-08-20', 5),
  ('P033', 15, 0, '2026-08-20', 5);

-- ============================================================================
-- SCHEMES (HUL products only)
-- ============================================================================

INSERT INTO public.schemes (scheme_id, scheme_name, start_date, end_date, eligible_product_ids, minimum_quantity, benefit_type, benefit_value, is_active) VALUES
  ('SCH01', 'Surf Excel Matic 4kg Buy 5 Get 1 Free',  '2026-08-01', '2026-08-31', ARRAY['P010']::TEXT[], 5, 'free_units', 1,     TRUE),
  ('SCH02', 'New Launch: Clinic Plus Sachet Box',     '2026-08-01', '2026-08-31', ARRAY['P004']::TEXT[], 10, 'discount', 10.00,  TRUE),
  ('SCH03', 'Festive Combo: Boost 500g + Red Label 500g', '2026-08-01', '2026-08-31', ARRAY['P021','P024']::TEXT[], 3, 'cashback', 100.00, TRUE);

-- ============================================================================
-- CALL LOGS  (one per past order)
-- ============================================================================

INSERT INTO public.call_logs (call_id, shop_id, start_time, end_time, language_detected, sentiment, order_placed, whatsapp_sent, escalated_to_human, transcript_summary) VALUES
  ('CALL101', 'S101', '2026-08-10 09:12:00+00', '2026-08-10 09:14:00+00', 'tanglish', 'positive', TRUE,  TRUE,  FALSE, 'Repeat order confirmed: Clinic Plus 340ml 2, Red Label 500g 1, Lux Soap 100gx20 1.'),
  ('CALL102', 'S102', '2026-08-12 10:05:00+00', '2026-08-12 10:06:30+00', 'tamil',    'positive', TRUE,  TRUE,  FALSE, 'Order: Rin Soap 250gx24 1 carton, Wheel Active 1kg 1.'),
  ('CALL103', 'S103', '2026-08-13 16:20:00+00', '2026-08-13 16:22:00+00', 'tamil',    'positive', TRUE,  TRUE,  FALSE, 'Order: Red Label 500g 2 packs, Boost 500g 1.'),
  ('CALL104', 'S104', '2026-08-14 11:30:00+00', '2026-08-14 11:32:00+00', 'hindi',    'positive', TRUE,  TRUE,  FALSE, 'Order in Hindi: Surf Excel Matic 4kg 1, Wheel Active 2kg 2.'),
  ('CALL105', 'S105', '2026-08-09 09:45:00+00', '2026-08-09 09:47:00+00', 'english',  'neutral',  TRUE,  TRUE,  FALSE, 'Order: Pepsodent 150g 1, Wheel Active 1kg 1.');

-- ============================================================================
-- ORDERS + ORDER ITEMS  (5 past orders, updated to new SKUs)
-- ============================================================================

-- ORD1019 — Kannan Stores (S101), last order, 2026-08-10
-- Clinic Plus 340ml 2 (155*2=310) + Red Label 500g 1 (210) + Lux Soap 100gx20 1 (880) = 1400
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1019', 'S101', 'CALL101', '2026-08-10', '2026-08-11', '2 PM - 5 PM', 1400.00, 1400.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1019', 'P002', 2, 'bottle', 155.00, 0, 310.00),
  ('ORD1019', 'P024', 1, 'pack', 210.00, 0, 210.00),
  ('ORD1019', 'P006', 1, 'carton', 880.00, 0, 880.00);

-- ORD1020 — Murugan Store (S102)
-- Rin 250gx24 1 (700) + Wheel 1kg 1 (125) = 825
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1020', 'S102', 'CALL102', '2026-08-12', '2026-08-13', '2 PM - 5 PM', 825.00, 825.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1020', 'P014', 1, 'carton', 700.00, 0, 700.00),
  ('ORD1020', 'P015', 1, 'pack',   125.00, 0, 125.00);

-- ORD1021 — Shanthi General Store (S103)
-- Red Label 500g 2 (210*2=420) + Boost 500g 1 (250) = 670
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1021', 'S103', 'CALL103', '2026-08-13', '2026-08-14', '2 PM - 5 PM', 670.00, 670.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1021', 'P024', 2, 'pack', 210.00, 0, 420.00),
  ('ORD1021', 'P021', 1, 'jar',  250.00, 0, 250.00);

-- ORD1022 — Lakshmi Traders (S104)
-- Surf Excel 4kg 1 (720) + Wheel 2kg 2 (240*2=480) = 1200
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1022', 'S104', 'CALL104', '2026-08-14', '2026-08-15', '2 PM - 5 PM', 1200.00, 1200.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1022', 'P010', 1, 'pack', 720.00, 0, 720.00),
  ('ORD1022', 'P016', 2, 'pack', 240.00, 0, 480.00);

-- ORD1023 — Anand Provision Store (S105)
-- Pepsodent 150g 1 (95) + Wheel 1kg 1 (125) = 220
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1023', 'S105', 'CALL105', '2026-08-09', '2026-08-10', '2 PM - 5 PM',  220.00,  220.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1023', 'P018', 1, 'tube',  95.00, 0,  95.00),
  ('ORD1023', 'P015', 1, 'pack', 125.00, 0, 125.00);

-- ============================================================================
-- SHOP MEMORY
-- ============================================================================

INSERT INTO public.shop_memory (shop_id, memory_text, memory_type, confidence_score, confirmed_by_user) VALUES
  ('S101', 'Prefers calls after 9 AM',             'timing',            0.95, TRUE),
  ('S101', 'Do not pitch Lux Soap',                'negative_memory',   0.98, TRUE),
  ('S101', 'Orders Clinic Plus 340ml weekly',      'product_preference',0.90, TRUE),
  ('S102', 'Prefers pure Tamil on calls',          'language',          0.95, TRUE),
  ('S103', 'Prefers evening call window 4-6 PM',   'timing',            0.90, TRUE),
  ('S104', 'Prefers Hindi on calls',               'language',          0.95, TRUE);

-- ============================================================================
-- BLACKLIST (S101 blacklists Lux Soap)
-- ============================================================================

INSERT INTO public.blacklist (shop_id, product_id, reason) VALUES
  ('S101', 'P005', 'Owner said Lux Soap does not sell'),
  ('S101', 'P006', 'Lux Soap venaam, adhu sell aagala. Innum kekkadheenga'),
  ('S101', 'P007', 'Lux Soap 50g also not needed'),
  ('S102', 'P013', 'Does not stock Rin 250gx12');

-- ============================================================================
-- COMPLAINT + RETURN  (one open exception, one return in progress)
-- ============================================================================

INSERT INTO public.complaints (complaint_id, shop_id, call_id, complaint_type, description, severity, status, callback_requested) VALUES
  (1, 'S102', 'CALL102', 'damaged_goods', '2 Pepsodent tubes damaged on delivery', 'medium', 'open', TRUE);

INSERT INTO public.returns (return_id, shop_id, order_id, product_id, quantity, reason, photo_url, credit_note_amount, status) VALUES
  (1, 'S102', 'ORD1020', 'P014', 1, 'damaged_goods', NULL, 0.00, 'photo_received');

COMMIT;