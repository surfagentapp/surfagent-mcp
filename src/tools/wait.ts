import type { ToolDefinition } from "../contracts.js";
import { asNumber, asObject, asString, textResult } from "../tool-utils.js";

export const waitTools: ToolDefinition[] = [
  {
    name: "browser_wait",
    description: "Wait for an element to appear",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to wait for"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default 10000)"
        }
      },
      required: ["selector"],
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_wait arguments");
      const selector = asString(input.selector, "selector");
      const timeout = input.timeout === undefined ? 10_000 : asNumber(input.timeout, "timeout");
      if (!Number.isFinite(timeout) || !Number.isInteger(timeout) || timeout < 100 || timeout > 120_000) {
        throw new Error("timeout must be an integer between 100 and 120000 milliseconds.");
      }

      await cdp.waitForSelector(selector, timeout);
      return textResult(`Selector ${selector} appeared within ${timeout}ms.`);
    }
  }
];
