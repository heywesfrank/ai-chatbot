// app/api/stripe/portal/route.ts
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

    // Fetch the customer ID tied to this workspace
    const { data: config } = await supabase
      .from('bot_config')
      .select('user_id, stripe_customer_id')
      .eq('space_id', spaceId)
      .single();

    if (config?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!config.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: config.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/premium`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Stripe Portal Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
