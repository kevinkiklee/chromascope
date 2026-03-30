import { sql } from './db';

const MAX_ACTIVATIONS = 3;

export function generateLicenseKey(): string {
  // Format: CHRM-XXXX-XXXX-XXXX (uppercase hex segments)
  const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  return `CHRM-${uuid.slice(0, 4)}-${uuid.slice(4, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}`;
}

export interface LicenseRecord {
  id: string;
  key: string;
  email: string;
  tier: 'trial' | 'pro' | 'pro_ai';
  stripe_customer_id: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export async function createTrialLicense(email: string): Promise<LicenseRecord> {
  const key = generateLicenseKey();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sql`
    INSERT INTO licenses (key, email, tier, expires_at)
    VALUES (${key}, ${email}, 'trial', ${expiresAt})
    RETURNING *
  `;
  return rows[0] as LicenseRecord;
}

export async function createPaidLicense(
  email: string,
  tier: 'pro' | 'pro_ai',
  stripeCustomerId: string,
): Promise<LicenseRecord> {
  const key = generateLicenseKey();
  const rows = await sql`
    INSERT INTO licenses (key, email, tier, stripe_customer_id)
    VALUES (${key}, ${email}, ${tier}, ${stripeCustomerId})
    RETURNING *
  `;
  return rows[0] as LicenseRecord;
}

export interface ValidationResult {
  valid: boolean;
  tier?: string;
  expires_at?: string | null;
  features: string[];
  error?: string;
}

export async function validateLicense(key: string, machineId?: string): Promise<ValidationResult> {
  const rows = await sql`
    SELECT * FROM licenses WHERE key = ${key} AND is_active = TRUE LIMIT 1
  `;
  if (rows.length === 0) return { valid: false, features: [], error: 'License not found or inactive' };

  const license = rows[0] as LicenseRecord;

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { valid: false, features: [], error: 'License expired' };
  }

  const features = tierFeatures(license.tier);
  return { valid: true, tier: license.tier, expires_at: license.expires_at, features };
}

export interface ActivationResult {
  success: boolean;
  error?: string;
}

export async function activateLicense(key: string, machineId: string, platform: string): Promise<ActivationResult> {
  const rows = await sql`
    SELECT * FROM licenses WHERE key = ${key} AND is_active = TRUE LIMIT 1
  `;
  if (rows.length === 0) return { success: false, error: 'License not found or inactive' };

  const license = rows[0] as LicenseRecord;

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { success: false, error: 'License expired' };
  }

  const existing = await sql`
    SELECT * FROM activations WHERE license_id = ${license.id} AND machine_id = ${machineId} LIMIT 1
  `;
  if (existing.length > 0) return { success: true }; // already activated on this machine

  const count = await sql`
    SELECT COUNT(*) AS cnt FROM activations WHERE license_id = ${license.id}
  `;
  if (Number(count[0].cnt) >= MAX_ACTIVATIONS) {
    return { success: false, error: 'Maximum machine activations reached' };
  }

  await sql`
    INSERT INTO activations (license_id, machine_id, platform)
    VALUES (${license.id}, ${machineId}, ${platform})
    ON CONFLICT (license_id, machine_id) DO NOTHING
  `;
  return { success: true };
}

export async function deactivateLicense(key: string, machineId: string): Promise<ActivationResult> {
  const rows = await sql`
    SELECT id FROM licenses WHERE key = ${key} LIMIT 1
  `;
  if (rows.length === 0) return { success: false, error: 'License not found' };

  const licenseId = rows[0].id;
  await sql`
    DELETE FROM activations WHERE license_id = ${licenseId} AND machine_id = ${machineId}
  `;
  return { success: true };
}

function tierFeatures(tier: string): string[] {
  const base = ['color_spaces', 'density_modes', 'graticule', 'photoshop', 'lightroom'];
  if (tier === 'pro_ai') return [...base, 'ai'];
  return base;
}
