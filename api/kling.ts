/**
 * api/kling.ts — Vercel Serverless Function
 * Proxies requests to Kling AI's video generation API.
 * No Supabase needed — just deploy to Vercel.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';

const KLING_BASE = 'https://api.klingai.com';

function makeJWT(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);

  const b64url = (s: string) =>
    Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }));
  const msg     = `${header}.${payload}`;

  const sig = createHmac('sha256', secretKey).update(msg).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${msg}.${sig}`;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers'])
      .setHeader('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods'])
      .end();
  }

  try {
    const body = req.body ?? {};
    const { action, accessKey, secretKey } = body;

    if (!accessKey || !secretKey) {
      return res.status(400).set(cors).json({ error: 'Missing Kling credentials' });
    }

    const jwt  = makeJWT(accessKey, secretKey);
    const auth = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

    /* ── CREATE ─────────────────────────────────────────────────────────── */
    if (action === 'create') {
      const { prompt, negativePrompt = '', quality = 'std', duration = 5 } = body;
      if (!prompt) return res.status(400).set(cors).json({ error: 'Missing prompt' });

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

      const json = await resp.json() as any;
      if (!resp.ok) return res.status(resp.status).set(cors).json({ error: json?.message ?? `Kling ${resp.status}` });

      return res.status(200).set(cors).json({ taskId: json?.data?.task_id });
    }

    /* ── CHECK ──────────────────────────────────────────────────────────── */
    if (action === 'check') {
      const { taskId } = body;
      if (!taskId) return res.status(400).set(cors).json({ error: 'Missing taskId' });

      const resp = await fetch(`${KLING_BASE}/v1/videos/text2video/${taskId}`, { headers: auth });
      const json = await resp.json() as any;

      if (!resp.ok) return res.status(resp.status).set(cors).json({ error: json?.message ?? `Kling ${resp.status}` });

      const task   = json?.data;
      const videos = task?.task_result?.videos ?? [];
      return res.status(200).set(cors).json({
        status:       task?.task_status ?? 'processing',
        videoUrl:     videos[0]?.url,
        thumbnailUrl: videos[0]?.cover_image_url,
        errorMessage: task?.task_status_msg,
      });
    }

    return res.status(400).set(cors).json({ error: `Unknown action: ${action}` });

  } catch (err: any) {
    return res.status(500).set(cors).json({ error: err?.message ?? 'Internal error' });
  }
}
