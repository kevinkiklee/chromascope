import Link from 'next/link';

const features = [
  {
    icon: '◎',
    title: 'Three Color Spaces',
    desc: 'Analyze in YCbCr (BT.601), CIE LUV, or HSL — switch in real time to match your workflow.',
  },
  {
    icon: '◈',
    title: 'Density Modes',
    desc: 'Scatter, heatmap, and bloom rendering reveal pixel distributions you can\'t see any other way.',
  },
  {
    icon: '⟳',
    title: 'Real-time Analysis',
    desc: 'Frame-accurate vectorscope updates as you edit. Every slider move, every brush stroke.',
  },
  {
    icon: '◐',
    title: 'Color Harmony',
    desc: 'Overlay complementary, triadic, and analogous zones. Rotate harmonies and fit colors to scheme.',
  },
  {
    icon: '⊘',
    title: 'Skin Tone Line',
    desc: 'Reference line for accurate skin tone reproduction — the industry standard for colorists.',
  },
  {
    icon: '✦',
    title: 'AI Analysis',
    desc: 'Color cast detection, reference matching, and intelligent grading suggestions. Pro + AI tier.',
  },
];

const platforms = [
  { name: 'Adobe Photoshop', detail: 'UXP Panel Plugin' },
  { name: 'Lightroom Classic', detail: 'LrC SDK Plugin' },
  { name: 'macOS', detail: 'Apple Silicon & Intel' },
  { name: 'Windows', detail: 'x64' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-[-120px] right-[20%] w-[500px] h-[400px] bg-[radial-gradient(ellipse,rgba(139,92,246,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[10%] w-[400px] h-[300px] bg-[radial-gradient(ellipse,rgba(6,182,212,0.04)_0%,transparent_70%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="flex flex-col md:flex-row items-center gap-16">
            {/* Left: copy */}
            <div className="flex-1 max-w-xl">
              <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-5">
                Professional Color Analysis
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
                See your color<br />
                <span className="gradient-text">like never before.</span>
              </h1>
              <p className="text-lg text-zinc-400 leading-relaxed mb-10 max-w-md">
                Chrominance vectorscope for Photoshop and Lightroom Classic.
                Analyze, grade, and perfect your color across three color spaces.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/download"
                  className="btn-primary text-white px-7 py-3 rounded-lg font-medium text-sm"
                >
                  Start Free Trial
                </Link>
                <Link
                  href="/features"
                  className="btn-ghost text-zinc-300 px-7 py-3 rounded-lg font-medium text-sm"
                >
                  Learn More
                </Link>
              </div>
            </div>

            {/* Right: vectorscope illustration */}
            <div className="flex-shrink-0">
              <div className="relative w-72 h-72 md:w-80 md:h-80">
                {/* Outer glow */}
                <div className="absolute inset-[-20px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.1)_0%,transparent_70%)]" />
                {/* Scope circle */}
                <div className="absolute inset-0 rounded-full border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-transparent">
                  {/* Graticule rings */}
                  <div className="absolute inset-[25%] rounded-full border border-dashed border-white/[0.04]" />
                  <div className="absolute inset-[50%] rounded-full border border-dashed border-white/[0.03]" />
                  {/* Crosshair */}
                  <div className="absolute top-1/2 left-[10%] right-[10%] h-px bg-white/[0.04]" />
                  <div className="absolute left-1/2 top-[10%] bottom-[10%] w-px bg-white/[0.04]" />
                  {/* Skin tone line */}
                  <div className="absolute top-1/2 left-1/2 w-[2px] h-[42%] bg-gradient-to-b from-amber-400/60 to-transparent origin-top -translate-x-1/2 -rotate-[33deg]" />
                  {/* Sample dots — pixel clusters */}
                  <div className="absolute top-[28%] left-[56%] w-3 h-3 rounded-full bg-rose-400/60 blur-[2px]" />
                  <div className="absolute top-[35%] left-[52%] w-2 h-2 rounded-full bg-rose-300/40 blur-[1px]" />
                  <div className="absolute top-[42%] left-[38%] w-2.5 h-2.5 rounded-full bg-blue-400/50 blur-[2px]" />
                  <div className="absolute top-[55%] left-[48%] w-4 h-4 rounded-full bg-amber-300/50 blur-[3px]" />
                  <div className="absolute top-[48%] left-[55%] w-2 h-2 rounded-full bg-violet-400/40 blur-[1px]" />
                  <div className="absolute top-[62%] left-[42%] w-3 h-3 rounded-full bg-emerald-400/35 blur-[2px]" />
                  <div className="absolute top-[38%] left-[44%] w-5 h-5 rounded-full bg-rose-300/30 blur-[4px]" />
                  {/* Hue labels */}
                  <div className="absolute top-[6%] left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 font-mono">0°</div>
                  <div className="absolute top-1/2 right-[4%] -translate-y-1/2 text-[10px] text-zinc-600 font-mono">90°</div>
                  <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 font-mono">180°</div>
                  <div className="absolute top-1/2 left-[4%] -translate-y-1/2 text-[10px] text-zinc-600 font-mono">270°</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform strip */}
      <div className="border-y border-white/[0.06] py-6 px-6">
        <div className="max-w-6xl mx-auto flex justify-center gap-10 md:gap-16 flex-wrap">
          {platforms.map((p) => (
            <div key={p.name} className="text-center">
              <div className="text-sm font-medium text-zinc-300">{p.name}</div>
              <div className="text-xs text-zinc-600">{p.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="relative py-24 px-6 section-glow">
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
              Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need for color analysis
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="card-glass rounded-xl p-6 group hover:border-white/[0.1] transition-all duration-300">
                <div className="text-2xl mb-3 opacity-60 group-hover:opacity-90 transition-opacity">{f.icon}</div>
                <h3 className="font-semibold text-[15px] mb-2 text-zinc-200">{f.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Summary */}
      <section className="relative py-24 px-6 section-glow">
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
              Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-zinc-500 text-lg">Start free. Upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: 'Trial', price: 'Free', sub: '14 days',
                bullets: ['Full Pro features', 'No credit card required'],
                cta: 'Start Trial', href: '/download', highlight: false,
              },
              {
                name: 'Pro', price: 'TBD', sub: 'one-time or /year',
                bullets: ['All vectorscope features', '3 machine activations'],
                cta: 'Buy Pro', href: '/pricing', highlight: true,
              },
              {
                name: 'Pro + AI', price: 'TBD', sub: '/year',
                bullets: ['Everything in Pro', 'AI color analysis'],
                cta: 'Buy Pro + AI', href: '/pricing', highlight: false,
              },
            ].map((t) => (
              <div
                key={t.name}
                className={`rounded-xl p-7 flex flex-col ${
                  t.highlight ? 'card-glass-highlight glow-violet-sm' : 'card-glass'
                }`}
              >
                {t.highlight && (
                  <span className="gradient-badge text-[11px] font-semibold uppercase tracking-widest mb-3">
                    Most Popular
                  </span>
                )}
                <div className="font-semibold text-lg mb-1 text-zinc-200">{t.name}</div>
                <div className="text-3xl font-bold mb-0.5">{t.price}</div>
                <div className="text-zinc-600 text-sm mb-5">{t.sub}</div>
                <ul className="text-sm text-zinc-400 space-y-2 mb-8 flex-1">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span className="text-violet-400/80">&#10003;</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href={t.href}
                  className={`text-center py-2.5 rounded-lg text-sm font-medium transition-all ${
                    t.highlight
                      ? 'btn-primary text-white'
                      : 'btn-ghost text-zinc-300'
                  }`}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
