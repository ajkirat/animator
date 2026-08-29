/**
 * kling-proxy — Supabase Edge Function
 * Proxies requests to Kling AI's video generation API.
 *
 * Actions:
 *   create — Submit a text-to-video task
 *   check  — Poll an existing task for status
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KLING_BASE = 'https://api.klingai.com';

async function makeJWT(accessKey: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const b64url = (s: string) =>
    btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }));
  const msg     = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));

  return `${msg}.${sigB64}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, accessKey, secretKey } = body;

    if (!accessKey || !secretKey) {
      return new Response(JSON.stringify({ error: 'Missing Kling credentials' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt  = await makeJWT(accessKey, secretKey);
    const auth = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

    /* ── CREATE ─────────────────────────────────────────────────────────── */
    if (action === 'create') {
      const { prompt, negativePrompt = '', quality = 'std', duration = 5 } = body;
      if (!prompt) return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      const resp = await fetch(`${KLING_BASE}/v1/videos/text2video`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          model_name: quality === 'pro' ? 'kling-v1-5' : 'kling-v1',
          prompt,
          negative_prompt: negativePrompt,
          cfg_scale: 0.5,
          mode: quality,
          aspect_ratio: '16:9',
          duration: String(duration),
        }),
      });

      const json = await resp.json();
      if (!resp.ok) return new Response(JSON.stringify({ error: json?.message ?? `Kling ${resp.status}` }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      return new Response(JSON.stringify({ taskId: json?.data?.task_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    /* ── CHECK ──────────────────────────────────────────────────────────── */
    if (action === 'check') {
      const { taskId } = body;
      if (!taskId) return new Response(JSON.stringify({ error: 'Missing taskId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      const resp = await fetch(`${KLING_BASE}/v1/videos/text2video/${taskId}`, { headers: auth });
      const json = await resp.json();

      if (!resp.ok) return new Response(JSON.stringify({ error: json?.message ?? `Kling ${resp.status}` }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      const task   = json?.data;
      const videos = task?.task_result?.videos ?? [];
      return new Response(JSON.stringify({
        status:       task?.task_status ?? 'processing',
        videoUrl:     videos[0]?.url,
        thumbnailUrl: videos[0]?.cover_image_url,
        errorMessage: task?.task_status_msg,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
