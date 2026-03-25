import type { ToolDefinition } from "../contracts.js";
import { asBoolean, asObject, asString, textResult } from "../tool-utils.js";

export const typeTools: ToolDefinition[] = [
  {
    name: "browser_type",
    description: "Type text into an element matched by CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the target input element"
        },
        text: {
          type: "string",
          description: "Text to type into the element"
        },
        submit: {
          type: "boolean",
          description: "Submit the parent form after typing"
        }
      },
      required: ["selector", "text"],
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_type arguments");
      const selector = asString(input.selector, "selector");
      const text = asString(input.text, "text");
      const submit = input.submit === undefined ? false : asBoolean(input.submit, "submit");

      await cdp.typeInto(selector, text, submit);
      return textResult(`Typed ${text.length} characters into ${selector}${submit ? " and submitted." : "."}`);
    }
  }
];
