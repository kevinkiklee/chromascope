import { NextRequest, NextResponse } from 'next/server';
import { createTrialLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  const license = await createTrialLicense(email);
  return NextResponse.json({ key: license.key, expires_at: license.expires_at });
}
