import type { CookieInput } from "../cdp.js";
import type { ToolDefinition } from "../contracts.js";
import { asObject, asOptionalString, textResult } from "../tool-utils.js";

function parseStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of strings.`);
  }

  const parsed = value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${field}[${index}] must be a string.`);
    }

    return item;
  });

  return parsed;
}

function parseCookie(value: unknown): CookieInput {
  const input = asObject(value, "cookie");

  if (typeof input.name !== "string" || input.name.trim() === "") {
    throw new Error("cookie.name must be a non-empty string.");
  }

  if (typeof input.value !== "string") {
    throw new Error("cookie.value must be a string.");
  }

  const cookie: CookieInput = {
    name: input.name,
    value: input.value
  };

  if (typeof input.url === "string") {
    cookie.url = input.url;
  }
  if (typeof input.domain === "string") {
    cookie.domain = input.domain;
  }
  if (typeof input.path === "string") {
    cookie.path = input.path;
  }
  if (typeof input.secure === "boolean") {
    cookie.secure = input.secure;
  }
  if (typeof input.httpOnly === "boolean") {
    cookie.httpOnly = input.httpOnly;
  }
  if (typeof input.expires === "number") {
    cookie.expires = input.expires;
  }
  if (typeof input.sameSite === "string") {
    if (input.sameSite !== "Strict" && input.sameSite !== "Lax" && input.sameSite !== "None") {
      throw new Error("cookie.sameSite must be one of: Strict, Lax, None.");
    }
    cookie.sameSite = input.sameSite;
  }

  if (!cookie.url && !cookie.domain) {
    throw new Error("cookie.url or cookie.domain is required when setting a cookie.");
  }

  return cookie;
}

export const cookiesTools: ToolDefinition[] = [
  {
    name: "browser_cookies",
    description: "Get or set browser cookies",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Cookie action: get or set"
        },
        urls: {
          type: "array",
          items: { type: "string" },
          description: "Optional URLs for cookie filtering"
        },
        cookie: {
          type: "object",
          description: "Cookie object for action='set'"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
      const action = asOptionalString(input.action) ?? "get";

      if (action !== "get" && action !== "set") {
        throw new Error("action must be either 'get' or 'set'.");
      }

      if (action === "get") {
        const urls = parseStringArray(input.urls, "urls");
        const cookies = await cdp.getCookies(urls);
        return textResult(JSON.stringify(cookies, null, 2));
      }

      const cookie = parseCookie(input.cookie);
      await cdp.setCookie(cookie);
      return textResult(`Cookie ${cookie.name} was set successfully.`);
    }
  }
];
