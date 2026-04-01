import { NextRequest, NextResponse } from 'next/server';
import { validateLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, machine_id } = body ?? {};

  if (!key || !machine_id) {
    return NextResponse.json({ error: 'Missing key or machine_id' }, { status: 400 });
  }

  const result = await validateLicense(key, machine_id);

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 403 });
  }

  return NextResponse.json({
    valid: true,
    tier: result.tier,
    expires_at: result.expires_at,
    features: result.features,
  });
}
