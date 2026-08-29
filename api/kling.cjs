// api/kling.js — Vercel Serverless Function
// Plain CJS with built-in https — works on Node 12/14/16/18/20.
const https = require('https');

const KLING_BASE = 'api.klingai.com';

function httpsPost(path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname: KLING_BASE, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: KLING_BASE, path, method: 'GET', headers },
      (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  });
  res.end(body);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    });
    return res.end();
  }

  try {
    const body = req.body || {};
    const { action, apiKey } = body;

    if (!apiKey) return send(res, 400, { error: 'Missing Kling API key' });

    const auth = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

    if (action === 'create') {
      const { prompt, negativePrompt = '', quality = 'std', duration = 10 } = body;
      if (!prompt) return send(res, 400, { error: 'Missing prompt' });

      const r = await httpsPost('/v1/videos/text2video', auth, {
        model_name: quality === 'pro' ? 'kling-v1-5' : 'kling-v1',
        prompt,
        negative_prompt: negativePrompt,
        cfg_scale: 0.5,
        mode: quality,
        aspect_ratio: '16:9',
        duration: String(duration),
      });

      if (r.status >= 400) return send(res, r.status, { error: r.body?.message ?? `Kling ${r.status}` });
      return send(res, 200, { taskId: r.body?.data?.task_id });
    }

    if (action === 'check') {
      const { taskId } = body;
      if (!taskId) return send(res, 400, { error: 'Missing taskId' });

      const r = await httpsGet(`/v1/videos/text2video/${taskId}`, auth);
      if (r.status >= 400) return send(res, r.status, { error: r.body?.message ?? `Kling ${r.status}` });

      const task = r.body?.data;
      const videos = task?.task_result?.videos ?? [];
      return send(res, 200, {
        status:       task?.task_status ?? 'processing',
        videoUrl:     videos[0]?.url,
        thumbnailUrl: videos[0]?.cover_image_url,
        errorMessage: task?.task_status_msg,
      });
    }

    return send(res, 400, { error: `Unknown action: ${action}` });

  } catch (err) {
    return send(res, 500, { error: err.message || 'Internal error' });
  }
};
