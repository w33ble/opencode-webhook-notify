# OpenCode Plugin Development Guide

A lightweight bootstrap for creating OpenCode plugins. 

## Quick Start

```bash
mkdir my-plugin && cd my-plugin
bun init -y
bun add @opencode-ai/plugin
bun add -d @types/bun typescript
```

Add a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["bun"]
  },
  "include": ["src/**/*"]
}
```

## Minimal Working Plugin

```ts
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async () => {
  return {
    "shell.env": async (_input, output) => {
      output.env.HELLO = "world"
    },
  }
}
```

**Named export is required** — `export const MyPlugin` works; `export default` does not.

## Plugin Structure

The plugin is an async factory that runs **once at startup**. Do precomputation here (load config, read files), not inside hooks.

```ts
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  // Runs once at startup

  return {
    // Hook implementations
  }
}
```

### Context

| Field | Description |
|-------|-------------|
| `project` | `{ id, worktree?, vcs? }` — current project info |
| `client` | OpenCode SDK client — type-safe API to the server |
| `$` | Bun shell — `` await $`git status`.text() `` |
| `directory` | Current working directory |
| `worktree` | Git worktree root path |

## Development Workflow

### 1. Build

The build runs in two steps — bundler for JavaScript, TypeScript compiler for type declarations:

```bash
# Both steps
bun run build

# Or individually
bun run build:bundle   # bun build -> dist/index.js
bun run build:types    # tsc       -> dist/index.d.ts
```

Under the hood:
```bash
bun build src/index.ts --outdir dist --target bun --format esm --external @opencode-ai/plugin
tsc --project tsconfig.build.json
```

Types are emitted separately via a `tsconfig.build.json` that extends the base config with `declaration: true` + `emitDeclarationOnly: true`. The `dist/` output includes both the JS bundle and `.d.ts` declarations.

### 2. Lint & Format

Using [Biome](https://biomejs.dev/) for fast, zero-config linting and formatting:

```bash
# Check for issues
bun run lint

# Auto-fix lint + formatting
bun run lint:fix

# Format only
bun run format
```

Biome config (`biome.json`) enables recommended lint rules, single quotes, 2-space indent, and auto-organized imports. The `dist/` directory is excluded.

### 3. Symlink

```bash
# Project-level
ln -sf $(pwd)/dist/index.js .opencode/plugins/my-plugin.ts

# Or Globally
ln -sf $(pwd)/dist/index.js ~/.config/opencode/plugins/my-plugin.ts
```

### 4. Verify

Restart OpenCode and check it loaded:

```bash
opencode --verbose 2>&1 | grep -i plugin
```

### 5. Iterate

**No hot-reload** — every change requires rebuilding and restarting OpenCode.

## Critical Rule: Single File Only

OpenCode's local plugin loader expects **a single `.ts` or `.js` file** in the plugins directory.

- ✅ `~/.config/opencode/plugins/my-plugin.ts`
- ✅ `.opencode/plugins/my-plugin.ts`
- ❌ Directories with `package.json` / `node_modules`
- ❌ `link:my-plugin` in config

### Dependencies

Local plugins can use external npm packages, but dependencies must be declared in **`.opencode/package.json`**. OpenCode runs `bun install` there at startup.

```json
// .opencode/package.json
{
  "dependencies": {
    "shescape": "^2.1.0"
  }
}
```

Then import normally in your plugin:

```ts
import { escape } from "shescape"
```

For published npm plugins, add to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-my-plugin@latest"]
}
```

## Custom Tools

```ts
import { type Plugin, tool } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async () => {
  return {
    tool: {
      myTool: tool({
        description: "Does something useful",
        args: {
          input: tool.schema.string().describe("The input string"),
          count: tool.schema.number().optional().describe("Optional count"),
        },
        async execute(args, context) {
          // context: { sessionID, messageID, agent, abort }
          return `Result: ${args.input}`
        },
      }),
    },
  }
}
```

`tool.schema` is Zod — use `.min()`, `.enum()`, `.regex()`, etc.

## Hooks Overview

| Hook | Purpose |
|------|---------|
| `"shell.env"` | Inject env vars into all shell execution |
| `tool` | Register custom tools |
| `"tool.execute.before"` / `.after` | Intercept tool execution |
| `event` | Subscribe to system events |
| `"chat.message"` / `"chat.params"` | Intercept messages, modify LLM params |
| `"permission.ask"` | Auto-allow/deny permissions |
| `"experimental.session.compacting"` | Inject compaction context |
| `config` | Modify config at startup |

### Events Deep Dive

The `event` hook receives `{ event }` where `event` has a `.type` string and optional `.properties`:

```ts
event: async ({ event }) => {
  console.log(event.type)                          // "session.idle"
  console.log(event.properties?.sessionID)          // session UUID
  console.log(event.properties?.status?.type)       // "idle" | "busy" (for session.status)
}
```

### Event hierarchy

Not all "agent waiting" events are the same:

| Event | Fires when |
|-------|-----------|
| `session.idle` | Agent stops and waits (all cases — questions, finished, etc.) |
| `session.status` | Session state changes. `properties.status.type`: `"idle"`, `"busy"`, `"retrying"` |
| `permission.asked` | Tool permission dialog only (bash, file edits, etc.) — **not** the question tool |
| `question.asked` | Agent calls the question tool specifically. Also `question.replied` / `question.rejected` |

### Undocumented events

The [official docs](https://opencode.ai/docs/plugins/) list most events, but some (like `question.asked`, `question.replied`, `question.rejected`) are only in the [OpenCode source](https://github.com/anomalyco/opencode). Check `packages/opencode/src/cli/cmd/run/stream.transport.ts` when you need specific events.

Full event list:  session.* ,  message.* ,  file.* ,  permission.* ,  lsp.* ,  command.* ,
  tui.* ,  installation.* ,  server.* ,  shell.env ,  todo.updated

Docs for all events and signatures: [opencode.ai/docs/plugins](https://opencode.ai/docs/plugins/)

## Debugging

- `console.log` → **OpenCode server logs**, not the session
- `client.app.log()` → structured logging (must `await`):
  ```ts
  await client.app.log({
    body: { service: "my-plugin", level: "info", message: "Loaded" },
  })
  ```
- `opencode --verbose` → detailed startup logs

## Gotchas

- **No hot-reload** — restart OpenCode after every change
- **`output.env` is mutable** — assign to it, don't replace the object
- **Existing env vars are preserved** — check `key in output.env` before overwriting
- **`shell.env` fires for AI tools too** — not just user terminals
- **Bun shell throws on non-zero exit** — use `.nothrow()` if needed
- **`@opencode-ai/plugin` is provided at runtime** — mark as `--external` when bundling
- **Plugin hook execution order is undefined** — don't rely on ordering between plugins

## Documentation and references

- [Opencode SDK](https://opencode.ai/docs/sdk/).
- [Opencode Plugin Docs](https://opencode.ai/docs/plugins/).

## Lessons from the Field

Practical discoveries while building plugins.

### Type-only vs value imports matter for bundle size

```ts
import type { Plugin } from "@opencode-ai/plugin"        // ✅ ~7 KB bundle
import { type Plugin, tool } from "@opencode-ai/plugin"  // ⚠️ ~0.5 MB unless --external
```

When you import values (like `tool`), always add `--external @opencode-ai/plugin` to your build script. OpenCode provides it at runtime. Type-only imports don't need this since they're erased.

### console.log flashes at startup, client.app.log doesn't

```ts
// ❌ Flashes on screen during OpenCode startup
console.log("[my-plugin] Loaded")

// ✅ Clean structured logging
await client.app.log({
  body: { service: "my-plugin", level: "info", message: "Loaded" },
})
```

Use `console.error` only for actual failures (bad config, network errors, etc.). Startup status goes through `client.app.log`.

### Custom tools = runtime state changes without restart

Since plugins have no hot-reload, use a **module-level variable** + a **custom tool** to toggle behavior at runtime:

```ts
let enabled = true

export const MyPlugin: Plugin = async () => {
  return {
    event: async ({ event }) => {
      if (!enabled) return
      // ...
    },
    tool: {
      myplugin_toggle: tool({
        description: "Toggle my-plugin on or off",
        args: { enable: tool.schema.boolean() },
        async execute(args) {
          enabled = args.enable
          return `Plugin ${enabled ? "enabled" : "disabled"}`
        },
      }),
    },
  }
}
```

### project.name can be undefined

The `project` context field may not have a `name`. `project.id` is always a UUID. Use `directory`'s basename as a fallback:

```ts
import { basename } from "node:path"
const name = project.name ?? basename(directory)
```

### env var resolution: parse JSON first, then resolve

Resolving `$VAR` patterns on the raw JSON string can corrupt the JSON if env var values contain quotes or backslashes. Always parse first, then recursively walk the object:

```ts
// ❌ resolveEnvVars(rawJson) then JSON.parse — breaks on special chars
// ✅ JSON.parse(raw) then resolveEnvVarsInObject(parsed)
```

### GET requests should skip the body

Some servers reject GET requests with a body. If your plugin supports custom HTTP methods, omit `body` for `GET`.

