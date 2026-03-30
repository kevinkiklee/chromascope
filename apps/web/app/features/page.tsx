import Link from 'next/link';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="text-zinc-100">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
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
          <h1 className="text-4xl font-bold mb-4">Features</h1>
          <p className="text-zinc-400 text-lg">Everything inside Vectorscope, in detail.</p>
        </div>
      </header>

      {/* Color Spaces */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Color Spaces</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'YCbCr', desc: 'Broadcast-standard color space used in video production. Separates luma (Y) from chroma (Cb, Cr) for precise saturation analysis.' },
              { name: 'CIE LUV', desc: 'Perceptually uniform color space where equal distances represent equal perceived color differences. Ideal for colorimetric work.' },
              { name: 'HSL', desc: 'Hue-Saturation-Lightness — an intuitive representation of color suitable for artistic grading workflows.' },
            ].map((cs) => (
              <div key={cs.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-2">{cs.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{cs.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Density Modes */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Density Modes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Scatter', desc: 'Each pixel plotted as a point on the vectorscope. Provides an unweighted view of the full color gamut in the image.' },
              { name: 'Heatmap', desc: 'Pixel density is accumulated and color-mapped — areas with more pixels glow brighter, revealing dominant hues at a glance.' },
              { name: 'Bloom', desc: 'Glow effect applied to high-density clusters, making tightly grouped color populations visually distinctive.' },
            ].map((dm) => (
              <div key={dm.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-2">{dm.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{dm.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Graticule */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Graticule</h2>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            A configurable circular grid is overlaid on the vectorscope display. It includes saturation rings at standard intervals,
            hue labels at 30° increments, and a fine angular grid. Opacity is adjustable in the settings panel.
          </p>
        </div>
      </section>

      {/* Platform Support */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Platform Support</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'Adobe Photoshop', desc: 'UXP panel plugin. Samples the active document on each pixel-level edit event. Supports all document color modes.' },
              { name: 'Lightroom Classic', desc: 'LrC SDK panel plugin. Responds to photo selection and develop module slider changes in real time.' },
            ].map((p) => (
              <div key={p.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-2">{p.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">AI Features <span className="text-sm font-normal text-indigo-400 ml-2">Pro + AI</span></h2>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            The Pro + AI tier unlocks AI-powered color analysis features. Coming soon: automatic color cast detection,
            reference image matching, and intelligent grading suggestions based on vectorscope data.
          </p>
          <Link href="/pricing" className="inline-block mt-6 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
            View Pro + AI Pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
