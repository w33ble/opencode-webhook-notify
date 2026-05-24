import { type Plugin, tool } from "@opencode-ai/plugin"
import { loadConfig } from "./config"
import { sendWebhook } from "./send"
import { basename } from "node:path"

let webhooksEnabled = true

export const WebhookNotify: Plugin = async ({ project, client, directory, worktree }) => {
  const config = loadConfig()
  if (!config) return {}

  if (config.enabled === false) {
    webhooksEnabled = false
    console.log("[webhook-notify] Loaded with notifications disabled via config")
  }

  const allEvents = [...new Set(config.webhooks.flatMap(w => w.events))]

  console.log(
    `[webhook-notify] Loaded ${config.webhooks.length} webhook(s) watching ${allEvents.length} event(s)`,
  )

  const emotes: Record<string, string> = {
    "session.idle": "⏳",
    "session.error": "❌",
    "session.created": "🆕",
    "session.deleted": "🗑️",
    "session.compacted": "📦",
    "session.diff": "📄",
    "session.status": "📊",
    "session.updated": "🔄",
    "permission.asked": "🔐",
    "permission.replied": "✅",
    "todo.updated": "📋",
    "question.asked": "❓",
    "question.replied": "💬",
    "question.rejected": "🚫",
    "message.updated": "💬",
    "message.part.updated": "📝",
    "command.executed": "⚡",
    "file.edited": "✏️",
    "file.watcher.updated": "👀",
    "server.connected": "🔌",
    "installation.updated": "📥",
    "lsp.client.diagnostics": "🔍",
    "lsp.updated": "🔧",
    "tui.prompt.append": "⌨️",
    "tui.command.execute": "🖥️",
    "tui.toast.show": "🔔",
  }

  const messages: Record<string, string> = {
    "session.idle": "Session is idle and waiting for input",
    "session.error": "Session encountered an error",
    "session.created": "New session created",
    "session.deleted": "Session deleted",
    "session.compacted": "Session context compacted",
    "session.diff": "Session diff available",
    "session.status": "Session status changed",
    "session.updated": "Session updated",
    "permission.asked": "Agent needs your permission to continue",
    "permission.replied": "Permission request answered",
    "todo.updated": "Task list updated",
    "question.asked": "Agent is asking you a question",
    "question.replied": "Question answered",
    "question.rejected": "Question rejected",
    "message.updated": "New message received",
    "message.part.updated": "Message content updated",
    "command.executed": "Command executed",
    "file.edited": "File edited",
    "file.watcher.updated": "File watcher triggered",
    "server.connected": "Server connected",
    "installation.updated": "Installation updated",
    "lsp.client.diagnostics": "LSP diagnostics available",
    "lsp.updated": "LSP updated",
    "tui.prompt.append": "TUI prompt updated",
    "tui.command.execute": "TUI command executed",
    "tui.toast.show": "TUI toast notification",
  }

  const projectId = project.id
  const projectName = project.name ?? basename(directory)

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
      if (!webhooksEnabled) return

      const matching = config.webhooks.filter(w => w.events.includes(event.type))
      if (matching.length === 0) return

      const msg = messages[event.type] ?? `Event: ${event.type}`
      const emote = emotes[event.type] ?? "ℹ️"

      await Promise.allSettled(
        matching.map(w => {
          const payload = w.raw
            ? {
                event: event.type,
                timestamp: new Date().toISOString(),
                project: projectId,
                projectName,
                directory,
                worktree,
                msg,
              }
            : `${emote} ${msg}\n${projectName} | ${worktree}\n${event.type}`

          return sendWebhook(w.url, payload, undefined, w.headers, w.method ?? "POST")
        }),
      )
    },
    tool: {
      webhook_notify_toggle: tool({
        description: "Toggle webhook notifications on or off without restarting OpenCode",
        args: {
          enable: tool.schema.boolean().describe("Set to true to enable notifications, false to disable"),
        },
        async execute(args) {
          webhooksEnabled = args.enable
          const status = webhooksEnabled ? "enabled" : "disabled"
          console.log(`[webhook-notify] Notifications ${status}`)
          return `Webhook notifications ${status}`
        },
      }),
      webhook_notify_status: tool({
        description: "Check whether webhook notifications are currently enabled",
        args: {},
        async execute() {
          return webhooksEnabled
            ? "Webhook notifications are enabled"
            : "Webhook notifications are disabled"
        },
      }),
    },
  }
}
