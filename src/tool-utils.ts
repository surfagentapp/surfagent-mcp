import type { ToolResponse } from "./contracts.js";

export function asObject(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value as Record<string, unknown>;
}

export function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value;
}

export function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Expected a string value.");
  }

  return value;
}

export function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${field} must be a number.`);
  }

  return value;
}

export function asOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error("Expected a numeric value.");
  }

  return value;
}

export function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
  }

  return value;
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error("Expected a boolean value.");
  }

  return value;
}

export function textResult(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }]
  };
}

export function imageResult(data: string, mimeType = "image/png"): ToolResponse {
  return {
    content: [{ type: "image", data, mimeType }]
  };
}

export function errorResult(error: unknown): ToolResponse {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}
