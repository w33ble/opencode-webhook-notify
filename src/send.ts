export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
  _fetch: typeof fetch = globalThis.fetch.bind(globalThis),
  headers?: Record<string, string>,
  method: string = "POST",
): Promise<void> {
  try {
    const response = await _fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: method === "GET" ? undefined : JSON.stringify(payload),
    })
    if (!response.ok) {
      console.error(`[webhook-notify] ${method} ${url} → ${response.status} ${response.statusText}`)
    }
  } catch (err) {
    console.error("[webhook-notify] webhook send failed:", err)
  }
}
