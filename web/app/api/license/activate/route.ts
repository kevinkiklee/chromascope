import { NextRequest, NextResponse } from 'next/server';
import { activateLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, machine_id, platform } = body ?? {};

  if (!key || !machine_id || !platform) {
    return NextResponse.json({ error: 'Missing key, machine_id, or platform' }, { status: 400 });
  }

  const result = await activateLicense(key, machine_id, platform);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
