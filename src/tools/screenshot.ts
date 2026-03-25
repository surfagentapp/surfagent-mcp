import type { ToolDefinition } from "../contracts.js";
import { asObject, asOptionalBoolean, asOptionalString, imageResult } from "../tool-utils.js";

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

      return imageResult(data, "image/png");
    }
  }
];
