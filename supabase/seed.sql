-- ============================================================================
-- Lyra 2.0 — Data Brain: Seed Data
-- Sample universe for the Shree Agencies demo (run AFTER the schema migration)
--
-- Contents:
--   1 route    | 5 shops   | 15 products (4 categories) | inventory
--   3 schemes  | 5 past orders | call logs | memory | blacklist | complaint | return
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
-- ROUTES
-- ============================================================================

INSERT INTO public.routes (route_id, route_name, salesperson, coverage_area, is_active) VALUES
  ('R001', 'Tambaram Main Beat', 'Rajesh Kumar', 'Tambaram, Chennai', TRUE);

-- ============================================================================
-- SHOPS
-- ============================================================================

INSERT INTO public.shops (
  shop_id, shop_name, owner_name, phone_number, whatsapp_number, preferred_language,
  preferred_call_start, preferred_call_end, beat_route_id, visit_gap_days,
  credit_limit, outstanding_balance, voice_consent, whatsapp_consent, opt_out, last_order_date
) VALUES
  ('S101', 'Kannan Stores',     'Kannan',  '919840011234', '919840011234', 'tanglish', '09:00', '11:00', 'R001', 7,  10000.00, 7500.00, TRUE,  TRUE,  FALSE, '2026-08-10'),
  ('S102', 'Murugan Store',     'Murugan', '919840022345', '919840022345', 'tamil',    '10:00', '12:00', 'R001', 7,   5000.00,  500.00, TRUE,  TRUE,  FALSE, '2026-08-12'),
  ('S103', 'Shanthi General Store', 'Shanthi', '919840033456', '919840033456', 'tamil', '16:00', '18:00', 'R001', 7,   8000.00, 2000.00, TRUE,  TRUE,  FALSE, '2026-08-13'),
  ('S104', 'Lakshmi Traders',   'Lakshmi', '919840044567', '919840044567', 'hindi',    '11:00', '13:00', 'R001', 7,  12000.00, 3000.00, TRUE,  TRUE,  FALSE, '2026-08-14'),
  ('S105', 'Anand Provision Store', 'Anand', '919840055678', '919840055678', 'english', '09:30', '12:30', 'R001', 7, 6000.00, 5500.00, TRUE,  TRUE,  FALSE, '2026-08-09');

-- ============================================================================
-- PRODUCTS (database-only pricing)
-- ============================================================================

INSERT INTO public.products (product_id, product_name, brand, category, unit_type, price, tax_rate, is_active, launch_date) VALUES
  ('P001', 'Clinic Plus Shampoo',        'Clinic Plus', 'Personal Care', 'carton', 1200.00, 18.00, TRUE,  NULL),
  ('P002', 'Clinic Plus Sachet',         'Clinic Plus', 'Personal Care', 'box',    250.00, 18.00, TRUE,  '2026-08-01'),
  ('P003', 'Lux Soap',                   'Lux',         'Personal Care', 'carton',  900.00, 18.00, TRUE,  NULL),
  ('P004', 'Santoor Soap',               'Santoor',     'Personal Care', 'carton',  840.00, 18.00, TRUE,  NULL),
  ('P005', 'Dettol Soap',                'Dettol',      'Personal Care', 'carton',  960.00, 18.00, TRUE,  NULL),
  ('P006', 'Surf Excel Detergent',       'Surf Excel',  'Home Care',     'carton', 2400.00, 18.00, TRUE,  NULL),
  ('P007', 'Vim Bar',                    'Vim',         'Home Care',     'box',     320.00, 18.00, TRUE,  NULL),
  ('P008', 'Rin Soap',                   'Rin',         'Home Care',     'box',     280.00, 18.00, TRUE,  NULL),
  ('P009', 'Wheel Detergent',            'Wheel',       'Home Care',     'box',     220.00, 18.00, TRUE,  NULL),
  ('P010', 'Pepsodent Toothpaste',       'Pepsodent',   'Oral Care',     'box',     600.00, 18.00, TRUE,  NULL),
  ('P011', 'Colgate MaxFresh',           'Colgate',     'Oral Care',     'box',     700.00, 18.00, TRUE,  NULL),
  ('P012', 'Dettol Mouthwash',           'Dettol',      'Oral Care',     'box',     380.00, 18.00, TRUE,  NULL),
  ('P013', 'Red Label Tea',              'Red Label',   'Beverages',     'carton', 1200.00, 18.00, TRUE,  NULL),
  ('P014', 'Brooke Bond Taj Mahal Tea',  'Brooke Bond', 'Beverages',     'carton', 1800.00, 18.00, TRUE,  NULL),
  ('P015', 'Boost',                      'Boost',       'Beverages',     'box',    1300.00, 18.00, TRUE,  NULL);

-- ============================================================================
-- INVENTORY  (Surf Excel P006 is the low-stock demo: only 3 in stock)
-- ============================================================================

INSERT INTO public.inventory (product_id, available_qty, reserved_qty, restock_date, low_stock_threshold) VALUES
  ('P001', 45, 0, '2026-08-20', 5),
  ('P002', 100, 0, '2026-08-20', 20),
  ('P003', 30, 0, '2026-08-20', 5),
  ('P004', 25, 0, '2026-08-20', 5),
  ('P005', 18, 0, '2026-08-20', 5),
  ('P006',  3, 0, '2026-08-18', 5),
  ('P007', 60, 0, '2026-08-20', 10),
  ('P008', 40, 0, '2026-08-20', 10),
  ('P009', 50, 0, '2026-08-20', 10),
  ('P010', 35, 0, '2026-08-20', 5),
  ('P011', 28, 0, '2026-08-20', 5),
  ('P012', 22, 0, '2026-08-20', 5),
  ('P013', 40, 0, '2026-08-20', 5),
  ('P014', 20, 0, '2026-08-20', 5),
  ('P015', 33, 0, '2026-08-20', 5);

-- ============================================================================
-- SCHEMES
-- ============================================================================

INSERT INTO public.schemes (scheme_id, scheme_name, start_date, end_date, eligible_product_ids, minimum_quantity, benefit_type, benefit_value, is_active) VALUES
  ('SCH01', 'Surf Excel Buy 5 Get 1 Free',      '2026-08-01', '2026-08-31', ARRAY['P006']::TEXT[], 5, 'free_units', 1,     TRUE),
  ('SCH02', 'New Launch: Clinic Plus Sachet',   '2026-08-01', '2026-08-31', ARRAY['P002']::TEXT[], 10, 'discount', 10.00,  TRUE),
  ('SCH03', 'Festive Combo: Boost + Red Label', '2026-08-01', '2026-08-31', ARRAY['P013','P015']::TEXT[], 3, 'cashback', 100.00, TRUE);

-- ============================================================================
-- CALL LOGS  (one per past order)
-- ============================================================================

INSERT INTO public.call_logs (call_id, shop_id, start_time, end_time, language_detected, sentiment, order_placed, whatsapp_sent, escalated_to_human, transcript_summary) VALUES
  ('CALL101', 'S101', '2026-08-10 09:12:00+00', '2026-08-10 09:14:00+00', 'tanglish', 'positive', TRUE,  TRUE,  FALSE, 'Repeat order confirmed: Clinic Plus 2, Red Label 1, Dettol Soap 1.'),
  ('CALL102', 'S102', '2026-08-12 10:05:00+00', '2026-08-12 10:06:30+00', 'tamil',    'positive', TRUE,  TRUE,  FALSE, 'Order: Santoor 1 carton, Vim Bar 1 box.'),
  ('CALL103', 'S103', '2026-08-13 16:20:00+00', '2026-08-13 16:22:00+00', 'tamil',    'positive', TRUE,  TRUE,  FALSE, 'Order: Red Label 2 cartons, Boost 1 box.'),
  ('CALL104', 'S104', '2026-08-14 11:30:00+00', '2026-08-14 11:32:00+00', 'hindi',    'positive', TRUE,  TRUE,  FALSE, 'Order in Hindi: Surf Excel 1, Vim Bar 2.'),
  ('CALL105', 'S105', '2026-08-09 09:45:00+00', '2026-08-09 09:47:00+00', 'english',  'neutral',  TRUE,  TRUE,  FALSE, 'Order: Colgate MaxFresh 1, Wheel 1.');

-- ============================================================================
-- ORDERS + ORDER ITEMS  (5 past orders)
-- ============================================================================

-- ORD1019 — Kannan Stores (S101), last order, 2026-08-10
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1019', 'S101', 'CALL101', '2026-08-10', '2026-08-11', '2 PM - 5 PM', 4560.00, 4560.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1019', 'P001', 2, 'carton', 1200.00, 0, 2400.00),
  ('ORD1019', 'P013', 1, 'carton', 1200.00, 0, 1200.00),
  ('ORD1019', 'P005', 1, 'carton',  960.00, 0,  960.00);

-- ORD1020 — Murugan Store (S102)
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1020', 'S102', 'CALL102', '2026-08-12', '2026-08-13', '2 PM - 5 PM', 1160.00, 1160.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1020', 'P004', 1, 'carton', 840.00, 0,  840.00),
  ('ORD1020', 'P007', 1, 'box',    320.00, 0,  320.00);

-- ORD1021 — Shanthi General Store (S103)
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1021', 'S103', 'CALL103', '2026-08-13', '2026-08-14', '2 PM - 5 PM', 3700.00, 3700.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1021', 'P013', 2, 'carton', 1200.00, 0, 2400.00),
  ('ORD1021', 'P015', 1, 'box',    1300.00, 0, 1300.00);

-- ORD1022 — Lakshmi Traders (S104)
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1022', 'S104', 'CALL104', '2026-08-14', '2026-08-15', '2 PM - 5 PM', 3040.00, 3040.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1022', 'P006', 1, 'carton', 2400.00, 0, 2400.00),
  ('ORD1022', 'P007', 2, 'box',     320.00, 0,  640.00);

-- ORD1023 — Anand Provision Store (S105)
INSERT INTO public.orders (order_id, shop_id, call_id, order_date, delivery_date, delivery_slot, total_amount, credit_used, payment_status, order_status, created_by) VALUES
  ('ORD1023', 'S105', 'CALL105', '2026-08-09', '2026-08-10', '2 PM - 5 PM',  920.00,  920.00, 'paid', 'delivered', 'AI');

INSERT INTO public.order_items (order_id, product_id, quantity, unit, price, discount, line_total) VALUES
  ('ORD1023', 'P011', 1, 'box', 700.00, 0, 700.00),
  ('ORD1023', 'P009', 1, 'box', 220.00, 0, 220.00);

-- ============================================================================
-- SHOP MEMORY
-- ============================================================================

INSERT INTO public.shop_memory (shop_id, memory_text, memory_type, confidence_score, confirmed_by_user) VALUES
  ('S101', 'Prefers calls after 9 AM',             'timing',            0.95, TRUE),
  ('S101', 'Do not pitch Lux Soap',                'negative_memory',   0.98, TRUE),
  ('S101', 'Orders Clinic Plus weekly',            'product_preference',0.90, TRUE),
  ('S102', 'Prefers pure Tamil on calls',          'language',          0.95, TRUE),
  ('S103', 'Prefers evening call window 4-6 PM',   'timing',            0.90, TRUE),
  ('S104', 'Prefers Hindi on calls',               'language',          0.95, TRUE);

-- ============================================================================
-- BLACKLIST
-- ============================================================================

INSERT INTO public.blacklist (shop_id, product_id, reason) VALUES
  ('S101', 'P003', 'Owner said Lux Soap does not sell'),
  ('S101', 'P007', 'Vim bar venaam, adhu sell aagala. Innum kekkadheenga'),
  ('S102', 'P007', 'Does not stock Vim');

-- ============================================================================
-- COMPLAINT + RETURN  (one open exception, one return in progress)
-- ============================================================================

INSERT INTO public.complaints (complaint_id, shop_id, call_id, complaint_type, description, severity, status, callback_requested) VALUES
  (1, 'S102', 'CALL102', 'damaged_goods', '2 Dettol packets damaged on delivery', 'medium', 'open', TRUE);

INSERT INTO public.returns (return_id, shop_id, order_id, product_id, quantity, reason, photo_url, credit_note_amount, status) VALUES
  (1, 'S102', 'ORD1020', 'P005', 2, 'damaged_goods', NULL, 0.00, 'photo_received');

COMMIT;
