import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export interface WebhookConfig {
  url: string
  events: string[]
}

export interface Config {
  webhooks: WebhookConfig[]
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{?(\w+)\}?/g, (match, name) => {
    const resolved = process.env[name]
    return resolved !== undefined ? resolved : match
  })
}

export function loadConfig(cwd?: string, home?: string): Config | null {
  const projectPath = cwd ?? process.cwd()
  const homeDir = home ?? homedir()
  const paths = [
    join(projectPath, ".opencode", "webhook-notify.json"),
    join(homeDir, ".config", "opencode", "webhook-notify.json"),
  ]

  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      const raw = readFileSync(p, "utf-8")
      const resolved = resolveEnvVars(raw)
      const parsed = JSON.parse(resolved)
      if (!parsed.webhooks || !Array.isArray(parsed.webhooks)) {
        console.error("[webhook-notify] config.webhooks must be an array")
        return null
      }
      for (const w of parsed.webhooks) {
        if (!w.url || typeof w.url !== "string") {
          console.error("[webhook-notify] each webhook must have a string 'url'")
          return null
        }
        if (!w.events || !Array.isArray(w.events)) {
          console.error("[webhook-notify] each webhook must have an 'events' array")
          return null
        }
      }
      return parsed
    } catch (err) {
      console.error("[webhook-notify] failed to parse config:", err)
      return null
    }
  }

  return null
}
