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
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[radial-gradient(ellipse,rgba(139,92,246,0.07)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
            Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-zinc-400 text-lg">Start free for 14 days. No credit card required.</p>
        </div>
      </header>

      {/* Tiers */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl p-7 flex flex-col ${
                tier.highlight ? 'card-glass-highlight glow-violet-sm' : 'card-glass'
              }`}
            >
              {tier.highlight && (
                <span className="gradient-badge text-[11px] font-semibold uppercase tracking-widest mb-3">
                  Most Popular
                </span>
              )}
              <h2 className="text-lg font-semibold mb-1 text-zinc-200">{tier.name}</h2>
              <div className="text-3xl font-bold mb-0.5">{tier.price}</div>
              <div className="text-zinc-600 text-sm mb-3">{tier.period}</div>
              <p className="text-zinc-500 text-sm mb-6">{tier.description}</p>
              <ul className="text-sm text-zinc-400 space-y-2.5 mb-8 flex-1">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <span className="text-violet-400/80">&#10003;</span>
                    {b}
                  </li>
                ))}
              </ul>
              {tier.ctaHref ? (
                <Link
                  href={tier.ctaHref}
                  className={`text-center py-2.5 rounded-lg text-sm font-medium transition-all ${
                    tier.highlight ? 'btn-primary text-white' : 'btn-ghost text-zinc-300'
                  }`}
                >
                  {tier.cta}
                </Link>
              ) : (
                <CheckoutButton priceId={tier.priceId!} label={tier.cta} highlight={tier.highlight} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ-style note */}
      <section className="py-12 px-6 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-zinc-500 text-sm leading-relaxed">
            All licenses include up to 3 machine activations. Trial licenses expire after 14 days.
            Pro licenses never expire. Pro + AI requires an active annual subscription.
            Need help? Check the <Link href="/docs#license-faq" className="text-violet-400 hover:text-violet-300 transition-colors">License FAQ</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
