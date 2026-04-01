import { NextRequest, NextResponse } from 'next/server';
import { deactivateLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, machine_id } = body ?? {};

  if (!key || !machine_id) {
    return NextResponse.json({ error: 'Missing key or machine_id' }, { status: 400 });
  }

  const result = await deactivateLicense(key, machine_id);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
