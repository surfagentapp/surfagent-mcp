import type { ToolDefinition } from "../contracts.js";
import { asObject, asOptionalBoolean, asOptionalNumber, asOptionalString, textResult } from "../tool-utils.js";

const SURFAGENT_DAEMON_URL = process.env.SURFAGENT_DAEMON_URL ?? "http://127.0.0.1:7201";

export const extractTools: ToolDefinition[] = [
  {
    name: "browser_extract",
    description:
      "Extract structured data from a web page. Returns markdown, links, structured JSON (with LLM), screenshots, and HTML.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to navigate to before extracting. Opens a new tab if no tabId provided."
        },
        tabId: {
          type: "string",
          description: "Use an existing tab instead of opening a new one."
        },
        prompt: {
          type: "string",
          description: "Prompt for LLM-based structured extraction (requires 'json' in formats)."
        },
        schema: {
          type: "object",
          description: "JSON schema for structured LLM extraction.",
          properties: {},
          additionalProperties: true
        },
        formats: {
          type: "array",
          description:
            "Output formats to include. Options: markdown, links, json, html, screenshot. Defaults to [\"markdown\", \"links\"].",
          items: { type: "string" }
        },
        waitForSelector: {
          type: "string",
          description: "CSS selector to wait for before extracting content."
        },
        waitMs: {
          type: "number",
          description: "Additional milliseconds to wait after page load / selector found."
        },
        keepTab: {
          type: "boolean",
          description: "If true, keep the tab open after extraction (default: false)."
        }
      },
      required: [],
      additionalProperties: false
    },
    handler: async (args, _context) => {
      const input = asObject(args, "browser_extract arguments");

      const url = asOptionalString(input.url);
      const tabId = asOptionalString(input.tabId);
      const prompt = asOptionalString(input.prompt);
      const waitForSelector = asOptionalString(input.waitForSelector);
      const waitMs = asOptionalNumber(input.waitMs);
      const keepTab = asOptionalBoolean(input.keepTab);

      // Build request body, only including defined fields
      const body: Record<string, unknown> = {};
      if (url !== undefined) body.url = url;
      if (tabId !== undefined) body.tabId = tabId;
      if (prompt !== undefined) body.prompt = prompt;
      if (input.schema !== undefined) body.schema = input.schema;
      if (Array.isArray(input.formats)) body.formats = input.formats;
      if (waitForSelector !== undefined) body.waitForSelector = waitForSelector;
      if (waitMs !== undefined) body.waitMs = waitMs;
      if (keepTab !== undefined) body.keepTab = keepTab;

      const res = await fetch(`${SURFAGENT_DAEMON_URL}/browser/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`SurfAgent extract failed (HTTP ${res.status}): ${text}`);
      }

      const data = await res.json() as Record<string, unknown>;
      return textResult(JSON.stringify(data, null, 2));
    }
  }
];
