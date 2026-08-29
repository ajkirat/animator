// api/kling.js — Vercel Serverless Function (ES Module)
// Uses native fetch (Node 18+, Vercel default)

const KLING_BASE = 'https://api.klingai.com';

function send(res, status, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(obj);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body || {};
    const { action, apiKey } = body;
    if (!apiKey) return send(res, 400, { error: 'Missing Kling API key' });

    const authHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    if (action === 'create') {
      const { prompt, negativePrompt = '', quality = 'std', duration = 10 } = body;
      if (!prompt) return send(res, 400, { error: 'Missing prompt' });

      const r = await fetch(`${KLING_BASE}/v1/videos/text2video`, {
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
      const data = await r.json();
      if (!r.ok) return send(res, r.status, { error: data?.message ?? `Kling ${r.status}` });
      return send(res, 200, { taskId: data?.data?.task_id });
    }

    if (action === 'check') {
      const { taskId } = body;
      if (!taskId) return send(res, 400, { error: 'Missing taskId' });

      const r = await fetch(`${KLING_BASE}/v1/videos/text2video/${taskId}`, { headers: authHeaders });
      const data = await r.json();
      if (!r.ok) return send(res, r.status, { error: data?.message ?? `Kling ${r.status}` });

      const task = data?.data;
      const videos = task?.task_result?.videos ?? [];
      return send(res, 200, {
        status: task?.task_status ?? 'processing',
        videoUrl: videos[0]?.url,
        thumbnailUrl: videos[0]?.cover_image_url,
        errorMessage: task?.task_status_msg,
      });
    }

    return send(res, 400, { error: `Unknown action: ${action}` });
  } catch (err) {
    return send(res, 500, { error: err.message || 'Internal error' });
  }
}
