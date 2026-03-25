import type { ResourceDefinition } from "../contracts.js";

export const screenshotResource: ResourceDefinition = {
  uri: "browser://screenshot",
  name: "Browser Screenshot",
  description: "Current browser viewport screenshot",
  mimeType: "image/png",
  read: async ({ cdp }) => {
    const data = await cdp.captureScreenshot({});
    return {
      contents: [
        {
          uri: "browser://screenshot",
          mimeType: "image/png",
          blob: data
        }
      ]
    };
  }
};
