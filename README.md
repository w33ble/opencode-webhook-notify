# webhook-notify

An [OpenCode](https://opencode.ai) plugin that sends webhook notifications when notable events occur — agent needs your input, finishes working, hits an error, or updates todos.

## Configuration

Create a `webhook-notify.json` config file. Project-level takes priority over global:

- `.opencode/webhook-notify.json` — project-specific
- `~/.config/opencode/webhook-notify.json` — global fallback

No config = plugin loads silently and does nothing.

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
      "events": ["permission.asked", "todo.updated"]
    }
  ]
}
```

Custom headers (e.g. for API keys or bearer tokens) can be set per webhook:

```json
{
  "webhooks": [
    {
      "url": "https://api.example.com/hooks",
      "events": ["session.idle"],
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  ]
}
```

Environment variables in string values are resolved automatically:

```json
{ "url": "https://ntfy.sh/${NTFY_TOPIC}" }
```

### Available events

| Event | When it fires |
|-------|--------------|
| `session.idle` | Agent finished a response, waiting |
| `session.error` | Session hit an error |
| `permission.asked` | Agent needs your input/approval |
| `todo.updated` | Task list changed |

### Webhook payload

Each event POSTs a JSON payload:

```json
{
  "event": "session.idle",
  "timestamp": "2026-05-23T20:30:00.000Z",
  "project": "/home/user/my-project",
  "session": "sess_abc123..."
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
