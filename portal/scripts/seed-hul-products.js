const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mxjsnhbziewlpnsybbvq.supabase.co',
  'sb_publishable_PIP3oLnCqhymy5kZh1CZag_sUxzEIyW'
);

const NEW_PRODUCTS = [
  // === ORAL CARE (Close-Up) ===
  { product_id: 'P034', product_name: 'Close-Up Triple Fresh 80g', brand: 'Close-Up', category: 'Oral Care', unit_type: 'tube', price: 55 },
  { product_id: 'P035', product_name: 'Close-Up Triple Fresh 150g', brand: 'Close-Up', category: 'Oral Care', unit_type: 'tube', price: 95 },
  { product_id: 'P036', product_name: 'Close-Up Ever Fresh 150g', brand: 'Close-Up', category: 'Oral Care', unit_type: 'tube', price: 105 },

  // === HAIR CARE (Tresemme) ===
  { product_id: 'P037', product_name: 'Tresemme Keratin Smooth Shampoo 180ml', brand: 'Tresemme', category: 'Personal Care', unit_type: 'bottle', price: 185 },
  { product_id: 'P038', product_name: 'Tresemme Keratin Smooth Shampoo 340ml', brand: 'Tresemme', category: 'Personal Care', unit_type: 'bottle', price: 310 },
  { product_id: 'P039', product_name: 'Tresemme Hair Fall Defence Shampoo 180ml', brand: 'Tresemme', category: 'Personal Care', unit_type: 'bottle', price: 175 },

  // === HAIR CARE (Sunsilk) ===
  { product_id: 'P040', product_name: 'Sunsilk Black Shine Shampoo 180ml', brand: 'Sunsilk', category: 'Personal Care', unit_type: 'bottle', price: 108 },
  { product_id: 'P041', product_name: 'Sunsilk Black Shine Shampoo 340ml', brand: 'Sunsilk', category: 'Personal Care', unit_type: 'bottle', price: 195 },
  { product_id: 'P042', product_name: 'Sunsilk Luscious Thick & Long 180ml', brand: 'Sunsilk', category: 'Personal Care', unit_type: 'bottle', price: 108 },

  // === PERSONAL CARE (Dove Body Wash) ===
  { product_id: 'P043', product_name: 'Dove Deep Pure Body Wash 200ml', brand: 'Dove', category: 'Personal Care', unit_type: 'bottle', price: 95 },
  { product_id: 'P044', product_name: 'Dove Deep Pure Body Wash 500ml', brand: 'Dove', category: 'Personal Care', unit_type: 'bottle', price: 199 },

  // === HOME CARE (Vim) ===
  { product_id: 'P045', product_name: 'Vim Liquid Dishwash 500ml', brand: 'Vim', category: 'Home Care', unit_type: 'bottle', price: 99 },
  { product_id: 'P046', product_name: 'Vim Liquid Dishwash 1L', brand: 'Vim', category: 'Home Care', unit_type: 'bottle', price: 175 },
  { product_id: 'P047', product_name: 'Vim Dishwash Bar 200g x 4', brand: 'Vim', category: 'Home Care', unit_type: 'pack', price: 56 },

  // === HOME CARE (Domex) ===
  { product_id: 'P048', product_name: 'Domex Toilet Cleaner 500ml', brand: 'Domex', category: 'Home Care', unit_type: 'bottle', price: 85 },
  { product_id: 'P049', product_name: 'Domex Toilet Cleaner 1L', brand: 'Domex', category: 'Home Care', unit_type: 'bottle', price: 149 },

  // === HOME CARE (Harpic) ===
  { product_id: 'P050', product_name: 'Harpic Power Plus 500ml', brand: 'Harpic', category: 'Home Care', unit_type: 'bottle', price: 89 },
  { product_id: 'P051', product_name: 'Harpic Power Plus 1L', brand: 'Harpic', category: 'Home Care', unit_type: 'bottle', price: 155 },

  // === HOME CARE (Comfort) ===
  { product_id: 'P052', product_name: 'Comfort Fabric Conditioner 440ml', brand: 'Comfort', category: 'Home Care', unit_type: 'bottle', price: 99 },
  { product_id: 'P053', product_name: 'Comfort Fabric Conditioner 860ml', brand: 'Comfort', category: 'Home Care', unit_type: 'bottle', price: 175 },

  // === FOOD (Knorr) ===
  { product_id: 'P054', product_name: 'Knorr Sweet Corn Soup 44g', brand: 'Knorr', category: 'Food', unit_type: 'pack', price: 35 },
  { product_id: 'P055', product_name: 'Knorr Manchow Soup 44g', brand: 'Knorr', category: 'Food', unit_type: 'pack', price: 35 },
  { product_id: 'P056', product_name: 'Knorr Instant Noodles 70g', brand: 'Knorr', category: 'Food', unit_type: 'pack', price: 14 },
  { product_id: 'P057', product_name: 'Knorr Instant Noodles 70g x 4', brand: 'Knorr', category: 'Food', unit_type: 'pack', price: 52 },

  // === FOOD (Kissan) ===
  { product_id: 'P058', product_name: 'Kissan Mixed Fruit Jam 500g', brand: 'Kissan', category: 'Food', unit_type: 'jar', price: 135 },
  { product_id: 'P059', product_name: 'Kissan Fresh Tomato Ketchup 500g', brand: 'Kissan', category: 'Food', unit_type: 'bottle', price: 95 },
  { product_id: 'P060', product_name: 'Kissan Fresh Tomato Ketchup 1kg', brand: 'Kissan', category: 'Food', unit_type: 'bottle', price: 165 },

  // === BEVERAGES (Bru) ===
  { product_id: 'P061', product_name: 'Bru Instant Coffee 50g', brand: 'Bru', category: 'Beverages', unit_type: 'jar', price: 72 },
  { product_id: 'P062', product_name: 'Bru Instant Coffee 100g', brand: 'Bru', category: 'Beverages', unit_type: 'jar', price: 135 },
  { product_id: 'P063', product_name: 'Bru Green Label 250g', brand: 'Bru', category: 'Beverages', unit_type: 'pack', price: 115 },

  // === HEALTH (Dettol) ===
  { product_id: 'P064', product_name: 'Dettol Original Soap 75g x 4', brand: 'Dettol', category: 'Personal Care', unit_type: 'pack', price: 152 },
  { product_id: 'P065', product_name: 'Dettol Original Soap 100g x 4', brand: 'Dettol', category: 'Personal Care', unit_type: 'pack', price: 196 },
  { product_id: 'P066', product_name: 'Dettol Handwash Refill 200ml', brand: 'Dettol', category: 'Personal Care', unit_type: 'pack', price: 55 },
  { product_id: 'P067', product_name: 'Dettol Antiseptic Liquid 100ml', brand: 'Dettol', category: 'Personal Care', unit_type: 'bottle', price: 55 },
];

const NEW_SCHEMES = [
  {
    scheme_id: 'SCH04',
    scheme_name: 'Close-Up + Domex Festive Combo',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P035', 'P048'],
    minimum_quantity: 5,
    benefit_type: 'free_units',
    benefit_value: 1,
    is_active: true,
  },
  {
    scheme_id: 'SCH05',
    scheme_name: 'Tresemme Launch Offer: Buy 2 Get 10% Off',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P037', 'P038', 'P039'],
    minimum_quantity: 2,
    benefit_type: 'discount',
    benefit_value: 10,
    is_active: true,
  },
  {
    scheme_id: 'SCH06',
    scheme_name: 'Vim + Harpic Bathroom Combo',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P046', 'P050'],
    minimum_quantity: 3,
    benefit_type: 'cashback',
    benefit_value: 50,
    is_active: true,
  },
  {
    scheme_id: 'SCH07',
    scheme_name: 'Knorr Noodles Bulk Deal',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P056', 'P057'],
    minimum_quantity: 10,
    benefit_type: 'free_units',
    benefit_value: 2,
    is_active: true,
  },
  {
    scheme_id: 'SCH08',
    scheme_name: 'Dove + Sunsilk Hair Care Bundle',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P043', 'P040', 'P041'],
    minimum_quantity: 4,
    benefit_type: 'cashback',
    benefit_value: 75,
    is_active: true,
  },
  {
    scheme_id: 'SCH09',
    scheme_name: 'Comfort + Rin Fresh Combo',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P052', 'P053', 'P013', 'P014'],
    minimum_quantity: 5,
    benefit_type: 'free_units',
    benefit_value: 1,
    is_active: true,
  },
  {
    scheme_id: 'SCH10',
    scheme_name: 'Bru Coffee Starter Pack',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P061', 'P062'],
    minimum_quantity: 3,
    benefit_type: 'discount',
    benefit_value: 15,
    is_active: true,
  },
  {
    scheme_id: 'SCH11',
    scheme_name: 'Dettol Hygiene Kit',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P064', 'P065', 'P066', 'P067'],
    minimum_quantity: 5,
    benefit_type: 'cashback',
    benefit_value: 100,
    is_active: true,
  },
  {
    scheme_id: 'SCH12',
    scheme_name: 'Kissan Food Combo',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    eligible_product_ids: ['P058', 'P059', 'P060'],
    minimum_quantity: 4,
    benefit_type: 'free_units',
    benefit_value: 1,
    is_active: true,
  },
];

async function seed() {
  console.log('=== Seeding HUL Products ===');
  
  // Insert products
  const { data: existingProducts } = await supabase.from('products').select('product_id');
  const existingIds = new Set(existingProducts?.map(p => p.product_id) ?? []);
  const newProducts = NEW_PRODUCTS.filter(p => !existingIds.has(p.product_id));
  
  if (newProducts.length > 0) {
    const { error } = await supabase.from('products').insert(newProducts);
    if (error) {
      console.error('Product insert error:', error.message);
    } else {
      console.log(`Added ${newProducts.length} new products`);
    }
  } else {
    console.log('All products already exist');
  }

  // Insert inventory for new products
  console.log('\n=== Seeding Inventory ===');
  const { data: existingInv } = await supabase.from('inventory').select('product_id');
  const existingInvIds = new Set(existingInv?.map(i => i.product_id) ?? []);
  const newInventory = NEW_PRODUCTS
    .filter(p => !existingInvIds.has(p.product_id))
    .map(p => ({
      product_id: p.product_id,
      available_qty: Math.floor(Math.random() * 40) + 10,
      reserved_qty: 0,
    }));
  
  if (newInventory.length > 0) {
    const { error } = await supabase.from('inventory').insert(newInventory);
    if (error) {
      console.error('Inventory insert error:', error.message);
    } else {
      console.log(`Added inventory for ${newInventory.length} products`);
    }
  } else {
    console.log('All inventory already exists');
  }

  // Insert schemes
  console.log('\n=== Seeding Schemes ===');
  const { data: existingSchemes } = await supabase.from('schemes').select('scheme_id');
  const existingSchemeIds = new Set(existingSchemes?.map(s => s.scheme_id) ?? []);
  const newSchemes = NEW_SCHEMES.filter(s => !existingSchemeIds.has(s.scheme_id));
  
  if (newSchemes.length > 0) {
    const { error } = await supabase.from('schemes').insert(newSchemes);
    if (error) {
      console.error('Scheme insert error:', error.message);
    } else {
      console.log(`Added ${newSchemes.length} new schemes`);
    }
  } else {
    console.log('All schemes already exist');
  }

  // Verify
  console.log('\n=== Final Counts ===');
  const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: sCount } = await supabase.from('schemes').select('*', { count: 'exact', head: true });
  const { count: iCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
  console.log(`Products: ${pCount}`);
  console.log(`Schemes: ${sCount}`);
  console.log(`Inventory: ${iCount}`);
}

seed().catch(console.error);
