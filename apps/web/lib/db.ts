import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL environment variable');
}

export const sql = neon(process.env.DATABASE_URL);

export async function runMigration() {
  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key         TEXT NOT NULL UNIQUE,
      email       TEXT NOT NULL,
      tier        TEXT NOT NULL CHECK (tier IN ('trial', 'pro', 'pro_ai')),
      stripe_customer_id TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS activations (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      license_id   UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      machine_id   TEXT NOT NULL,
      platform     TEXT NOT NULL,
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (license_id, machine_id)
    )
  `;
}
