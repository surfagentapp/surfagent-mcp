import type { ResourceDefinition } from "../contracts.js";

export const tabsResource: ResourceDefinition = {
  uri: "browser://tabs",
  name: "Browser Tabs",
  description: "Current list of open browser tabs",
  mimeType: "application/json",
  read: async ({ cdp }) => {
    const tabs = await cdp.listTabs();

    return {
      contents: [
        {
          uri: "browser://tabs",
          mimeType: "application/json",
          text: JSON.stringify(tabs, null, 2)
        }
      ]
    };
  }
};
