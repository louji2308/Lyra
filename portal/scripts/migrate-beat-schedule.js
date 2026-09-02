const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mxjsnhbziewlpnsybbvq.supabase.co',
  'sb_publishable_PIP3oLnCqhymy5kZh1CZag_sUxzEIyW'
);

async function migrate() {
  console.log('=== Beat Schedule Migration ===\n');

  // 1. Add beat_day and delivery_days to routes table
  console.log('1. Adding beat_day and delivery_days to routes...');
  
  // Try adding beat_day column
  let { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE routes ADD COLUMN IF NOT EXISTS beat_day INTEGER CHECK (beat_day BETWEEN 1 AND 6)`
  });
  if (error) {
    // Try direct SQL via query
    console.log('  (column may already exist, continuing...)');
  }

  error = null;
  ({ error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE routes ADD COLUMN IF NOT EXISTS delivery_days INTEGER DEFAULT 3`
  }));
  if (error) {
    console.log('  (column may already exist, continuing...)');
  }

  // 2. Create beat_calls table
  console.log('2. Creating beat_calls table...');
  ({ error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS beat_calls (
        id BIGSERIAL PRIMARY KEY,
        call_date DATE NOT NULL DEFAULT CURRENT_DATE,
        route_id TEXT NOT NULL REFERENCES routes(route_id),
        shop_id TEXT NOT NULL REFERENCES shops(shop_id),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'skipped')),
        order_id TEXT REFERENCES orders(order_id),
        attempt_count INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_beat_calls_date_route ON beat_calls(call_date, route_id);
      CREATE INDEX IF NOT EXISTS idx_beat_calls_shop ON beat_calls(shop_id);
    `
  }));
  if (error) {
    console.log('  Table may already exist:', error.message);
  }

  // 3. Seed beat days for existing routes
  console.log('3. Seeding beat days...');
  const beatDays = {
    'R001': 1,  // Monday
    'R002': 2,  // Tuesday
    'R003': 3,  // Wednesday
    'R004': 4,  // Thursday
    'R005': 5,  // Friday
    // Saturday (6) = make-up / flexible day
  };

  for (const [routeId, day] of Object.entries(beatDays)) {
    const { error: updateError } = await supabase
      .from('routes')
      .update({ beat_day: day, delivery_days: 3 })
      .eq('route_id', routeId);
    
    if (updateError) {
      console.log(`  Error updating ${routeId}:`, updateError.message);
    } else {
      const dayName = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
      console.log(`  ${routeId} → ${dayName} (beat_day=${day})`);
    }
  }

  // 4. Verify
  console.log('\n4. Verifying...');
  const { data: routes } = await supabase.from('routes').select('route_id, route_name, beat_day, delivery_days').order('route_id');
  console.log('\n=== Routes with Beat Schedule ===');
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  routes?.forEach(r => {
    console.log(`${r.route_id} | ${r.route_name} | ${dayNames[r.beat_day] || 'Not set'} | Delivery: ${r.delivery_days} days after order`);
  });

  console.log('\n=== Migration Complete ===');
}

migrate().catch(console.error);
