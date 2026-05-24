import type { Plugin } from "@opencode-ai/plugin"
import { loadConfig } from "./config"
import { sendWebhook } from "./send"

export const WebhookNotify: Plugin = async ({ project, client }) => {
  const config = loadConfig()
  if (!config) return {}

  const allEvents = [...new Set(config.webhooks.flatMap(w => w.events))]

  console.log(
    `[webhook-notify] Loaded ${config.webhooks.length} webhook(s) watching ${allEvents.length} event(s)`,
  )

  const projectId = project.id

  try {
    await client.app.log({
      body: {
        service: "webhook-notify",
        level: "info",
        message: `Loaded ${config.webhooks.length} webhook(s), ${allEvents.length} event(s)`,
      },
    })
  } catch {
    // log failure is non-fatal; plugin still works
  }

  return {
    event: async ({ event }) => {
      const matching = config.webhooks.filter(w => w.events.includes(event.type))
      if (matching.length === 0) return

      const payload = {
        event: event.type,
        timestamp: new Date().toISOString(),
        project: projectId,
      }

      await Promise.allSettled(
        matching.map(w => sendWebhook(w.url, payload, undefined, w.headers)),
      )
    },
  }
}
