// app/api/lead/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as http from 'http';
import * as https from 'https';
import * as dns from 'dns';

// --- SSRF PROTECTION LOGIC (Fixes TOCTOU DNS Rebinding) ---
const isPrivateIP = (ip: string) => {
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (
      parts[0] === 127 || // Loopback
      parts[0] === 10 || // Private class A
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // Private class B
      (parts[0] === 192 && parts[1] === 168) || // Private class C
      (parts[0] === 169 && parts[1] === 254) || // Link-local (AWS metadata)
      parts[0] === 0 || // Current network
      parts[0] === 255 // Broadcast
    ) return true;
    return false;
  }
  // Basic IPv6 loopback / unique local check
  const ipv6 = ip.toLowerCase();
  if (
    ipv6 === '::1' || 
    ipv6.startsWith('fc') || 
    ipv6.startsWith('fd') || 
    ipv6.startsWith('fe8') || 
    ipv6.startsWith('fe9') || 
    ipv6.startsWith('fea') || 
    ipv6.startsWith('feb')
  ) return true;
  
  return false;
};

// Force the HTTP request to use our validated IP resolution immediately at socket connection
const secureLookup = (hostname: string, options: any, callback: any) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);
    if (isPrivateIP(address)) {
      return callback(new Error(`SSRF Prevention: Resolution of ${hostname} to ${address} is forbidden.`), address, family);
    }
    callback(null, address, family);
  });
};

function safeFetch(targetUrl: string, options: any = {}, redirectCount = 0): Promise<any> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    try {
      const url = new URL(targetUrl);
      
      // Strict protocol enforcement
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return reject(new Error('Invalid protocol'));
      }
      
      // Block blatant localhost queries immediately
      if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal')) {
        return reject(new Error('Forbidden hostname'));
      }

      const client = url.protocol === 'https:' ? https : http;
      
      const headers = { ...options.headers };
      if (options.body) {
        headers['Content-Length'] = Buffer.byteLength(options.body);
      }
      
      const reqOptions: http.RequestOptions | https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers,
        lookup: secureLookup as any, // Injects SSRF mitigation at the socket level
      };

      const req = client.request(reqOptions, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          return resolve(safeFetch(redirectUrl, options, redirectCount + 1));
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
            status: res.statusCode || 500,
            statusText: res.statusMessage || '',
            text: async () => data,
            json: async () => JSON.parse(data)
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request Timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
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

    // Payload Size and Type Validation (Mitigates Insufficient Payload Size Limits / Memory Bloat)
    if (
      typeof name !== 'string' || name.length > 100 ||
      typeof email !== 'string' || email.length > 255 ||
      typeof spaceId !== 'string' || spaceId.length > 50
    ) {
      return NextResponse.json({ error: 'Payload validation failed or data exceeds allowed length.' }, { status: 400, headers: corsHeaders });
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
        await safeFetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            spaceId, 
            name, 
            email, 
            timestamp: new Date().toISOString() 
          })
        });
      } catch (webhookErr: any) {
        console.error(`Webhook trigger failed or blocked by SSRF checks:`, webhookErr.message);
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
