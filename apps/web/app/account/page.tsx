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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
          </div>
        </div>
      </nav>

      <main className="py-20 px-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Account</h1>

        {!key || !data ? (
          <LicenseLookupForm />
        ) : (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="font-semibold mb-4">License</h2>
              <dl className="space-y-2 text-sm">
                <Row label="Key"><code className="font-mono text-indigo-300">{data.key}</code></Row>
                <Row label="Email">{data.email}</Row>
                <Row label="Tier"><span className="capitalize">{data.tier.replace('_', ' + ')}</span></Row>
                <Row label="Status">{data.is_active ? '✓ Active' : '✗ Inactive'}</Row>
                {data.expires_at && (
                  <Row label="Expires">{new Date(data.expires_at).toLocaleDateString()}</Row>
                )}
              </dl>
              {data.stripe_customer_id && (
                <a
                  href={`/api/billing-portal?customer=${data.stripe_customer_id}`}
                  className="inline-block mt-4 text-sm text-indigo-400 hover:text-indigo-300 underline"
                >
                  Manage billing →
                </a>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="font-semibold mb-4">Machine Activations ({(data.activations ?? []).length} / 3)</h2>
              {(data.activations ?? []).length === 0 ? (
                <p className="text-zinc-500 text-sm">No machines activated yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(data.activations as Array<{ machine_id: string; platform: string; activated_at: string }>).map((a) => (
                    <li key={a.machine_id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-zinc-300">{a.machine_id}</span>
                      <span className="text-zinc-500">{a.platform} · {new Date(a.activated_at).toLocaleDateString()}</span>
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
    <div className="flex gap-4">
      <dt className="w-24 text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-zinc-200">{children}</dd>
    </div>
  );
}

function LicenseLookupForm() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <p className="text-zinc-400 text-sm mb-4">Enter your license key to view your account details.</p>
      <form method="get" className="flex gap-3">
        <input
          name="key"
          type="text"
          placeholder="VECT-XXXX-XXXX-XXXX-XXXX"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Look up
        </button>
      </form>
    </div>
  );
}
