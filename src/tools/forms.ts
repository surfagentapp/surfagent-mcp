import type { ToolDefinition } from "../contracts.js";
import { asObject, asString, textResult } from "../tool-utils.js";

function toStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("fields must be an object mapping label/name to value.");
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const mapped: Record<string, string> = {};

  for (const [key, fieldValue] of entries) {
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error("Form field keys must be non-empty strings.");
    }

    if (fieldValue === undefined || fieldValue === null) {
      mapped[key] = "";
      continue;
    }

    if (typeof fieldValue === "string") {
      mapped[key] = fieldValue;
      continue;
    }

    mapped[key] = String(fieldValue);
  }

  return mapped;
}

export const formsTools: ToolDefinition[] = [
  {
    name: "browser_fill_form",
    description: "Fill multiple form fields using label/name to value mapping",
    inputSchema: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          description: "Map of field label/name to value"
        }
      },
      required: ["fields"],
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_fill_form arguments");
      const fields = toStringMap(input.fields);
      const result = await cdp.fillForm(fields);

      return textResult(
        JSON.stringify(
          {
            filledCount: result.filled.length,
            missingCount: result.missing.length,
            filled: result.filled,
            missing: result.missing
          },
          null,
          2
        )
      );
    }
  },
  {
    name: "browser_select",
    description: "Select an option from a dropdown element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the <select> element"
        },
        value: {
          type: "string",
          description: "Option value or exact option text"
        }
      },
      required: ["selector", "value"],
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asObject(args, "browser_select arguments");
      const selector = asString(input.selector, "selector");
      const value = asString(input.value, "value");

      await cdp.selectOption(selector, value);
      return textResult(`Selected ${value} in ${selector}.`);
    }
  }
];
