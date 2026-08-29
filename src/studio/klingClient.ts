async function callEdge(body: object) {
  const res = await fetch('/api/kling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || (json as any).error) throw new Error((json as any).error ?? `HTTP ${res.status}`);
  return json;
}

export async function submitKlingTask(
  prompt: string,
  negativePrompt: string,
  apiKey: string,
  quality: 'std' | 'pro',
  duration: 5 | 10
): Promise<{ taskId: string }> {
  const data = await callEdge({ action: 'create', prompt, negativePrompt, apiKey, quality, duration }) as any;
  return { taskId: data.taskId };
}

export async function checkKlingTask(
  taskId: string,
  apiKey: string
): Promise<{ status: string; videoUrl?: string; thumbnailUrl?: string; errorMessage?: string }> {
  return callEdge({ action: 'check', taskId, apiKey }) as any;
}
