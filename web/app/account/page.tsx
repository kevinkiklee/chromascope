import Link from 'next/link';
import { sql } from '@/lib/db';

async function getLicenseData(key: string) {
  if (!key) return null;
  const rows = await sql`
    SELECT l.*, array_agg(
      json_build_object('machine_id', a.machine_id, 'platform', a.platform, 'activated_at', a.activated_at)
    ) FILTER (WHERE a.id IS NOT NULL) AS activations
    FROM licenses l
    LEFT JOIN activations a ON a.license_id = l.id
    WHERE l.key = ${key}
    GROUP BY l.id
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key = '' } = await searchParams;
  const data = await getLicenseData(key);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[radial-gradient(ellipse,rgba(139,92,246,0.07)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
            Account
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Your License
          </h1>
          <p className="text-zinc-400 text-lg">View your license details and manage activations.</p>
        </div>
      </header>

      <main className="py-8 px-6 max-w-2xl mx-auto">
        {!key || !data ? (
          <LicenseLookupForm />
        ) : (
          <div className="space-y-5">
            {/* License details */}
            <div className="card-glass rounded-xl p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-white/[0.06] flex items-center justify-center text-sm text-violet-400">
                  ◎
                </div>
                <h2 className="font-semibold text-zinc-200">License</h2>
              </div>
              <dl className="space-y-3 text-sm">
                <Row label="Key">
                  <code className="font-mono text-violet-300 text-[13px]">{data.key}</code>
                </Row>
                <Row label="Email">
                  <span className="text-zinc-300">{data.email}</span>
                </Row>
                <Row label="Tier">
                  <span className="capitalize text-zinc-300">{data.tier.replace('_', ' + ')}</span>
                </Row>
                <Row label="Status">
                  {data.is_active ? (
                    <span className="text-emerald-400">&#10003; Active</span>
                  ) : (
                    <span className="text-zinc-500">&#10007; Inactive</span>
                  )}
                </Row>
                {data.expires_at && (
                  <Row label="Expires">
                    <span className="text-zinc-300">{new Date(data.expires_at).toLocaleDateString()}</span>
                  </Row>
                )}
              </dl>
              {data.stripe_customer_id && (
                <a
                  href={`/api/billing-portal?customer=${data.stripe_customer_id}`}
                  className="inline-flex items-center gap-1.5 mt-5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Manage billing
                  <span className="text-xs">&rarr;</span>
                </a>
              )}
            </div>

            {/* Activations */}
            <div className="card-glass rounded-xl p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/[0.06] flex items-center justify-center text-sm text-cyan-400">
                  ⊞
                </div>
                <h2 className="font-semibold text-zinc-200">
                  Machine Activations
                  <span className="text-zinc-600 font-normal ml-2 text-sm">
                    {(data.activations ?? []).length} / 3
                  </span>
                </h2>
              </div>
              {(data.activations ?? []).length === 0 ? (
                <p className="text-zinc-600 text-sm">No machines activated yet.</p>
              ) : (
                <ul className="space-y-3">
                  {(data.activations as Array<{ machine_id: string; platform: string; activated_at: string }>).map((a) => (
                    <li key={a.machine_id} className="flex items-center justify-between text-sm py-2.5 px-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="font-mono text-zinc-300 text-[13px]">{a.machine_id}</span>
                      <span className="text-zinc-600 text-xs">
                        {a.platform} &middot; {new Date(a.activated_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-baseline">
      <dt className="w-20 text-zinc-600 shrink-0 text-xs uppercase tracking-wider">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function LicenseLookupForm() {
  return (
    <div className="card-glass rounded-xl p-7">
      <p className="text-zinc-500 text-sm mb-5">Enter your license key to view your account details.</p>
      <form method="get" className="flex gap-3">
        <input
          name="key"
          type="text"
          placeholder="CHRM-XXXX-XXXX-XXXX-XXXX"
          className="flex-1 bg-zinc-900/60 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm font-mono placeholder-zinc-700"
        />
        <button
          type="submit"
          className="btn-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium"
        >
          Look up
        </button>
      </form>
    </div>
  );
}
