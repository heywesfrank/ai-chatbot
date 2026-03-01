// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as any });
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    // Verify the webhook signature to ensure it actually came from Stripe
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    // Handle successful checkout
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // This is the spaceId we passed when creating the checkout session
      const spaceId = session.client_reference_id; 
      
      if (spaceId) {
        await supabase
          .from('bot_config')
          .update({
            plan: 'premium',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          })
          .eq('space_id', spaceId);
      }
    }

    // Handle subscription cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      
      await supabase
        .from('bot_config')
        .update({ plan: 'free' })
        .eq('stripe_subscription_id', subscription.id);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Handler Error:', err);
    return NextResponse.json({ error: 'Webhook Handler Failed' }, { status: 500 });
  }
}      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      
      await supabase
        .from('bot_config')
        .update({ plan: 'free' })
        .eq('stripe_subscription_id', subscription.id);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Handler Error:', err);
    return NextResponse.json({ error: 'Webhook Handler Failed' }, { status: 500 });
  }
}
