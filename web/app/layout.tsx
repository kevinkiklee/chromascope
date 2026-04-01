import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { NavBar } from '@/components/nav-bar';
import { Footer } from '@/components/footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chromascope — Professional Color Analysis',
  description: 'Chrominance vectorscope plugin for Adobe Photoshop and Lightroom Classic. Analyze, grade, and perfect your color.',
  metadataBase: new URL('https://chromascope.github.io/chromascope'),
  openGraph: {
    title: 'Chromascope — Professional Color Analysis',
    description: 'Chrominance vectorscope plugin for Adobe Photoshop and Lightroom Classic. Analyze, grade, and perfect your color.',
    siteName: 'Chromascope',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chromascope — Professional Color Analysis',
    description: 'Chrominance vectorscope plugin for Adobe Photoshop and Lightroom Classic.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-zinc-950 text-zinc-100 font-sans antialiased">
        <NavBar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
