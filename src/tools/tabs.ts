import type { ToolDefinition } from "../contracts.js";
import { asNumber, asObject, asOptionalNumber, asOptionalString, asString, textResult } from "../tool-utils.js";

function formatTabs(): string {
  return "Tabs returned as JSON with id, title, url, type, active.";
}

export const tabsTools: ToolDefinition[] = [
  {
    name: "browser_list_tabs",
    description: "List open browser tabs",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: async (_args, { cdp }) => {
      const tabs = await cdp.listTabs();
      return textResult(`${formatTabs()}\n${JSON.stringify(tabs, null, 2)}`);
    }
  },
  {
    name: "browser_new_tab",
    description: "Open a new browser tab",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Initial URL for the new tab"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
      const url = asOptionalString(input.url) ?? "about:blank";
      const tab = await cdp.newTab(url);
      return textResult(`Opened tab ${tab.id} (${tab.url || "about:blank"}).`);
    }
  },
  {
    name: "browser_switch_tab",
    description: "Switch to a browser tab by id, index, or title",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Target tab id"
        },
        index: {
          type: "number",
          description: "Target tab index from browser_list_tabs"
        },
        title: {
          type: "string",
          description: "Partial tab title match"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_switch_tab arguments");
      const id = asOptionalString(input.id);
      const index = asOptionalNumber(input.index);
      const title = asOptionalString(input.title);

      let targetId: string | null = null;

      if (id) {
        targetId = id;
      }

      const tabs = await cdp.listTabs();

      if (!targetId && index !== undefined) {
        const integerIndex = Math.trunc(asNumber(index, "index"));
        const match = tabs[integerIndex];
        if (!match) {
          throw new Error(`Tab index ${integerIndex} is out of range.`);
        }
        targetId = match.id;
      }

      if (!targetId && title) {
        const lower = title.toLowerCase();
        const match = tabs.find((tab) => tab.title.toLowerCase().includes(lower));
        if (!match) {
          throw new Error(`No tab title matched \"${title}\".`);
        }
        targetId = match.id;
      }

      if (!targetId) {
        throw new Error("Provide one tab selector: id, index, or title.");
      }

      const tab = await cdp.switchTab(targetId);
      return textResult(`Switched to tab ${tab.id} (${tab.title || tab.url || "untitled"}).`);
    }
  },
  {
    name: "browser_close_tab",
    description: "Close a browser tab by id (or current active tab if omitted)",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Tab id to close"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
      const id = asOptionalString(input.id) ?? cdp.getCurrentTargetId();
      if (!id) {
        throw new Error("No active tab is selected and no id was provided.");
      }

      await cdp.closeTab(id);
      return textResult(`Closed tab ${id}.`);
    }
  }
];
