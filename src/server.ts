import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { CDPClient } from "./cdp.js";
import type { ResourceDefinition, ToolDefinition } from "./contracts.js";
import { screenshotResource } from "./resources/screenshot.js";
import { tabsResource } from "./resources/tabs.js";
import { clickTools } from "./tools/click.js";
import { cookiesTools } from "./tools/cookies.js";
import { evaluateTools } from "./tools/evaluate.js";
import { formsTools } from "./tools/forms.js";
import { inspectTools } from "./tools/inspect.js";
import { navigateTools } from "./tools/navigate.js";
import { screenshotTools } from "./tools/screenshot.js";
import { scrollTools } from "./tools/scroll.js";
import { tabsTools } from "./tools/tabs.js";
import { typeTools } from "./tools/type.js";
import { waitTools } from "./tools/wait.js";
import { errorResult } from "./tool-utils.js";

const TOOL_SET: ToolDefinition[] = [
  ...navigateTools,
  ...clickTools,
  ...typeTools,
  ...screenshotTools,
  ...scrollTools,
  ...inspectTools,
  ...tabsTools,
  ...formsTools,
  ...evaluateTools,
  ...waitTools,
  ...cookiesTools
];

const RESOURCE_SET: ResourceDefinition[] = [screenshotResource, tabsResource];

function ensureUniqueNames(): void {
  const names = new Set<string>();
  for (const tool of TOOL_SET) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name registered: ${tool.name}`);
    }
    names.add(tool.name);
  }

  const uris = new Set<string>();
  for (const resource of RESOURCE_SET) {
    if (uris.has(resource.uri)) {
      throw new Error(`Duplicate resource URI registered: ${resource.uri}`);
    }
    uris.add(resource.uri);
  }
}

export function createSurfAgentServer(): {
  server: Server;
  cdp: CDPClient;
} {
  ensureUniqueNames();

  const cdp = new CDPClient();

  const server = new Server(
    {
      name: "surfagent-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_SET.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOL_SET.find((item) => item.name === request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${request.params.name}`
          }
        ]
      };
    }

    try {
      return await tool.handler(request.params.arguments ?? {}, { cdp });
    } catch (error) {
      return errorResult(error);
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: RESOURCE_SET.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }))
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = RESOURCE_SET.find((item) => item.uri === request.params.uri);
    if (!resource) {
      throw new Error(`Unknown resource URI: ${request.params.uri}`);
    }

    return resource.read({ cdp });
  });

  return {
    server,
    cdp
  };
}
