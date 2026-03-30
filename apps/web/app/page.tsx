import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">Vectorscope</span>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
            <Link
              href="/download"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Professional Vectorscope<br />for Photoshop &amp; Lightroom
          </h1>
          <p className="text-xl text-zinc-400 mb-10">
            Real-time color analysis across YCbCr, CIE LUV, and HSL color spaces.
            Scatter, heatmap, and bloom density modes. Built for colorists.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/download"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-16 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Everything you need for color analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Color Spaces', desc: 'Analyze in YCbCr, CIE LUV, or HSL — switch in real time.' },
              { title: 'Density Modes', desc: 'Scatter, heatmap, and bloom rendering to visualize pixel distributions.' },
              { title: 'Real-time Analysis', desc: 'Frame-accurate vectorscope updates as you edit in Photoshop or Lightroom.' },
            ].map((f) => (
              <div key={f.title} className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Summary */}
      <section className="py-16 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-zinc-400 mb-12">Start free. Upgrade when you&apos;re ready.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Trial', price: 'Free', sub: '14 days', bullets: ['Full Pro features', 'No credit card'], cta: 'Start Trial', href: '/download' },
              { name: 'Pro', price: 'TBD', sub: 'one-time or /year', bullets: ['All vectorscope features', '3 machines'], cta: 'Buy Pro', href: '/pricing' },
              { name: 'Pro + AI', price: 'TBD', sub: '/year', bullets: ['Everything in Pro', 'AI color analysis features'], cta: 'Buy Pro + AI', href: '/pricing' },
            ].map((t) => (
              <div key={t.name} className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex flex-col">
                <div className="font-bold text-lg mb-1">{t.name}</div>
                <div className="text-3xl font-bold mb-1">{t.price}</div>
                <div className="text-zinc-500 text-sm mb-4">{t.sub}</div>
                <ul className="text-sm text-zinc-400 mb-6 space-y-1 text-left">
                  {t.bullets.map((b) => <li key={b}>✓ {b}</li>)}
                </ul>
                <Link href={t.href} className="mt-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors text-center">
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-10 px-6 text-center text-zinc-500 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/features" className="hover:text-zinc-300">Features</Link>
          <Link href="/pricing" className="hover:text-zinc-300">Pricing</Link>
          <Link href="/download" className="hover:text-zinc-300">Download</Link>
          <Link href="/docs" className="hover:text-zinc-300">Docs</Link>
          <Link href="/account" className="hover:text-zinc-300">Account</Link>
        </div>
        <p>© {new Date().getFullYear()} Vectorscope. All rights reserved.</p>
      </footer>
    </div>
  );
}
