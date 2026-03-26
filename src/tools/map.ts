import type { ToolDefinition } from "../contracts.js";
import { asObject, asOptionalNumber, asString, textResult } from "../tool-utils.js";

const SURFAGENT_DAEMON_URL = process.env.SURFAGENT_DAEMON_URL ?? "http://127.0.0.1:7201";

export const mapTools: ToolDefinition[] = [
  {
    name: "browser_map",
    description:
      "Discover all URLs on a website without extracting full content. Quick sitemap discovery using real Chrome.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Starting URL for URL discovery."
        },
        maxPages: {
          type: "number",
          description: "Maximum number of pages to visit during discovery (default: 50, max: 50)."
        },
        maxDepth: {
          type: "number",
          description: "Maximum BFS depth from the starting URL (default: 5)."
        }
      },
      required: ["url"],
      additionalProperties: false
    },
    handler: async (args, _context) => {
      const input = asObject(args, "browser_map arguments");

      const url = asString(input.url, "url");
      const maxPages = asOptionalNumber(input.maxPages);
      const maxDepth = asOptionalNumber(input.maxDepth);

      const body: Record<string, unknown> = { url };
      if (maxPages !== undefined) body.maxPages = maxPages;
      if (maxDepth !== undefined) body.maxDepth = maxDepth;

      const res = await fetch(`${SURFAGENT_DAEMON_URL}/browser/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000) // 5 min for deep maps
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`SurfAgent map failed (HTTP ${res.status}): ${text}`);
      }

      const data = await res.json() as Record<string, unknown>;

      // Format the URL list for easy reading
      if (data.ok && data.data && typeof data.data === "object") {
        const d = data.data as Record<string, unknown>;
        if (Array.isArray(d.urls)) {
          const urls: string[] = d.urls;
          const lines = [
            `Found ${urls.length} URL(s):`,
            ...urls.map((u, i) => `${i + 1}. ${u}`)
          ];
          if (typeof d.totalUrls === "number" && d.totalUrls !== urls.length) {
            lines.push(`\nTotal reported: ${d.totalUrls}`);
          }
          return textResult(lines.join("\n"));
        }
      }

      return textResult(JSON.stringify(data, null, 2));
    }
  }
];
