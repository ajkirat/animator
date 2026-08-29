const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function callEdge(body: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/kling-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export async function submitKlingTask(
  prompt: string,
  negativePrompt: string,
  accessKey: string,
  secretKey: string,
  quality: 'std' | 'pro',
  duration: 5 | 10
): Promise<{ taskId: string }> {
  const data = await callEdge({ action: 'create', prompt, negativePrompt, accessKey, secretKey, quality, duration });
  return { taskId: data.taskId };
}

export async function checkKlingTask(
  taskId: string,
  accessKey: string,
  secretKey: string
): Promise<{ status: string; videoUrl?: string; thumbnailUrl?: string; errorMessage?: string }> {
  return callEdge({ action: 'check', taskId, accessKey, secretKey });
}
