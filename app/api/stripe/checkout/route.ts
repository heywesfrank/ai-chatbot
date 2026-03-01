// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as any });

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await req.json();

    const { data: config } = await supabase.from('bot_config').select('user_id').eq('space_id', spaceId).single();
    if (config?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Use your Stripe Subscription Price ID here
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/premium?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/premium?canceled=true`,
      client_reference_id: spaceId,
      customer_email: user.email,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
