import type { ToolDefinition } from "../contracts.js";
import { asObject, asString, asOptionalNumber, textResult } from "../tool-utils.js";
import { daemonHeaders } from "../daemon-auth.js";

const SURFAGENT_DAEMON_URL = process.env.SURFAGENT_DAEMON_URL ?? "http://127.0.0.1:7201";

async function evalExpression(code: string): Promise<unknown> {
  const res = await fetch(`${SURFAGENT_DAEMON_URL}/browser/evaluate`, {
    method: "POST",
    headers: daemonHeaders(),
    body: JSON.stringify({ expression: code }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!res.ok) {
    throw new Error(`Daemon evaluate failed (HTTP ${res.status})`);
  }
  const data = await res.json() as { ok: boolean; result?: unknown };
  return data.result;
}

export const monitorTools: ToolDefinition[] = [
  {
    name: "surf_monitor",
    description:
      "Poll a CSS selector on the current page and return when its text content changes (or report current state). Useful for waiting on dynamic content, price updates, notifications, or async page loads.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to watch for changes"
        },
        timeoutMs: {
          type: "number",
          description: "Max time to wait for change in ms (default 10000, max 60000)"
        },
        pollIntervalMs: {
          type: "number",
          description: "Poll interval in ms (default 500, min 200)"
        },
        previousValue: {
          type: "string",
          description:
            "If provided, returns immediately once the element text differs from this value. Omit to capture current value only."
        }
      },
      required: ["selector"],
      additionalProperties: false
    },
    handler: async (args) => {
      const input = asObject(args, "surf_monitor arguments");
      const selector = asString(input.selector, "selector");

      const timeoutInput = asOptionalNumber(input.timeoutMs);
      if (timeoutInput !== undefined && (!Number.isInteger(timeoutInput) || timeoutInput < 200)) {
        throw new Error("timeoutMs must be an integer greater than or equal to 200.");
      }
      const timeoutMs = Math.min(timeoutInput ?? 10_000, 60_000);

      const pollInput = asOptionalNumber(input.pollIntervalMs);
      if (pollInput !== undefined && (!Number.isInteger(pollInput) || pollInput < 200)) {
        throw new Error("pollIntervalMs must be an integer greater than or equal to 200.");
      }
      const pollIntervalMs = Math.max(pollInput ?? 500, 200);
      const previousValue =
        typeof input.previousValue === "string" ? input.previousValue : undefined;

      const getValueCode = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { found: false, text: null };
        return { found: true, text: (el.textContent || '').trim().slice(0, 5000) };
      })();`;

      // Get initial state
      const initial = await evalExpression(getValueCode) as {
        found: boolean;
        text: string | null;
      };

      if (!initial.found) {
        return textResult(
          JSON.stringify(
            { changed: false, found: false, selector, error: "Element not found" },
            null,
            2
          )
        );
      }

      const baseValue = previousValue !== undefined ? previousValue : initial.text;

      // If no previousValue given, just return current state
      if (previousValue === undefined) {
        return textResult(
          JSON.stringify(
            {
              changed: false,
              found: true,
              selector,
              currentValue: initial.text,
              note: "Pass this value back as previousValue to detect changes."
            },
            null,
            2
          )
        );
      }

      // Poll for changes
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const current = await evalExpression(getValueCode) as {
          found: boolean;
          text: string | null;
        };

        if (!current.found) {
          return textResult(
            JSON.stringify(
              { changed: true, reason: "element_removed", selector, previousValue: baseValue },
              null,
              2
            )
          );
        }

        if (current.text !== baseValue) {
          return textResult(
            JSON.stringify(
              {
                changed: true,
                selector,
                previousValue: baseValue,
                currentValue: current.text,
                elapsedMs: Date.now() - started
              },
              null,
              2
            )
          );
        }

        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      return textResult(
        JSON.stringify(
          {
            changed: false,
            timedOut: true,
            selector,
            currentValue: initial.text,
            timeoutMs,
            elapsedMs: Date.now() - started
          },
          null,
          2
        )
      );
    }
  }
];
