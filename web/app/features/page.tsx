import Link from 'next/link';

const colorSpaces = [
  { name: 'YCbCr (BT.601)', desc: 'Broadcast-standard color space used in video production. Separates luma (Y) from chroma (Cb, Cr) for precise saturation analysis.' },
  { name: 'CIE LUV', desc: 'Perceptually uniform color space where equal distances represent equal perceived color differences. Ideal for colorimetric work.' },
  { name: 'HSL', desc: 'Hue-Saturation-Lightness — an intuitive representation of color suitable for artistic grading workflows.' },
];

const densityModes = [
  { name: 'Scatter', desc: 'Each pixel plotted as a point on the vectorscope. Provides an unweighted view of the full color gamut in the image.' },
  { name: 'Heatmap', desc: 'Pixel density is accumulated and color-mapped — areas with more pixels glow brighter, revealing dominant hues at a glance.' },
  { name: 'Bloom', desc: 'Glow effect applied to high-density clusters, making tightly grouped color populations visually distinctive.' },
];

const platformFeatures = [
  { name: 'Adobe Photoshop', desc: 'UXP panel plugin. Samples the active document on each pixel-level edit event. Supports all document color modes.' },
  { name: 'Lightroom Classic', desc: 'LrC SDK panel plugin. Responds to photo selection and develop module slider changes in real time.' },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[radial-gradient(ellipse,rgba(139,92,246,0.07)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <div className="gradient-badge text-xs font-semibold uppercase tracking-[0.14em] mb-4">
            Features
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Everything inside Chromascope
          </h1>
          <p className="text-zinc-400 text-lg">Professional-grade color analysis for creative workflows.</p>
        </div>
      </header>

      {/* Color Spaces */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <div className="gradient-badge text-[11px] font-semibold uppercase tracking-[0.14em] mb-2">Analysis</div>
            <h2 className="text-2xl font-bold tracking-tight">Color Spaces</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {colorSpaces.map((cs) => (
              <div key={cs.name} className="card-glass rounded-xl p-6">
                <h3 className="font-semibold text-[15px] mb-2 text-zinc-200">{cs.name}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{cs.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Density Modes */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <div className="gradient-badge text-[11px] font-semibold uppercase tracking-[0.14em] mb-2">Visualization</div>
            <h2 className="text-2xl font-bold tracking-tight">Density Modes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {densityModes.map((dm) => (
              <div key={dm.name} className="card-glass rounded-xl p-6">
                <h3 className="font-semibold text-[15px] mb-2 text-zinc-200">{dm.name}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{dm.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Graticule & Overlays */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="card-glass rounded-xl p-8">
              <div className="gradient-badge text-[11px] font-semibold uppercase tracking-[0.14em] mb-2">Overlays</div>
              <h2 className="text-xl font-bold tracking-tight mb-3">Graticule</h2>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Configurable circular grid with saturation rings at standard intervals,
                hue labels at 30&deg; increments, and a fine angular grid. Opacity is adjustable.
              </p>
            </div>
            <div className="card-glass rounded-xl p-8">
              <div className="gradient-badge text-[11px] font-semibold uppercase tracking-[0.14em] mb-2">Reference</div>
              <h2 className="text-xl font-bold tracking-tight mb-3">Skin Tone Line</h2>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Industry-standard reference line for accurate skin tone reproduction.
                Essential for portrait retouching and broadcast-compliant color work.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Color Harmony */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="card-glass rounded-xl p-8 md:p-10">
            <div className="gradient-badge text-[11px] font-semibold uppercase tracking-[0.14em] mb-2">Interactive</div>
            <h2 className="text-xl font-bold tracking-tight mb-3">Color Harmony Zones</h2>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl mb-6">
              Overlay complementary, split-complementary, triadic, tetradic, and analogous harmony zones.
              Rotate zones interactively and use fit-to-scheme to push colors toward your chosen harmony.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Complementary', 'Split-complementary', 'Triadic', 'Tetradic', 'Analogous'].map((h) => (
                <span key={h} className="text-xs px-3 py-1.5 rounded-full border border-white/[0.06] text-zinc-400 bg-white/[0.02]">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform Support */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <div className="gradient-badge text-[11px] font-semibold uppercase tracking-[0.14em] mb-2">Integrations</div>
            <h2 className="text-2xl font-bold tracking-tight">Platform Support</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {platformFeatures.map((p) => (
              <div key={p.name} className="card-glass rounded-xl p-6">
                <h3 className="font-semibold text-[15px] mb-2 text-zinc-200">{p.name}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features */}
      <section className="relative py-16 px-6 border-t border-white/[0.06] section-glow">
        <div className="max-w-6xl mx-auto relative">
          <div className="card-glass-highlight rounded-xl p-8 md:p-10 glow-violet-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="gradient-badge text-[11px] font-semibold uppercase tracking-[0.14em]">Pro + AI</div>
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-3">AI-Powered Color Analysis</h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl mb-6">
              Automatic color cast detection, reference image matching, and intelligent grading
              suggestions based on vectorscope data. Available with the Pro + AI tier.
            </p>
            <Link
              href="/pricing"
              className="btn-primary inline-block text-white px-6 py-2.5 rounded-lg text-sm font-medium"
            >
              View Pro + AI Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
