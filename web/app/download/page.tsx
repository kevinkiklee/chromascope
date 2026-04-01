import Link from 'next/link';

const GITHUB_RELEASES = 'https://github.com/chromascope/chromascope/releases/latest';

const platforms = [
  {
    name: 'macOS',
    icon: '◆',
    desc: 'Universal binary — Apple Silicon and Intel.',
    href: `${GITHUB_RELEASES}/download/chromascope-macos.zip`,
  },
  {
    name: 'Windows',
    icon: '◇',
    desc: 'Windows 10+ (64-bit).',
    href: `${GITHUB_RELEASES}/download/chromascope-windows.zip`,
  },
];

export default function DownloadPage() {
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
            Get Chromascope
          </h1>
          <p className="text-zinc-400 text-lg">Free and open source. Choose your platform below.</p>
        </div>
      </header>

      <main className="py-8 px-6 max-w-xl mx-auto space-y-5">
        {platforms.map((p) => (
          <a
            key={p.name}
            href={p.href}
            className="card-glass rounded-xl p-7 flex items-center gap-5 group hover:border-white/[0.1] transition-all duration-300 block"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-white/[0.06] flex items-center justify-center text-xl text-violet-400 flex-shrink-0">
              {p.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-200 mb-0.5">{p.name}</h2>
              <p className="text-zinc-500 text-sm">{p.desc}</p>
            </div>
            <span className="text-violet-400 text-sm font-medium group-hover:translate-x-0.5 transition-transform">
              Download &darr;
            </span>
          </a>
        ))}

        {/* Installation instructions */}
        <section className="card-glass rounded-xl p-7 mt-8">
          <h2 className="font-semibold text-zinc-200 mb-4">Installation</h2>
          <div className="space-y-4 text-sm text-zinc-400">
            <div>
              <h3 className="text-zinc-300 font-medium mb-1">Photoshop</h3>
              <p>Unzip and install via the UXP Developer Tool or copy to your Creative Cloud plugins directory.</p>
            </div>
            <div>
              <h3 className="text-zinc-300 font-medium mb-1">Lightroom Classic</h3>
              <p>
                Unzip and copy the <code className="text-violet-300/80 bg-zinc-900/60 px-1.5 py-0.5 rounded text-xs font-mono">chromascope.lrdevplugin</code> folder
                to your plugins directory. Enable via <strong>File &gt; Plug-in Manager &gt; Add</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* Source link */}
        <div className="text-center pt-4">
          <p className="text-zinc-600 text-sm">
            Or build from source on{' '}
            <Link href="https://github.com/chromascope/chromascope" className="text-violet-400 hover:text-violet-300 transition-colors">
              GitHub
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
