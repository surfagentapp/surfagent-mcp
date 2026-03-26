import type { ToolDefinition } from "../contracts.js";
import { asObject, asOptionalNumber, asOptionalString, asString, textResult } from "../tool-utils.js";

const SURFAGENT_DAEMON_URL = process.env.SURFAGENT_DAEMON_URL ?? "http://127.0.0.1:7201";

export const crawlTools: ToolDefinition[] = [
  {
    name: "browser_crawl",
    description:
      "Crawl a website starting from a URL using real Chrome. Extracts content from each page with BFS traversal.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Starting URL for the crawl."
        },
        maxPages: {
          type: "number",
          description: "Maximum number of pages to crawl (default: 10, max: 50)."
        },
        maxDepth: {
          type: "number",
          description: "Maximum BFS depth from the starting URL (default: 3, max: 10)."
        },
        formats: {
          type: "array",
          description: "Output formats for each page: markdown, links, json, html, screenshot.",
          items: { type: "string" }
        },
        includePatterns: {
          type: "array",
          description: "URL glob patterns to include (e.g. 'https://example.com/docs/*').",
          items: { type: "string" }
        },
        excludePatterns: {
          type: "array",
          description: "URL glob patterns to exclude (e.g. '*/login*').",
          items: { type: "string" }
        },
        prompt: {
          type: "string",
          description: "Prompt for LLM-based extraction on each page (requires 'json' in formats)."
        },
        schema: {
          type: "object",
          description: "JSON schema for structured LLM extraction on each page.",
          properties: {},
          additionalProperties: true
        },
        waitMs: {
          type: "number",
          description: "Milliseconds to wait between page loads."
        }
      },
      required: ["url"],
      additionalProperties: false
    },
    handler: async (args, _context) => {
      const input = asObject(args, "browser_crawl arguments");

      const url = asString(input.url, "url");
      const maxPages = asOptionalNumber(input.maxPages);
      const maxDepth = asOptionalNumber(input.maxDepth);
      const prompt = asOptionalString(input.prompt);
      const waitMs = asOptionalNumber(input.waitMs);

      const body: Record<string, unknown> = { url };
      if (maxPages !== undefined) body.maxPages = maxPages;
      if (maxDepth !== undefined) body.maxDepth = maxDepth;
      if (Array.isArray(input.formats)) body.formats = input.formats;
      if (Array.isArray(input.includePatterns)) body.includePatterns = input.includePatterns;
      if (Array.isArray(input.excludePatterns)) body.excludePatterns = input.excludePatterns;
      if (prompt !== undefined) body.prompt = prompt;
      if (input.schema !== undefined) body.schema = input.schema;
      if (waitMs !== undefined) body.waitMs = waitMs;

      const res = await fetch(`${SURFAGENT_DAEMON_URL}/browser/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000) // 5 min for crawls
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`SurfAgent crawl failed (HTTP ${res.status}): ${text}`);
      }

      const data = await res.json() as Record<string, unknown>;
      return textResult(JSON.stringify(data, null, 2));
    }
  }
];
