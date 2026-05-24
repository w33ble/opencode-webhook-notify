export async function sendWebhook(
  url: string,
  payload: Record<string, unknown> | string,
  _fetch: typeof fetch = globalThis.fetch.bind(globalThis),
  headers?: Record<string, string>,
  method: string = "POST",
): Promise<void> {
  try {
    const isText = typeof payload === "string"
    const response = await _fetch(url, {
      method,
      headers: { "Content-Type": isText ? "text/plain" : "application/json", ...headers },
      body: method === "GET" ? undefined : isText ? payload : JSON.stringify(payload),
    })
    if (!response.ok) {
      console.error(`[webhook-notify] ${method} ${url} → ${response.status} ${response.statusText}`)
    }
  } catch (err) {
    console.error("[webhook-notify] webhook send failed:", err)
  }
}
