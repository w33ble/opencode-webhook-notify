# AGENTS.md

## Build

```bash
bun run build        # bundle + typecheck
bun run build:bundle # just the JS bundle
bun run build:types  # just tsc type emission
```

- `--external @opencode-ai/plugin` is mandatory when importing values (like `tool`), not just types. The plugin SDK is provided at runtime by OpenCode.
- Output: `dist/index.js` (single bundled file, all sources inlined).

## Test

```bash
bun test            # all 24 tests
bun test --watch    # watch mode
```

Tests use `bun:test`. No other test framework.

## Lint / Format

```bash
bun run lint       # biome check
bun run lint:fix   # biome check --write
bun run format     # biome format --write
```

Biome, not prettier or eslint. Formatting rules: double quotes, no semicolons (from biome config — check `biome.json`).

## Local install (development)

```bash
bun install
bun run build
mkdir -p .opencode/plugins
ln -sf $(pwd)/dist/index.js .opencode/plugins/webhook-notify.ts
```

The symlink **must** have a `.ts` extension even though it points to a `.js` bundle. OpenCode's plugin loader looks for `.ts` or `.js` files.

Then restart OpenCode.

## Architecture

Single-file OpenCode plugin (`src/index.ts`) with two supporting modules:

| File | Role |
|------|------|
| `src/index.ts` | Plugin entrypoint — config loading, event dispatch, custom tools |
| `src/config.ts` | JSON config loader with env var resolution and validation |
| `src/send.ts` | Webhook HTTP POST sender (string or JSON payload) |

## Key implementation details

### Config resolution

`src/config.ts` `loadConfig()` checks two paths in order:
1. `<cwd>/.opencode/webhook-notify.json` (project-level)
2. `~/.config/opencode/webhook-notify.json` (global fallback)

Returns `null` if no config found. Returns the parsed and validated `Config` otherwise.

### Env var resolution

**Parse JSON first, then resolve env vars** on the resulting object. Do NOT resolve `$VAR` on the raw JSON string — it corrupts JSON if env var values contain quotes, backslashes, or newlines.

`resolveEnvVarsInValue()` recursively walks objects/arrays, replacing `$VAR` and `${VAR}` patterns in string values.

### Session title

Fetched via `client.session.get({ path: { id: sessionID } })` per event, cached in `sessionTitleCache` (Map). Session ID comes from `event.properties.sessionID`. Fetch failures are non-fatal — `sessionTitle` is omitted from the payload.

### Runtime toggle

Module-level `webhooksEnabled` variable toggled by the `webhook_notify_toggle` custom tool. No restart needed. `webhook_notify_status` reports current state. `enabled: false` in config sets initial state at startup.

### Event hook

`event` hook receives `{ event }` with `event.type` (string) and `event.properties` (object). The plugin filters webhooks by `event.type`, builds either a text payload (default) or JSON payload (when `raw: true` per webhook).

### Config options

| Field | Default | Notes |
|-------|---------|-------|
| `url` | required | Webhook endpoint |
| `events` | required | Event type strings |
| `headers` | — | Custom HTTP headers (env vars resolved) |
| `method` | `"POST"` | HTTP method. GET skips body |
| `raw` | `false` | `true` = structured JSON, default = formatted text |
| `enabled` | `true` | Top-level toggle (not per-webhook) |

## Undocumented OpenCode events

These events exist in OpenCode source but not in the published plugin docs:
- `question.asked`, `question.replied`, `question.rejected` — question tool interactions
- `session.status` carries `properties.status.type`: `"idle"`, `"busy"`, `"retrying"`

Check `packages/opencode/src/cli/cmd/run/stream.transport.ts` in the OpenCode repo for the real event list.

## No hot-reload

Every change requires `bun run build` + restart OpenCode. The only runtime-modifiable state is the `webhooksEnabled` flag via the custom tools.
