export async function callAi(messages: any[], model?: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Ganti localhost dengan path relatif agar bisa diakses dari HP via Vite Proxy
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ messages, model }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      // Try to read body for better error messages
      let bodyText = '';
      try { bodyText = await res.text(); } catch (e) { bodyText = String(e); }
      throw new Error(`Network error contacting AI endpoint: ${res.status} ${res.statusText} - ${bodyText}`);
    }

    // Some responses may include non-JSON text; try parse defensively
    const text = await res.text();
    try { return JSON.parse(text) as { reply: any; model_used?: string; offline?: boolean }; }
    catch (e) { return { reply: text } as any; }
  } catch (err: any) {
    if (err && err.name === 'AbortError') throw new Error('AI request timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonLike(input: any): any | null {
  if (!input && input !== 0) return null;
  if (typeof input === 'object') return input;
  const s = String(input).trim();
  // try direct parse
  try { return JSON.parse(s); } catch (e) {}

  // try to extract object or array
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch (e) {}
  }
  const arrMatch = s.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch (e) {}
  }
  return null;
}