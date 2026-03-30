'use client';
import { useState } from 'react';
import Link from 'next/link';

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="text-zinc-100">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
          </div>
        </div>
      </nav>

      <main className="py-20 px-6 max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Download</h1>
        <p className="text-zinc-400 mb-10">Start a free 14-day trial or download with your license key.</p>

        {/* Trial form */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <h2 className="font-semibold mb-4">Start Free Trial</h2>
          {trialKey ? (
            <div className="text-sm">
              <p className="text-zinc-400 mb-2">Your trial key:</p>
              <code className="block bg-zinc-800 rounded px-3 py-2 font-mono text-indigo-300 mb-4">{trialKey}</code>
              <p className="text-zinc-500 text-xs">Copy this key and use it in the download form below.</p>
            </div>
          ) : (
            <form onSubmit={handleTrial} className="flex gap-3">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Get Trial Key'}
              </button>
            </form>
          )}
        </section>

        {/* Download form */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Download with License Key</h2>
          <form onSubmit={handleDownload} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">License Key</label>
              <input
                type="text"
                placeholder="VECT-XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Platform</label>
              <div className="flex gap-3">
                {(['macos', 'windows'] as Platform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      platform === p
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {p === 'macos' ? 'macOS' : 'Windows'}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Download
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
