import type { ToolDefinition } from "../contracts.js";
import { asObject, asString, textResult } from "../tool-utils.js";

export const evaluateTools: ToolDefinition[] = [
  {
    name: "browser_evaluate",
    description: "Run JavaScript in the page context and return the result",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "JavaScript expression or script to evaluate"
        }
      },
      required: ["code"],
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_evaluate arguments");
      const code = asString(input.code, "code");
      const result = await cdp.evaluate(code);
      return textResult(JSON.stringify(result, null, 2));
    }
  }
];
