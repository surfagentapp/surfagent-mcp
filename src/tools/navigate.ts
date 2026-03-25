import type { ToolDefinition } from "../contracts.js";
import { asObject, asString, textResult } from "../tool-utils.js";

export const navigateTools: ToolDefinition[] = [
  {
    name: "browser_navigate",
    description: "Navigate the browser to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to navigate to"
        }
      },
      required: ["url"],
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_navigate arguments");
      const url = asString(input.url, "url");

      const result = await cdp.navigate(url);
      return textResult(`Navigated to ${result.url} (title: ${result.title || "(untitled)"}).`);
    }
  },
  {
    name: "browser_back",
    description: "Navigate browser history back",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: async (_args, { cdp }) => {
      const moved = await cdp.goBack();
      if (!moved) {
        return textResult("No back history entry is available.");
      }

      return textResult(`Navigated back to ${await cdp.getURL()}.`);
    }
  },
  {
    name: "browser_forward",
    description: "Navigate browser history forward",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: async (_args, { cdp }) => {
      const moved = await cdp.goForward();
      if (!moved) {
        return textResult("No forward history entry is available.");
      }

      return textResult(`Navigated forward to ${await cdp.getURL()}.`);
    }
  }
];
