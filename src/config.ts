import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface WebhookConfig {
  url: string;
  events: string[];
  headers?: Record<string, string>;
  method?: string; // default POST
  raw?: boolean;
}

export interface Config {
  webhooks: WebhookConfig[];
  enabled?: boolean;
}

function resolveEnvVarsInValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{?(\w+)\}?/g, (match, name) => {
      const resolved = process.env[name];
      return resolved !== undefined ? resolved : match;
    });
  }
  if (Array.isArray(value)) return value.map(resolveEnvVarsInValue);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveEnvVarsInValue(v);
    }
    return result;
  }
  return value;
}

export function loadConfig(cwd?: string, home?: string): Config | null {
  const projectPath = cwd ?? process.cwd();
  const homeDir = home ?? homedir();
  const paths = [
    join(projectPath, '.opencode', 'webhook-notify.json'),
    join(homeDir, '.config', 'opencode', 'webhook-notify.json'),
  ];

  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw);
      const resolved = resolveEnvVarsInValue(parsed) as Config;
      if (!resolved.webhooks || !Array.isArray(resolved.webhooks)) {
        console.error('[webhook-notify] config.webhooks must be an array');
        return null;
      }
      for (const w of resolved.webhooks) {
        if (!w.url || typeof w.url !== 'string') {
          console.error("[webhook-notify] each webhook must have a string 'url'");
          return null;
        }
        if (!w.events || !Array.isArray(w.events) || w.events.length === 0) {
          console.error("[webhook-notify] each webhook must have a non-empty 'events' array");
          return null;
        }
      }
      return resolved;
    } catch (err) {
      console.error('[webhook-notify] failed to parse config:', err);
      return null;
    }
  }

  return null;
}
