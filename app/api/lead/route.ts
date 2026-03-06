// app/api/lead/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as dns from 'dns';
import { promisify } from 'util';

const lookupAsync = promisify(dns.lookup);

// --- SSRF PROTECTION LOGIC ---
async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(urlStr);

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    const hostname = parsedUrl.hostname;

    // Block obvious local/private strings
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }

    // Resolve the hostname to an IP to prevent DNS Rebinding / hidden internal IPs
    const { address } = await lookupAsync(hostname);

    // Check if the IP is in a private/reserved range
    if (address.includes('.')) {
      const parts = address.split('.').map(Number);
      if (
        parts[0] === 127 || // Loopback
        parts[0] === 10 || // Private class A
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // Private class B
        (parts[0] === 192 && parts[1] === 168) || // Private class C
        (parts[0] === 169 && parts[1] === 254) || // Link-local (AWS metadata)
        parts[0] === 0 || // Current network
        parts[0] === 255 // Broadcast
      ) {
        return false;
      }
    } else {
      // Basic IPv6 loopback / unique local check
      const ip = address.toLowerCase();
      if (
        ip === '::1' || 
        ip.startsWith('fc') || 
        ip.startsWith('fd') || 
        ip.startsWith('fe8') || 
        ip.startsWith('fe9') || 
        ip.startsWith('fea') || 
        ip.startsWith('feb')
      ) {
        return false;
      }
    }

    return true;
  } catch (error) {
    // Fail securely if DNS lookup fails or the URL is malformed
    return false;
  }
}
// --- END SSRF PROTECTION LOGIC ---

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': origin, 
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    const { spaceId, name, email } = await req.json();

    if (!spaceId || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const { error } = await supabase
      .from('leads')
      .insert({ space_id: spaceId, name, email });

    if (error) throw error;

    // Check if the user has a Lead webhook configured via Integrations table
    const { data: webhookIntegration } = await supabase
      .from('workspace_integrations')
      .select('config')
      .eq('space_id', spaceId)
      .eq('provider', 'webhook')
      .maybeSingle();

    const webhookUrl = webhookIntegration?.config?.webhook_url;

    if (webhookUrl) {
      try {
        const isSafe = await isSafeUrl(webhookUrl);
        
        if (!isSafe) {
          console.warn(`[SSRF BLOCK] Attempted unsafe webhook URL trigger: ${webhookUrl}`);
        } else {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              spaceId, 
              name, 
              email, 
              timestamp: new Date().toISOString() 
            })
          });
        }
      } catch (webhookErr) {
        console.error("Webhook trigger failed:", webhookErr);
        // Do not throw; we still successfully captured the lead in Supabase
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Lead API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to save lead' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
