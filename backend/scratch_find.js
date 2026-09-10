const { Client } = require('pg');

const regions = [
  'ap-southeast-1',   // Singapore
  'ap-south-1',       // Mumbai
  'ap-southeast-2',   // Sydney
  'ap-northeast-1',   // Tokyo
  'ap-northeast-2',   // Seoul
  'us-east-1',        // N. Virginia
  'us-east-2',        // Ohio
  'us-west-1',        // N. California
  'us-west-2',        // Oregon
  'eu-central-1',     // Frankfurt
  'eu-west-1',        // Ireland
  'eu-west-2',        // London
  'eu-west-3',        // Paris
  'eu-north-1',       // Stockholm
  'sa-east-1',        // São Paulo
  'ca-central-1',     // Canada
  'me-central-1',     // UAE
  'af-south-1'        // Cape Town
];

async function check() {
  console.log('Testing Supabase poolers...');
  for (const r of regions) {
    const host = `aws-0-${r}.pooler.supabase.com`;
    // Try Session Mode (5432)
    const connStr5432 = `postgresql://postgres.ufcphvkxlzjcksmahvwh:Deathline742454@${host}:5432/postgres`;
    const client5432 = new Client({ connectionString: connStr5432, connectionTimeoutMillis: 2500, ssl: { rejectUnauthorized: false } });
    try {
      await client5432.connect();
      console.log(`\n🎉🎉 MATCH FOUND! Region: ${r} on Port 5432 (Session Mode)`);
      const res = await client5432.query('SELECT NOW()');
      console.log('Query output:', res.rows[0]);
      await client5432.end();
      return connStr5432;
    } catch (e) {
      if (!e.message.includes('tenant/user') && !e.message.includes('timeout')) {
        console.log(`Region ${r} (5432) response:`, e.message);
      }
    }

    // Try Transaction Mode (6543)
    const connStr6543 = `postgresql://postgres.ufcphvkxlzjcksmahvwh:Deathline742454@${host}:6543/postgres?pgbouncer=true`;
    const client6543 = new Client({ connectionString: connStr6543, connectionTimeoutMillis: 2500, ssl: { rejectUnauthorized: false } });
    try {
      await client6543.connect();
      console.log(`\n🎉🎉 MATCH FOUND! Region: ${r} on Port 6543 (Transaction Mode)`);
      const res = await client6543.query('SELECT NOW()');
      console.log('Query output:', res.rows[0]);
      await client6543.end();
      return connStr6543;
    } catch (e) {
      if (!e.message.includes('tenant/user') && !e.message.includes('timeout')) {
        console.log(`Region ${r} (6543) response:`, e.message);
      }
    }
  }
  console.log('Scan finished.');
}

check();
