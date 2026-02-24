// app/(dashboard)/integrations/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');

  const fetchIntegrations = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', session.user.id).maybeSingle();
    if (config) setActiveSpaceId(config.space_id);

    const res = await fetch('/api/integrations', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setIntegrations(data.integrations || []);
      const wh = data.integrations.find((i: any) => i.provider === 'webhook');
      if (wh) setWebhookUrl(wh.config.webhook_url);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const handleSaveWebhook = async () => {
    if (!activeSpaceId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ spaceId: activeSpaceId, provider: 'webhook', config: { webhook_url: webhookUrl } })
    });
    toast.success('Webhook saved.');
    fetchIntegrations();
  };

  const handleDisconnectSlack = async () => {
    if (!activeSpaceId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`/api/integrations?provider=slack`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    toast.success('Slack disconnected.');
    fetchIntegrations();
  };

  const slackConfig = integrations.find(i => i.provider === 'slack');

  return (
    <div className="p-8 max-w-[1000px] mx-auto overflow-y-auto h-full bg-[#FAFAFA]">
      <div className="mb-8">
        <h1 className="text-xl font-medium tracking-tight">Integrations</h1>
        <p className="text-gray-500 text-sm">Connect third-party services to your workspace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slack Card */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Slack</h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">Route user tickets directly to a Slack channel and reply to them from within Slack.</p>
          </div>
          {slackConfig ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-md">
              <span className="text-sm font-medium text-green-800">Connected</span>
              <button onClick={handleDisconnectSlack} className="text-xs text-red-600 font-medium hover:text-red-800">Disconnect</button>
            </div>
          ) : (
            <a href={`https://slack.com/oauth/v2/authorize?client_id=${process.env.NEXT_PUBLIC_SLACK_CLIENT_ID}&scope=chat:write,incoming-webhook,channels:history,groups:history&state=${activeSpaceId}`} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
               Connect Slack
            </a>
          )}
        </div>

        {/* Webhook Card */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Lead Capture Webhook</h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">Send captured leads directly to Zapier, Make.com, or your own CRM.</p>
          </div>
          <div className="flex flex-col gap-3">
            <input type="url" placeholder="https://hooks.zapier.com/..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
            <button onClick={handleSaveWebhook} disabled={!webhookUrl} className="self-end px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors">Save Webhook</button>
          </div>
        </div>
      </div>
    </div>
  );
}
