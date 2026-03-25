import type { CDPClient, CookieInput } from "./cdp.js";

export type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      data: string;
      mimeType: string;
    };

export type ToolResponse = {
  content: ToolContent[];
  isError?: boolean;
};

export type ToolContext = {
  cdp: CDPClient;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (args: unknown, context: ToolContext) => Promise<ToolResponse>;
};

export type ResourceContent = {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
};

export type ResourceResult = {
  contents: ResourceContent[];
};

export type ResourceDefinition = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: (context: ToolContext) => Promise<ResourceResult>;
};

export type CookieArgs = {
  action?: "get" | "set";
  urls?: string[];
  cookie?: CookieInput;
};
