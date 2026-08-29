/**
 * api/kling.ts — Vercel Serverless Function (Node 18+)
 * Proxies requests to Kling AI's video generation API.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const KLING_BASE = 'https://api.klingai.com';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

function json(res: VercelResponse, status: number, body: object) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body: any = req.body ?? {};
    const { action, apiKey } = body;

    if (!apiKey) {
      return json(res, 400, { error: 'Missing Kling API key' });
    }

    const authHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    /* ── CREATE ─────────────────────────────────────────────────────────── */
    if (action === 'create') {
      const { prompt, negativePrompt = '', quality = 'std', duration = 10 } = body;
      if (!prompt) return json(res, 400, { error: 'Missing prompt' });

      const resp = await fetch(`${KLING_BASE}/v1/videos/text2video`, {
        method: 'POST',
        headers: authHeaders,
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

      const data: any = await resp.json();
      if (!resp.ok) {
        return json(res, resp.status, { error: data?.message ?? `Kling error ${resp.status}` });
      }
      return json(res, 200, { taskId: data?.data?.task_id });
    }

    /* ── CHECK ──────────────────────────────────────────────────────────── */
    if (action === 'check') {
      const { taskId } = body;
      if (!taskId) return json(res, 400, { error: 'Missing taskId' });

      const resp = await fetch(`${KLING_BASE}/v1/videos/text2video/${taskId}`, {
        headers: authHeaders,
      });

      const data: any = await resp.json();
      if (!resp.ok) {
        return json(res, resp.status, { error: data?.message ?? `Kling error ${resp.status}` });
      }

      const task   = data?.data;
      const videos = task?.task_result?.videos ?? [];
      return json(res, 200, {
        status:       task?.task_status ?? 'processing',
        videoUrl:     videos[0]?.url,
        thumbnailUrl: videos[0]?.cover_image_url,
        errorMessage: task?.task_status_msg,
      });
    }

    return json(res, 400, { error: `Unknown action: ${action}` });

  } catch (err: any) {
    return json(res, 500, { error: err?.message ?? 'Internal server error' });
  }
}
