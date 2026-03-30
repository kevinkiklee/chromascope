'use client';
import { useState } from 'react';

type Platform = 'macos' | 'windows';

export default function DownloadPage() {
  const [email, setEmail] = useState('');
  const [trialKey, setTrialKey] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [platform, setPlatform] = useState<Platform>('macos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTrial(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/license/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.key) {
      setTrialKey(data.key);
    } else {
      setError(data.error ?? 'Failed to create trial');
    }
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    const key = licenseKey.trim();
    if (!key) { setError('Enter a license key'); return; }
    window.location.href = `/api/download/${platform}?key=${encodeURIComponent(key)}`;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[radial-gradient(ellipse,rgba(139,92,246,0.07)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
            Download
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Get ChromaScope
          </h1>
          <p className="text-zinc-400 text-lg">Start a free 14-day trial or download with your license key.</p>
        </div>
      </header>

      <main className="py-8 px-6 max-w-xl mx-auto space-y-6">
        {/* Trial form */}
        <section className="card-glass rounded-xl p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-white/[0.06] flex items-center justify-center text-sm text-violet-400">
              ✦
            </div>
            <h2 className="font-semibold text-zinc-200">Start Free Trial</h2>
          </div>

          {trialKey ? (
            <div className="text-sm">
              <p className="text-zinc-400 mb-3">Your trial key:</p>
              <code className="block bg-zinc-900/80 rounded-lg px-4 py-3 font-mono text-violet-300 border border-white/[0.06] mb-3 text-[13px]">
                {trialKey}
              </code>
              <p className="text-zinc-600 text-xs">Copy this key and use it in the download form below.</p>
            </div>
          ) : (
            <form onSubmit={handleTrial} className="flex gap-3">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-zinc-900/60 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm placeholder-zinc-600"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Get Trial Key'}
              </button>
            </form>
          )}
        </section>

        {/* Download form */}
        <section className="card-glass rounded-xl p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/[0.06] flex items-center justify-center text-sm text-cyan-400">
              ↓
            </div>
            <h2 className="font-semibold text-zinc-200">Download with License Key</h2>
          </div>

          <form onSubmit={handleDownload} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-500 mb-1.5">License Key</label>
              <input
                type="text"
                placeholder="CHRM-XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm font-mono placeholder-zinc-700"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-500 mb-1.5">Platform</label>
              <div className="flex gap-3">
                {(['macos', 'windows'] as Platform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      platform === p
                        ? 'btn-primary text-white'
                        : 'btn-ghost text-zinc-400'
                    }`}
                  >
                    {p === 'macos' ? '◆ macOS' : '◇ Windows'}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400/90 text-sm bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              className="w-full btn-ghost text-zinc-200 py-2.5 rounded-lg text-sm font-medium"
            >
              Download ChromaScope
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
