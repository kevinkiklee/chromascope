import Link from 'next/link';

const footerLinks = [
  { href: '/features', label: 'Features' },
  { href: '/download', label: 'Download' },
  { href: '/docs', label: 'Docs' },
  { href: 'https://github.com/chromascope/chromascope', label: 'GitHub' },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-full opacity-60"
              style={{
                background: 'conic-gradient(from 0deg, #f43f5e, #f97316, #eab308, #22c55e, #06b6d4, #8b5cf6, #f43f5e)',
              }}
            />
            <span className="text-sm text-zinc-500 font-medium">Chromascope</span>
          </div>

          <div className="flex gap-6 text-sm">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="text-zinc-600 text-xs">
            &copy; {new Date().getFullYear()} Chromascope
          </p>
        </div>
      </div>
    </footer>
  );
}
