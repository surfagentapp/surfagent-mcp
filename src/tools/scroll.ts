import type { ToolDefinition } from "../contracts.js";
import { asOptionalNumber, asOptionalObject, asOptionalString, asString, textResult } from "../tool-utils.js";

export const scrollTools: ToolDefinition[] = [
  {
    name: "browser_scroll",
    description: "Scroll page up or down by amount, or scroll to an element",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          description: "Scroll direction: up or down"
        },
        amount: {
          type: "number",
          description: "Pixels to scroll (default 600)"
        },
        selector: {
          type: "string",
          description: "Scroll to this CSS selector"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asOptionalObject(args, "browser_scroll arguments");
      const selector = asOptionalString(input.selector);

      if (selector) {
        await cdp.scrollToElement(selector);
        return textResult(`Scrolled to element ${selector}.`);
      }

      const directionRaw = input.direction ?? "down";
      const direction = asString(directionRaw, "direction").toLowerCase();
      if (direction !== "up" && direction !== "down") {
        throw new Error("direction must be either 'up' or 'down'.");
      }

      const amount = asOptionalNumber(input.amount) ?? 600;
      const position = await cdp.scroll(direction, amount);
      return textResult(`Scrolled ${direction} by ${amount}px (scrollY=${position}).`);
    }
  }
];
