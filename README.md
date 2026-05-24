# webhook-notify

An [OpenCode](https://opencode.ai) plugin that fires webhooks when things happen — agent asks a question, needs your permission, finishes working, hits an error, or updates your task list. Multiple webhooks, each with their own event filter, HTTP method, auth headers, and payload format (emoji text or raw JSON).

## Install

### From npm (recommended)

Add to your `opencode.json`:

```json
{
  "plugin": ["@w33ble/opencode-webhook-notify@latest"]
}
```

Restart OpenCode. Done.

### Local (development)

```bash
bun install
bun run build
mkdir -p .opencode/plugins
ln -sf $(pwd)/dist/index.js .opencode/plugins/webhook-notify.ts
```

The symlink must have a `.ts` extension even though it points to a `.js` bundle.

Then restart OpenCode.

## Configuration

Create a `webhook-notify.json` config file. The plugin checks two locations, in order:

- `.opencode/webhook-notify.json` — project-specific
- `~/.config/opencode/webhook-notify.json` — global fallback

No config file = the plugin loads silently and does nothing.

### Quick start

```json
{
  "webhooks": [
    {
      "url": "https://ntfy.sh/mytopic",
      "events": ["session.idle", "question.asked", "permission.asked"]
    }
  ]
}
```

### Disabling notifications

Set `"enabled": false` at the top level to start with notifications off:

```json
{
  "enabled": false,
  "webhooks": [...]
}
```

You can also toggle notifications at runtime without restarting — just ask your agent:

> "Disable webhook notifications" / "Enable webhook notifications"  
> "Are webhook notifications on?"

Two custom tools are available to agents:

- `webhook_notify_toggle(enable: boolean)` — turn notifications on or off
- `webhook_notify_status()` — check whether notifications are currently enabled

### Full config

```json
{
  "enabled": true,
  "webhooks": [
    {
      "url": "https://hooks.slack.com/services/...",
      "events": ["session.idle", "session.error"],
      "headers": { "Authorization": "Bearer ${SLACK_TOKEN}" },
      "method": "POST",
      "raw": false
    },
    {
      "url": "https://api.example.com/poke",
      "events": ["permission.asked", "question.asked"],
      "method": "GET"
    }
  ]
}
```

### Webhook options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | required | Webhook endpoint URL |
| `events` | string[] | required | Which event types trigger this webhook |
| `headers` | object | — | Custom HTTP headers (e.g. auth tokens) |
| `method` | string | `"POST"` | HTTP method (`GET`, `PUT`, `PATCH`, etc.) |
| `raw` | boolean | `false` | `true` = structured JSON, `false` = formatted text |

Environment variables in all string values (`$VAR` / `${VAR}`) are resolved automatically — in URLs, headers, and anywhere else.

`GET` requests are sent without a body. `headers` are spread after the `Content-Type` header.

### Global options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Start with notifications enabled |
| `includeSubagents` | boolean | `false` | Also send notifications for subagent sessions |

Subagents (child sessions spawned by the main agent) are excluded by default. Set `"includeSubagents": true` to receive notifications for those too.

## Available events

| Event | When it fires |
|-------|--------------|
| `session.idle` | Agent finished a response, waiting for you |
| `session.error` | Session hit an error |
| `permission.asked` | Agent needs approval for a tool action |
| `permission.replied` | Permission request answered |
| `question.asked` | Agent is asking you a question |
| `question.replied` | Question answered |
| `question.rejected` | Question dismissed |
| `todo.updated` | Task list changed |
| `session.created` | New session started |
| `session.deleted` | Session ended |
| `session.compacted` | Session context compacted |
| `session.diff` | Session diff available |
| `session.status` | Session status changed |
| `session.updated` | Session updated |
| `message.updated` | New message received |
| `command.executed` | Command executed |
| `file.edited` | File edited |

## Payload

### Default (text mode) — `Content-Type: text/plain`

```
⏳ Session is idle and waiting for input
opencode-webhook-notify | /home/user/repos/opencode-webhook-notify
session.idle
```

Format: `emoji human-message\nprojectName | worktree\nevent-type`

If the session title is available, it's inserted between the message and the project info line.

### Raw mode (`"raw": true`) — `Content-Type: application/json`

```json
{
  "event": "session.idle",
  "msg": "Session is idle and waiting for input",
  "timestamp": "2026-05-23T20:30:00.000Z",
  "project": "0868ffdee...",
  "projectName": "opencode-webhook-notify",
  "sessionTitle": "My Session",
  "directory": "/home/user/repos/opencode-webhook-notify",
  "worktree": "/home/user/repos/opencode-webhook-notify"
}
```

## Requirements

- [OpenCode](https://opencode.ai)
- [Bun](https://bun.sh) >= 1.0.0 (development only — npm installs work without Bun)
