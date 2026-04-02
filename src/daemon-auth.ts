/**
 * daemon-auth.ts — Read the SurfAgent daemon auth token for HTTP API calls.
 *
 * The daemon writes a random Bearer token to ~/.surfagent/daemon-token.txt on
 * every start. MCP tools that call daemon HTTP endpoints (extract, map, crawl)
 * must include this token.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const TOKEN_PATH = join(homedir(), ".surfagent", "daemon-token.txt");

let cachedToken: string | null = null;

/**
 * Returns the daemon auth token, reading from disk on first call.
 * Falls back to SURFAGENT_AUTH_TOKEN env var if the file doesn't exist.
 */
export function getDaemonAuthToken(): string | null {
  if (cachedToken !== null) return cachedToken;

  // Env var override (useful for remote/custom setups)
  const envToken = process.env.SURFAGENT_AUTH_TOKEN?.trim();
  if (envToken) {
    cachedToken = envToken;
    return cachedToken;
  }

  try {
    const raw = readFileSync(TOKEN_PATH, "utf-8").trim();
    if (raw) {
      cachedToken = raw;
      return cachedToken;
    }
  } catch {
    // File doesn't exist or unreadable — daemon may not be running
  }

  return null;
}

/**
 * Build headers for daemon HTTP requests, including auth if available.
 */
export function daemonHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const token = getDaemonAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Invalidate the cached token (e.g. on 401 retry).
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
