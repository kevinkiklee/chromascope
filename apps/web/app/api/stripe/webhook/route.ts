import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { createPaidLicense } from '@/lib/license';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event;
  try {
    event = await constructWebhookEvent(payload, sig);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as import('stripe').Stripe.Checkout.Session;
      const email = session.customer_details?.email ?? session.customer_email ?? '';
      const customerId = typeof session.customer === 'string' ? session.customer : '';
      // Determine tier from metadata or line items — default to 'pro'
      const tier = (session.metadata?.tier as 'pro' | 'pro_ai') ?? 'pro';
      if (email) {
        const license = await createPaidLicense(email, tier, customerId);
        // TODO: send license key email to `email` with key `license.key`
        console.log(`License created: ${license.key} for ${email}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : '';
      if (customerId) {
        // Downgrade Pro + AI licenses for this customer to Pro
        await sql`
          UPDATE licenses
          SET tier = 'pro'
          WHERE stripe_customer_id = ${customerId}
            AND tier = 'pro_ai'
            AND is_active = TRUE
        `;
        console.log(`Subscription deleted for customer ${customerId} — downgraded to Pro`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as import('stripe').Stripe.Invoice;
      // Grace period logic: log for now, implement downgrade after N days in follow-up
      console.warn(`Payment failed for customer ${invoice.customer}`);
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
