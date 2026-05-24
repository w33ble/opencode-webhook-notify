# OpenCode Plugin Development Guide

A lightweight bootstrap for creating OpenCode plugins. For full hook/API docs, see [opencode.ai/docs/plugins](https://opencode.ai/docs/plugins/).

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

```bash
bun build src/index.ts --outfile dist/plugin.js --target=bun --format esm --external @opencode-ai/plugin
```

### 2. Symlink

```bash
# Project-level
ln -sf $(pwd)/dist/plugin.js .opencode/plugins/my-plugin.ts

# Or Globally
ln -sf $(pwd)/dist/plugin.js ~/.config/opencode/plugins/my-plugin.ts
```

### 3. Verify

Restart OpenCode and check it loaded:

```bash
opencode --verbose 2>&1 | grep -i plugin
```

### 4. Iterate

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
