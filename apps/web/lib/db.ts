import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('Missing DATABASE_URL environment variable');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Proxy that lazily initializes the neon client on first call.
// This allows `sql` to be used as a tagged template: sql`SELECT ...`
// without throwing at module evaluation time during builds.
export const sql: NeonQueryFunction<false, false> = new Proxy(
  (() => {}) as unknown as NeonQueryFunction<false, false>,
  {
    apply(_target, _thisArg, args) {
      return getSql()(...(args as [TemplateStringsArray, ...unknown[]]));
    },
    get(_target, prop) {
      return Reflect.get(getSql(), prop);
    },
  }
);

export async function runMigration() {
  const db = getSql();
  await db`
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

  await db`
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
