import type { ToolDefinition } from "../contracts.js";
import { asObject, asOptionalString, asString, textResult } from "../tool-utils.js";

function parseOptionalInput(args: unknown): Record<string, unknown> {
  if (args === undefined || args === null) {
    return {};
  }

  return asObject(args, "tool arguments");
}

export const inspectTools: ToolDefinition[] = [
  {
    name: "browser_get_text",
    description: "Get visible text content from the current page or a matching element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Optional CSS selector to scope text extraction"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = parseOptionalInput(args);
      const selector = asOptionalString(input.selector);
      const text = await cdp.getText(selector);
      return textResult(text);
    }
  },
  {
    name: "browser_get_html",
    description: "Get HTML for the full page or a matching element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Optional CSS selector to return only one element's HTML"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = parseOptionalInput(args);
      const selector = asOptionalString(input.selector);
      const html = await cdp.getHTML(selector);
      return textResult(html);
    }
  },
  {
    name: "browser_get_url",
    description: "Get the current browser tab URL",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: async (_args, { cdp }) => {
      return textResult(await cdp.getURL());
    }
  },
  {
    name: "browser_get_title",
    description: "Get the current browser tab title",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: async (_args, { cdp }) => {
      return textResult(await cdp.getTitle());
    }
  },
  {
    name: "browser_find_elements",
    description: "Find elements matching a CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to find"
        }
      },
      required: ["selector"],
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_find_elements arguments");
      const selector = asString(input.selector, "selector");
      const elements = await cdp.findElements(selector);
      return textResult(JSON.stringify(elements, null, 2));
    }
  }
];
