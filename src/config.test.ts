import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { writeFileSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { loadConfig } from "./config"

let tmpDir: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `webhook-notify-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

test("returns null when no config file exists", () => {
  expect(loadConfig(tmpDir)).toBeNull()
})

test("loads valid config from project-level .opencode/webhook-notify.json", () => {
  const configDir = join(tmpDir, ".opencode")
  mkdirSync(configDir, { recursive: true })
  writeFileSync(join(configDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [
      { url: "https://hooks.slack.com/test", events: ["session.idle", "session.error"] },
      { url: "https://ntfy.sh/test", events: ["permission.asked"] },
    ],
  }))

  const config = loadConfig(tmpDir)
  expect(config).not.toBeNull()
  expect(config!.webhooks.length).toBe(2)
  expect(config!.webhooks[0].url).toBe("https://hooks.slack.com/test")
  expect(config!.webhooks[0].events).toEqual(["session.idle", "session.error"])
  expect(config!.webhooks[1].url).toBe("https://ntfy.sh/test")
  expect(config!.webhooks[1].events).toEqual(["permission.asked"])
})

test("falls back to global config when project config missing", () => {
  const globalDir = join(tmpDir, ".config", "opencode")
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(join(globalDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [{ url: "https://global.example.com", events: ["session.idle"] }],
  }))

  const config = loadConfig(tmpDir, tmpDir)
  expect(config).not.toBeNull()
  expect(config!.webhooks[0].url).toBe("https://global.example.com")
})

test("project config takes priority over global", () => {
  const globalDir = join(tmpDir, ".config", "opencode")
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(globalDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(globalDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [{ url: "https://global.example.com", events: ["session.idle"] }],
  }))
  writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [{ url: "https://project.example.com", events: ["todo.updated"] }],
  }))

  const config = loadConfig(tmpDir, tmpDir)
  expect(config).not.toBeNull()
  expect(config!.webhooks[0].url).toBe("https://project.example.com")
})

test("resolves $VAR_NAME env vars", () => {
  process.env.HOOK_URL = "https://hooks.example.com/abc"
  try {
    const projectDir = join(tmpDir, ".opencode")
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
      webhooks: [{ url: "$HOOK_URL", events: ["session.idle"] }],
    }))

    const config = loadConfig(tmpDir)
    expect(config).not.toBeNull()
    expect(config!.webhooks[0].url).toBe("https://hooks.example.com/abc")
  } finally {
    delete process.env.HOOK_URL
  }
})

test("resolves ${VAR_NAME} env vars", () => {
  process.env.TOKEN = "secret123"
  try {
    const projectDir = join(tmpDir, ".opencode")
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
      webhooks: [{ url: "https://example.com/${TOKEN}/hook", events: ["session.idle"] }],
    }))

    const config = loadConfig(tmpDir)
    expect(config).not.toBeNull()
    expect(config!.webhooks[0].url).toBe("https://example.com/secret123/hook")
  } finally {
    delete process.env.TOKEN
  }
})

test("resolves env var containing double quotes in url", () => {
  process.env.MSG = 'say "hello"'
  try {
    const projectDir = join(tmpDir, ".opencode")
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
      webhooks: [{ url: "$MSG", events: ["session.idle"] }],
    }))

    const config = loadConfig(tmpDir)
    expect(config).not.toBeNull()
    expect(config!.webhooks[0].url).toBe('say "hello"')
  } finally {
    delete process.env.MSG
  }
})

test("rejects webhook with empty events array", () => {
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [{ url: "https://example.com", events: [] }],
  }))

  expect(loadConfig(tmpDir)).toBeNull()
})

test("validates empty top-level webhooks array is valid", () => {
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({ webhooks: [] }))

  const config = loadConfig(tmpDir)
  expect(config).not.toBeNull()
  expect(config!.webhooks).toEqual([])
})

test("returns null for invalid JSON", () => {
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "webhook-notify.json"), "not valid json{{{")

  expect(loadConfig(tmpDir)).toBeNull()
})

test("returns null when webhooks is not an array", () => {
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({ webhooks: "bad" }))

  expect(loadConfig(tmpDir)).toBeNull()
})

test("returns null when webhook missing url", () => {
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [{ events: ["session.idle"] }],
  }))

  expect(loadConfig(tmpDir)).toBeNull()
})

test("resolves env vars in headers", () => {
  process.env.API_TOKEN = "secret456"
  try {
    const projectDir = join(tmpDir, ".opencode")
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
      webhooks: [{
        url: "https://example.com",
        events: ["session.idle"],
        headers: { "Authorization": "Bearer $API_TOKEN" },
      }],
    }))

    const config = loadConfig(tmpDir, tmpDir)
    expect(config).not.toBeNull()
    expect(config!.webhooks[0].headers).toEqual({ "Authorization": "Bearer secret456" })
  } finally {
    delete process.env.API_TOKEN
  }
})

test("reads custom method from config", () => {
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [{ url: "https://example.com", events: ["session.idle"], method: "PUT" }],
  }))

  const config = loadConfig(tmpDir, tmpDir)
  expect(config).not.toBeNull()
  expect(config!.webhooks[0].method).toBe("PUT")
})

test("returns null when webhook missing events", () => {
  const projectDir = join(tmpDir, ".opencode")
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, "webhook-notify.json"), JSON.stringify({
    webhooks: [{ url: "https://example.com" }],
  }))

  expect(loadConfig(tmpDir)).toBeNull()
})
