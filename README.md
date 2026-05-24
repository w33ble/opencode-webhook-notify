# webhook-notify

An [OpenCode](https://opencode.ai) plugin that sends webhook notifications when notable events occur — agent needs your input, finishes working, hits an error, or updates todos.

## Configuration

Create a `webhook-notify.json` config file. Project-level takes priority over global:

- `.opencode/webhook-notify.json` — project-specific
- `~/.config/opencode/webhook-notify.json` — global fallback

No config = plugin loads silently and does nothing.

Set `"enabled": false` at the top level to temporarily disable all notifications without removing the config file.

Or toggle notifications at runtime without restarting — just ask your agent:

> "Disable webhook notifications"

The plugin registers two custom tools:

- `webhook_notify_toggle` — toggle notifications on/off (`enable: true | false`)
- `webhook_notify_status` — check current state

### Format

```json
{
  "webhooks": [
    {
      "url": "https://hooks.slack.com/services/...",
      "events": ["session.idle", "session.error"]
    },
    {
      "url": "https://ntfy.sh/mytopic",
      "events": ["permission.asked", "question.asked", "todo.updated"]
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
| `raw` | boolean | `false` | Send structured JSON instead of formatted text |

**Headers** support env vars and are spread after `Content-Type`:

```json
{
  "url": "https://api.example.com/hooks",
  "events": ["session.idle"],
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  }
}
```

**Method** defaults to `POST`. `GET` requests are sent without a body.

**Raw mode:** When `"raw": true`, a full JSON payload is sent (see below). By default, a human-readable text message is sent instead.

Environment variables in all string values (`$VAR` / `${VAR}`) are resolved automatically.

### Available events

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

### Webhook payload

**Default (text mode) — `Content-Type: text/plain`:**

```
⏳ Session is idle and waiting for input
opencode-webhook-notify | /home/sebby/repos/opencode-webhook-notify
session.idle
```

Format: `emoji human-message\nprojectName | worktree\nevent-type`

**Raw mode (`"raw": true`) — `Content-Type: application/json`:**

```json
{
  "event": "session.idle",
  "msg": "Session is idle and waiting for input",
  "timestamp": "2026-05-23T20:30:00.000Z",
  "project": "0868ffdee...",
  "projectName": "opencode-webhook-notify",
  "directory": "/home/sebby/repos/opencode-webhook-notify",
  "worktree": "/home/sebby/repos/opencode-webhook-notify"
}
```

## Install

### Local (development)

```bash
bun install
bun run build
mkdir -p .opencode/plugins
ln -sf $(pwd)/dist/webhook-notify.js .opencode/plugins/webhook-notify.ts
```

Restart OpenCode. Create a config file and you're done.

### From npm (coming soon)

```bash
opencode plugin install webhook-notify
```

## Requirements

- [Bun](https://bun.sh) >= 1.0.0
- [OpenCode](https://opencode.ai)
