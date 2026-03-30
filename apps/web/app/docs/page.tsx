import Link from 'next/link';

const sections = [
  {
    id: 'installation',
    title: 'Installation',
    content: `Download the plugin for your platform from the Download page. For Photoshop, install via the UXP Developer Tool or the Creative Cloud plugin manager. For Lightroom Classic, copy the plugin folder to your Lightroom plugins directory and enable it via Plug-in Manager.`,
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: `Open the Vectorscope panel in Photoshop (Window → Plugins → Vectorscope) or Lightroom Classic (Window → Panels → Vectorscope). The panel activates automatically when you open a document or select a photo. Use the toolbar to switch color spaces and density modes.`,
  },
  {
    id: 'color-spaces',
    title: 'Color Spaces',
    content: `YCbCr separates luminance from chrominance — useful for broadcast-compliant grading. CIE LUV is perceptually uniform, making it ideal for precise colorimetric analysis. HSL (Hue-Saturation-Lightness) provides an intuitive view suitable for artistic workflows.`,
  },
  {
    id: 'density-modes',
    title: 'Density Modes',
    content: `Scatter plots each pixel as a point. Heatmap accumulates pixel frequency and maps it to color — denser regions appear brighter. Bloom applies a glow effect to high-density clusters, making dominant color populations visually distinct.`,
  },
  {
    id: 'license-faq',
    title: 'License FAQ',
    content: `Your license supports up to 3 machine activations. To move to a new machine, deactivate one of your existing machines from the Account page. Trial licenses are valid for 14 days from the date of creation. Pro licenses do not expire. Pro + AI licenses are annual subscriptions.`,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    content: `If the panel does not update, ensure the plugin is connected (check the status indicator in the panel header). For license errors, verify your key on the Account page. If you reach the machine activation limit, deactivate an unused machine. Contact support via the email in your license confirmation.`,
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="text-zinc-100">Docs</Link>
            <Link href="/download" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 flex gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden md:block w-48 shrink-0">
          <nav className="sticky top-8 space-y-1 text-sm">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-zinc-400 hover:text-zinc-100 py-1 transition-colors">
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-2xl space-y-12">
          <h1 className="text-3xl font-bold">Documentation</h1>
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="text-xl font-semibold mb-3">{s.title}</h2>
              <p className="text-zinc-400 leading-relaxed">{s.content}</p>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
