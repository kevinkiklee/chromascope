import Link from 'next/link';
import { ScrollReveal } from '@/components/scroll-reveal';
import { AnimatedVectorscope } from '@/components/animated-vectorscope';
import { ProductScreenshot } from '@/components/product-screenshot';

const valueProps = [
  {
    icon: '🎯',
    title: 'Stop guessing at color balance',
    desc: 'See exactly where your chrominance sits across six professional color spaces. No more eyeballing — know your color is right.',
  },
  {
    icon: '⚡',
    title: 'Stay in your editing workflow',
    desc: 'Runs inside Photoshop and Lightroom Classic. No round-tripping, no exports, no separate windows.',
  },
  {
    icon: '🔍',
    title: 'Catch problems before your client does',
    desc: 'Skin tone line, harmony zones, and density heatmaps reveal color issues invisible to the naked eye.',
  },
];

const featureBlocks = [
  {
    eyebrow: 'Color Spaces',
    title: 'Six professional color spaces',
    desc: 'YCbCr BT.601 & BT.709, CIE LUV, HSL, and more. Switch instantly to match your grading workflow.',
    tags: ['YCbCr 601', 'YCbCr 709', 'CIE LUV', 'HSL'],
    screenshotAlt: 'Chromascope color space selector in Photoshop',
    screenshotPlaceholder: 'Color Spaces screenshot',
  },
  {
    eyebrow: 'Density Modes',
    title: 'Three ways to visualize density',
    desc: 'Scatter, Heatmap, and Bloom. Each reveals different characteristics of your image\'s color distribution.',
    tags: ['Scatter', 'Heatmap', 'Bloom'],
    screenshotAlt: 'Chromascope density mode comparison',
    screenshotPlaceholder: 'Density Modes screenshot',
  },
  {
    eyebrow: 'Color Harmony',
    title: 'Seven harmony zone overlays',
    desc: 'Complementary, analogous, triadic, and more. See how your colors relate at a glance.',
    tags: ['Complementary', 'Analogous', 'Triadic', 'Split-Complementary'],
    screenshotAlt: 'Chromascope harmony overlay on vectorscope',
    screenshotPlaceholder: 'Harmony Overlays screenshot',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ── Section 1: Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute top-[-120px] right-[20%] w-[500px] h-[400px] bg-[radial-gradient(ellipse,rgba(139,92,246,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[10%] w-[400px] h-[300px] bg-[radial-gradient(ellipse,rgba(6,182,212,0.04)_0%,transparent_70%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="flex flex-col md:flex-row items-center gap-16">
            {/* Copy */}
            <div className="flex-1 max-w-xl">
              <div className="animate-hero gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-5">
                Professional Color Analysis
              </div>
              <h1 className="animate-hero animate-delay-100 text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
                See your color<br />
                <span className="gradient-text">like never before.</span>
              </h1>
              <p className="animate-hero animate-delay-200 text-lg text-zinc-400 leading-relaxed mb-10 max-w-md">
                Chrominance vectorscope for Photoshop and Lightroom Classic.
                Analyze, grade, and perfect your color across six professional color spaces.
              </p>
              <div className="animate-hero animate-delay-300 flex gap-3">
                <Link
                  href="/download"
                  className="btn-primary text-white px-7 py-3 rounded-lg font-medium text-sm"
                >
                  Download Free Trial
                </Link>
                <Link
                  href="/features"
                  className="btn-ghost text-zinc-300 px-7 py-3 rounded-lg font-medium text-sm"
                >
                  View Features
                </Link>
              </div>
              <div className="animate-hero animate-delay-400 flex gap-6 mt-8">
                <span className="text-xs text-zinc-600">Photoshop</span>
                <span className="text-xs text-zinc-600">Lightroom Classic</span>
                <span className="text-xs text-zinc-600">macOS & Windows</span>
              </div>
            </div>

            {/* Product screenshot + animated accent */}
            <div className="animate-hero animate-delay-300 flex-1 max-w-md relative">
              <ProductScreenshot
                alt="Chromascope panel in Photoshop showing vectorscope analysis"
                placeholder="Photoshop panel screenshot"
                className="min-h-[280px] md:min-h-[340px]"
              />
              <div className="absolute -top-3 -right-3 md:-top-5 md:-right-5">
                <AnimatedVectorscope size={72} className="opacity-70" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Value Propositions ── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          {valueProps.map((v, i) => (
            <ScrollReveal key={v.title} animation="up" delay={(i * 100) as 0 | 100 | 200}>
              <div className="card-glass rounded-xl p-6 flex gap-4 items-start group hover:border-white/[0.1] transition-all duration-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-lg">
                  {v.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] text-zinc-200 mb-1">{v.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── Section 3: Feature Showcase ── */}
      <section className="relative py-24 px-6 section-glow">
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-20">
            <ScrollReveal animation="up">
              <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
                Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Everything inside Chromascope
              </h2>
            </ScrollReveal>
          </div>

          <div className="flex flex-col gap-24">
            {featureBlocks.map((f, i) => {
              const imageLeft = i % 2 === 0;
              return (
                <ScrollReveal
                  key={f.eyebrow}
                  animation={imageLeft ? 'left' : 'right'}
                >
                  <div className={`flex flex-col md:flex-row items-center gap-12 ${!imageLeft ? 'md:flex-row-reverse' : ''}`}>
                    {/* Screenshot */}
                    <div className="flex-1 w-full">
                      <ProductScreenshot
                        alt={f.screenshotAlt}
                        placeholder={f.screenshotPlaceholder}
                        className="min-h-[200px] md:min-h-[260px]"
                      />
                    </div>
                    {/* Text */}
                    <div className="flex-1">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-400 mb-3">
                        {f.eyebrow}
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight text-zinc-100 mb-3">
                        {f.title}
                      </h3>
                      <p className="text-zinc-400 leading-relaxed mb-5">
                        {f.desc}
                      </p>
                      {f.tags && (
                        <div className="flex flex-wrap gap-2">
                          {f.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-violet-500/10 text-violet-300 text-xs px-3 py-1 rounded-md border border-violet-500/15"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 4: Full-Bleed Product Banner ── */}
      <section className="relative py-28 px-6 overflow-hidden bg-gradient-to-b from-zinc-950 via-[#0f0a1a] to-zinc-950">
        <div className="max-w-5xl mx-auto relative">
          <ScrollReveal animation="up">
            <div className="text-center mb-12">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-400 mb-3">
                The Complete Picture
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Chromascope in action
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="scale">
            <div className="relative max-w-4xl mx-auto">
              <ProductScreenshot
                alt="Chromascope panel open in Photoshop, analyzing a photograph with vectorscope overlay"
                placeholder="Full-width product screenshot"
                className="min-h-[300px] md:min-h-[400px]"
              />
              {/* Annotation callouts */}
              <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-violet-500/10 border border-violet-500/25 rounded-md px-3 py-1.5 text-xs text-violet-300 backdrop-blur-sm">
                ← YCbCr BT.709
              </div>
              <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 bg-violet-500/10 border border-violet-500/25 rounded-md px-3 py-1.5 text-xs text-violet-300 backdrop-blur-sm">
                Heatmap density →
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="up" delay={200}>
            <p className="text-zinc-500 text-center mt-10 max-w-lg mx-auto leading-relaxed">
              Real-time chrominance analysis directly in your editing workflow.
              No round-tripping, no exports.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Section 5: Pricing ── */}
      <section className="relative py-24 px-6 section-glow">
        <div className="max-w-5xl mx-auto relative">
          <ScrollReveal animation="up">
            <div className="text-center mb-16">
              <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
                Pricing
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-zinc-500 text-lg">Start free. Upgrade when you&apos;re ready.</p>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="up" delay={100}>
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
                  className={`rounded-xl p-7 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                    t.highlight
                      ? 'card-glass-highlight glow-violet-sm animate-pulse-border'
                      : 'card-glass hover:border-white/[0.1]'
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
          </ScrollReveal>
        </div>
      </section>

      {/* ── Section 6: Final CTA ── */}
      <section className="relative py-28 px-6 overflow-hidden">
        {/* Background decorative vectorscope */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatedVectorscope size={400} className="opacity-[0.03]" />
        </div>

        <ScrollReveal animation="up">
          <div className="relative max-w-lg mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Start analyzing color today
            </h2>
            <p className="text-zinc-500 text-lg mb-10">
              14-day free trial. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/download"
                className="btn-primary text-white px-8 py-3 rounded-lg font-medium text-sm"
              >
                Download Free Trial
              </Link>
              <Link
                href="/docs"
                className="btn-ghost text-zinc-300 px-8 py-3 rounded-lg font-medium text-sm"
              >
                View Documentation
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
