export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
  _fetch: typeof fetch = globalThis.fetch.bind(globalThis),
  headers?: Record<string, string>,
): Promise<void> {
  try {
    const response = await _fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      console.error(`[webhook-notify] POST ${url} → ${response.status} ${response.statusText}`)
    }
  } catch (err) {
    console.error("[webhook-notify] webhook send failed:", err)
  }
}
