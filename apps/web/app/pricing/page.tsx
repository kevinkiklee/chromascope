import Link from 'next/link';
import CheckoutButton from './CheckoutButton';

const TIERS = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    description: 'Full Pro feature access, no credit card required.',
    bullets: [
      'All vectorscope features',
      'YCbCr, CIE LUV, HSL color spaces',
      'Scatter, heatmap, bloom modes',
      'Photoshop + Lightroom Classic',
      '14-day expiry',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/download',
    highlight: false,
    priceId: null,
  },
  {
    name: 'Pro',
    price: 'TBD',
    period: 'one-time or /year',
    description: 'Permanent access to all vectorscope features. 3 machine activations.',
    bullets: [
      'Everything in Trial',
      'Perpetual or annual license',
      '3 machine activations',
      'Priority support',
    ],
    cta: 'Buy Pro',
    ctaHref: null,
    highlight: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '',
  },
  {
    name: 'Pro + AI',
    price: 'TBD',
    period: '/year',
    description: 'Pro features plus AI-powered color analysis. Annual subscription.',
    bullets: [
      'Everything in Pro',
      'AI color cast detection',
      'Reference image matching',
      'AI grading suggestions',
      'Early access to new AI features',
    ],
    cta: 'Buy Pro + AI',
    ctaHref: null,
    highlight: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_AI_PRICE_ID ?? '',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="text-zinc-100">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
            <Link href="/download" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <header className="py-20 px-6 text-center border-b border-zinc-800">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Pricing</h1>
          <p className="text-zinc-400 text-lg">Start free for 14 days. No credit card required.</p>
        </div>
      </header>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl p-8 border flex flex-col ${
                tier.highlight
                  ? 'border-indigo-500 bg-indigo-950/40'
                  : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              {tier.highlight && (
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Most Popular</span>
              )}
              <h2 className="text-xl font-bold mb-1">{tier.name}</h2>
              <div className="text-3xl font-bold mb-1">{tier.price}</div>
              <div className="text-zinc-500 text-sm mb-3">{tier.period}</div>
              <p className="text-zinc-400 text-sm mb-6">{tier.description}</p>
              <ul className="text-sm text-zinc-400 space-y-2 mb-8 flex-1">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-indigo-400">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              {tier.ctaHref ? (
                <Link
                  href={tier.ctaHref}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-center"
                >
                  {tier.cta}
                </Link>
              ) : (
                <CheckoutButton priceId={tier.priceId!} label={tier.cta} />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
