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

  await client.app.log({
    body: {
      service: "webhook-notify",
      level: "info",
      message: `Loaded ${config.webhooks.length} webhook(s), ${allEvents.length} event(s)`,
    },
  })

  return {
    event: async ({ event }) => {
      const matching = config.webhooks.filter(w => w.events.includes(event.type))
      if (matching.length === 0) return

      const payload = {
        event: event.type,
        timestamp: new Date().toISOString(),
        project: project?.id ?? process.cwd(),
      }

      await Promise.allSettled(
        matching.map(w => sendWebhook(w.url, payload)),
      )
    },
  }
}
