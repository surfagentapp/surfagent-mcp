import type { ToolDefinition } from "../contracts.js";
import { asObject, asOptionalBoolean, asOptionalString, imageResult, textResult } from "../tool-utils.js";

export const screenshotTools: ToolDefinition[] = [
  {
    name: "browser_screenshot",
    description: "Take a browser screenshot and return a base64 PNG image",
    inputSchema: {
      type: "object",
      properties: {
        fullPage: {
          type: "boolean",
          description: "Capture the entire scrollable page"
        },
        selector: {
          type: "string",
          description: "Capture a screenshot of a specific element"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_screenshot arguments");
      const fullPage = asOptionalBoolean(input.fullPage);
      const selector = asOptionalString(input.selector);

      const options: { fullPage?: boolean; selector?: string } = {};
      if (fullPage !== undefined) {
        options.fullPage = fullPage;
      }
      if (selector !== undefined) {
        options.selector = selector;
      }

      const data = await cdp.captureScreenshot(options);

      if (!data) {
        return textResult("Screenshot capture returned empty data. Is a page loaded?");
      }

      // Return both image (for MCP clients that support it) and text fallback
      // Some providers (e.g. Codex) only handle text content blocks
      return {
        content: [
          { type: "image", data, mimeType: "image/png" },
          { type: "text", text: `Screenshot captured (${Math.round(data.length * 3 / 4 / 1024)}KB). Base64 data:URI: data:image/png;base64,${data.slice(0, 200)}...` }
        ]
      };
    }
  }
];
