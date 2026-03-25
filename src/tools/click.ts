import type { ToolDefinition } from "../contracts.js";
import { asNumber, asObject, asOptionalNumber, asOptionalString, textResult } from "../tool-utils.js";

export const clickTools: ToolDefinition[] = [
  {
    name: "browser_click",
    description: "Click an element by selector, text content, or coordinates",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to click"
        },
        text: {
          type: "string",
          description: "Visible text content to match and click"
        },
        x: {
          type: "number",
          description: "X coordinate in viewport pixels"
        },
        y: {
          type: "number",
          description: "Y coordinate in viewport pixels"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_click arguments");

      const selector = asOptionalString(input.selector);
      const text = asOptionalString(input.text);
      const x = asOptionalNumber(input.x);
      const y = asOptionalNumber(input.y);

      if (selector) {
        await cdp.clickSelector(selector);
        return textResult(`Clicked selector ${selector}.`);
      }

      if (text) {
        await cdp.clickText(text);
        return textResult(`Clicked element containing text \"${text}\".`);
      }

      if (x !== undefined || y !== undefined) {
        const clickX = asNumber(x, "x");
        const clickY = asNumber(y, "y");
        await cdp.clickCoordinates(clickX, clickY);
        return textResult(`Clicked coordinates (${clickX}, ${clickY}).`);
      }

      throw new Error("Provide one click target: selector, text, or both x and y coordinates.");
    }
  }
];
