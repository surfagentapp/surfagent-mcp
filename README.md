# surfagent-mcp

MCP server for [SurfAgent](https://surfagent.app) — gives AI agents a real managed Chrome browser via CDP.

## What it does

SurfAgent runs a dedicated Chrome instance on your machine with a persistent profile and remote debugging port. This MCP server connects to that browser and exposes 21 browser-control tools that any MCP-compatible AI agent can use.

**Navigate** → Open URLs, history, reload, tab management  
**Interact** → Click, type, fill forms, select dropdowns, keyboard  
**Observe** → Screenshots, DOM inspection, page content, JavaScript eval  
**Cookies** → Read, write, clear  

## Prerequisites

1. Install [SurfAgent](https://surfagent.app) — manages Chrome on port 9222
2. Launch SurfAgent and start the browser from the app
3. Node.js 20+

## Setup

### Claude Code (claude --mcp)

Add to your Claude Code MCP config (`~/.claude/mcp.json` or via `claude mcp add`):

```bash
claude mcp add surfagent -- npx -y surfagent-mcp
```

Or manually in `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "surfagent": {
      "command": "npx",
      "args": ["-y", "surfagent-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "surfagent": {
      "command": "npx",
      "args": ["-y", "surfagent-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

### Cursor

Open **Cursor Settings → MCP** and add:

```json
{
  "mcpServers": {
    "surfagent": {
      "command": "npx",
      "args": ["-y", "surfagent-mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "surfagent": {
      "command": "npx",
      "args": ["-y", "surfagent-mcp"]
    }
  }
}
```

### Codex CLI

```bash
codex --mcp-server "npx -y surfagent-mcp" "open google.com and take a screenshot"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CDP_HOST` | `127.0.0.1` | Chrome DevTools Protocol host |
| `CDP_PORT` | `9222` | Chrome DevTools Protocol port |

Custom port example:
```json
{
  "mcpServers": {
    "surfagent": {
      "command": "npx",
      "args": ["-y", "surfagent-mcp"],
      "env": {
        "CDP_PORT": "9223"
      }
    }
  }
}
```

## Available Tools (21)

| Tool | Description |
|------|-------------|
| `navigate` | Go to a URL |
| `go_back` | Browser back |
| `go_forward` | Browser forward |
| `reload` | Reload current page |
| `click` | Click element by CSS selector |
| `type` | Type text into an element |
| `fill_form` | Fill multiple fields at once |
| `select_option` | Select a dropdown option |
| `press_key` | Press a keyboard key (Enter, Tab, Escape…) |
| `screenshot` | Capture current page as PNG (base64) |
| `inspect` | Get element properties and text |
| `get_page_content` | Extract full page text/HTML |
| `evaluate` | Execute JavaScript in the page |
| `list_tabs` | List all open tabs |
| `new_tab` | Open a new tab |
| `switch_tab` | Switch to tab by ID |
| `close_tab` | Close a tab |
| `get_cookies` | Read cookies for current page |
| `set_cookie` | Set a cookie |
| `clear_cookies` | Clear cookies |
| `wait_for_element` | Wait until a selector appears |

## How it works

```
AI Agent  ←→  MCP Protocol  ←→  surfagent-mcp  ←→  CDP (port 9222)  ←→  Chrome
```

SurfAgent handles Chrome lifecycle: launch, persistent profile, health monitoring, crash recovery. This MCP server connects to the already-running browser and translates MCP tool calls into CDP commands.

## Troubleshooting

**"Could not connect to Chrome"** — Make sure SurfAgent is running and the browser is started. Check that Chrome is on port 9222 (default).

**"npx surfagent-mcp not found"** — Run `npm install -g surfagent-mcp` then use `surfagent-mcp` directly instead of `npx`.

**Port already in use** — Another Chrome instance may be using 9222. Change `CDP_PORT` env var to match whatever SurfAgent is configured to use.

## License

MIT — [surfagent.app](https://surfagent.app)
