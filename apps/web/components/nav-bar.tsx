'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/download', label: 'Download' },
  { href: '/docs', label: 'Docs' },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/[0.06] px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-6 h-6 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #f43f5e, #f97316, #eab308, #22c55e, #06b6d4, #8b5cf6, #f43f5e)',
              filter: 'blur(0.3px)',
            }}
          />
          <span className="font-bold text-lg tracking-tight gradient-text-subtle">
            Chromascope
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === link.href
                  ? 'text-zinc-100 bg-white/[0.04]'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/download"
            className="btn-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium ml-3"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
