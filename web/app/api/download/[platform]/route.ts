import { NextRequest, NextResponse } from 'next/server';
import { validateLicense } from '@/lib/license';

const DOWNLOAD_URLS: Record<string, string | undefined> = {
  macos: process.env.DOWNLOAD_URL_MACOS,
  windows: process.env.DOWNLOAD_URL_WINDOWS,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const key = req.nextUrl.searchParams.get('key') ?? '';

  if (!DOWNLOAD_URLS[platform]) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
  }

  if (!key) {
    return NextResponse.redirect(new URL('/download', req.url));
  }

  // Use a placeholder machine_id for download validation (no activation)
  const result = await validateLicense(key, '__download_check__');
  if (!result.valid) {
    return NextResponse.redirect(new URL('/download?error=invalid_key', req.url));
  }

  return NextResponse.redirect(DOWNLOAD_URLS[platform]!);
}
