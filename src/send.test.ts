import { describe, test, expect, mock } from "bun:test"
import { sendWebhook } from "./send"

test("POSTs JSON payload to webhook URL", async () => {
  const fetchMock = mock((url: string, init: RequestInit) => {
    expect(url).toBe("https://hooks.example.com/test")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ "Content-Type": "application/json" })
    const body = JSON.parse(init.body as string)
    expect(body.event).toBe("session.idle")
    expect(body.timestamp).toBeDefined()
    expect(body.project).toBe("/test/project")
    return Promise.resolve(new Response(null, { status: 200 }))
  })

  await sendWebhook("https://hooks.example.com/test", {
    event: "session.idle",
    timestamp: new Date().toISOString(),
    project: "/test/project",
  }, fetchMock)
})

test("does not throw on fetch failure", async () => {
  const fetchMock = mock(() => Promise.reject(new Error("network error")))

  // Should not throw
  await sendWebhook("https://bad.example.com", {}, fetchMock)
})

test("includes custom headers when provided", async () => {
  const fetchMock = mock((url: string, init: RequestInit) => {
    expect(init.headers).toEqual({ "Content-Type": "application/json", "Authorization": "Bearer test123" })
    return Promise.resolve(new Response(null, { status: 200 }))
  })

  await sendWebhook("https://example.com", { event: "test" }, fetchMock, { "Authorization": "Bearer test123" })
})

test("uses custom HTTP method when provided", async () => {
  const fetchMock = mock((url: string, init: RequestInit) => {
    expect(init.method).toBe("PUT")
    return Promise.resolve(new Response(null, { status: 200 }))
  })

  await sendWebhook("https://example.com", { event: "test" }, fetchMock, undefined, "PUT")
})

test("logs error on non-2xx response", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(new Response("not found", { status: 404 }))
  )

  // Should not throw
  await sendWebhook("https://example.com", { event: "test" }, fetchMock)
})
