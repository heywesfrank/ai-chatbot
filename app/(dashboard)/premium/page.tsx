// app/(dashboard)/premium/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useBotConfig } from '../BotConfigProvider';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

export default function PremiumPage() {
  const { config, activeSpaceId, isOwner } = useBotConfig();
  const [isProcessing, setIsProcessing] = useState(false);

  const isPremium = config?.plan === 'premium';

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ spaceId: activeSpaceId })
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize checkout');
      setIsProcessing(false);
    }
  };

  const handleCustomerPortal = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ spaceId: activeSpaceId })
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customer portal');
      setIsProcessing(false);
    }
  };

  if (isPremium) {
    return (
      <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
        <div className="max-w-[800px] mx-auto w-full p-8 pb-20 animate-in fade-in duration-300">
          <div className="mb-8 mt-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">Billing & Subscription</h1>
            <p className="text-gray-500 text-[15px] leading-relaxed max-w-lg">
              Manage your premium plan, payment methods, and billing history.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">Premium Plan</span>
              <span className="text-sm font-medium text-gray-500">Active</span>
            </div>
            <p className="text-sm text-gray-600 mb-10 leading-relaxed max-w-md">
              Your workspace is currently upgraded to the Premium tier. You have access to white-labeling, custom domains, and SEO optimization.
            </p>

            <button 
              onClick={handleCustomerPortal}
              disabled={!isOwner || isProcessing}
              className="w-full sm:w-auto px-6 py-3.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Loading...' : 'Manage Billing via Stripe'}
            </button>

            {!isOwner && (
              <p className="text-xs text-gray-400 mt-4">Only workspace owners can manage billing settings.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[800px] mx-auto w-full p-8 pb-20 animate-in fade-in duration-300">
        
        <div className="mb-10 text-center mt-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">Upgrade to Premium</h1>
          <p className="text-gray-500 text-[15px] leading-relaxed max-w-lg mx-auto">
            Take full control of your brand and turn your documentation into a powerful SEO engine.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-8 border-b border-gray-100 gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Premium Plan</h2>
                <p className="text-sm text-gray-500 mt-1">Everything in free, plus:</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-4xl font-bold text-gray-900">$25<span className="text-lg text-gray-400 font-medium">/mo</span></div>
              </div>
            </div>

            <div className="space-y-8 mb-10">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Remove All Branding</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">Remove the "Powered by Apoyo" watermark from both your chat widget and your public help center. Make it fully yours.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Custom Domain & SEO</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">Connect your own domain (e.g., <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">help.yourwebsite.com</code>). Our help center pages are automatically SEO-optimized out of the box to help you capture organic search traffic directly to your support articles.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={!isOwner || isProcessing}
              className="w-full py-3.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Loading...' : (isOwner ? 'Subscribe Now' : 'Only workspace owners can subscribe')}
            </button>
          </div>
          
          <div className="bg-gray-50 px-8 py-5 border-t border-gray-100 flex items-center justify-center gap-2 text-xs font-medium text-gray-500">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Secure payment powered by Stripe. Cancel anytime.
          </div>
        </div>

      </div>
    </div>
  );
}
