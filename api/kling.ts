/**
 * api/kling.ts — Vercel Serverless Function
 * Proxies requests to Kling AI's video generation API.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const KLING_BASE = 'https://api.klingai.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers'])
      .setHeader('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods'])
      .end();
  }

  try {
    const body = req.body ?? {};
    const { action, apiKey } = body;

    if (!apiKey) {
      return res.status(400).set(cors).json({ error: 'Missing Kling API key' });
    }

    const auth = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

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
