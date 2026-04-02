import type { ToolDefinition } from "../contracts.js";
import { asOptionalObject, asOptionalString, textResult } from "../tool-utils.js";
import { daemonHeaders } from "../daemon-auth.js";

const SURFAGENT_DAEMON_URL = process.env.SURFAGENT_DAEMON_URL ?? "http://127.0.0.1:7201";

export const pageStateTools: ToolDefinition[] = [
  {
    name: "surf_page_state",
    description:
      "Get structured page state: URL, title, meta, forms, links, buttons, inputs, headings, and visible text summary. Much richer than raw HTML — ideal for understanding what's on the page before interacting.",
    inputSchema: {
      type: "object",
      properties: {
        sections: {
          type: "string",
          description:
            'Comma-separated sections to include: "meta,forms,links,buttons,inputs,headings,text,images". Default: all sections.'
        },
        maxItems: {
          type: "number",
          description: "Max items per section (default 50)"
        }
      },
      additionalProperties: false
    },
    handler: async (args, { cdp }) => {
      const input = asOptionalObject(args, "surf_page_state arguments");
      const sectionsRaw = asOptionalString(input.sections);
      const maxItemsRaw = typeof input.maxItems === "number" ? input.maxItems : 50;
      const maxItems = Math.trunc(maxItemsRaw);
      if (!Number.isFinite(maxItemsRaw) || maxItems < 1 || maxItems > 500) {
        throw new Error("maxItems must be an integer between 1 and 500.");
      }

      const allSections = ["meta", "forms", "links", "buttons", "inputs", "headings", "text", "images"];
      const sections = sectionsRaw
        ? sectionsRaw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => allSections.includes(s))
        : allSections;

      const code = `(() => {
        const MAX = ${maxItems};
        const sections = ${JSON.stringify(sections)};
        const result = {
          url: window.location.href,
          title: document.title || '',
          timestamp: new Date().toISOString()
        };

        if (sections.includes('meta')) {
          const metas = Array.from(document.querySelectorAll('meta[name], meta[property]'));
          result.meta = {};
          for (const m of metas.slice(0, MAX)) {
            const key = m.getAttribute('name') || m.getAttribute('property') || '';
            const val = m.getAttribute('content') || '';
            if (key) result.meta[key] = val;
          }
        }

        if (sections.includes('headings')) {
          result.headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
            .slice(0, MAX)
            .map(h => ({ level: h.tagName.toLowerCase(), text: (h.textContent || '').trim().slice(0, 200) }));
        }

        if (sections.includes('forms')) {
          result.forms = Array.from(document.querySelectorAll('form')).slice(0, MAX).map((f, i) => {
            const fields = Array.from(f.querySelectorAll('input,textarea,select')).slice(0, MAX).map(el => ({
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type') || '',
              name: el.getAttribute('name') || '',
              id: el.id || '',
              placeholder: el.getAttribute('placeholder') || '',
              value: ('value' in el) ? String(el.value || '').slice(0, 200) : '',
              required: el.hasAttribute('required')
            }));
            return {
              index: i,
              action: f.getAttribute('action') || '',
              method: f.getAttribute('method') || 'GET',
              id: f.id || '',
              fields
            };
          });
        }

        if (sections.includes('inputs')) {
          result.inputs = Array.from(document.querySelectorAll('input,textarea,select'))
            .filter(el => !el.closest('form') || sections.indexOf('forms') === -1)
            .slice(0, MAX)
            .map(el => ({
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type') || '',
              name: el.getAttribute('name') || '',
              id: el.id || '',
              placeholder: el.getAttribute('placeholder') || '',
              value: ('value' in el) ? String(el.value || '').slice(0, 200) : ''
            }));
        }

        if (sections.includes('buttons')) {
          const btns = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a.btn, a.button'));
          result.buttons = btns.slice(0, MAX).map(b => ({
            text: (b.textContent || '').trim().slice(0, 200),
            tag: b.tagName.toLowerCase(),
            id: b.id || '',
            className: (typeof b.className === 'string' ? b.className : '').slice(0, 200),
            disabled: b.hasAttribute('disabled'),
            href: b.getAttribute('href') || ''
          }));
        }

        if (sections.includes('links')) {
          result.links = Array.from(document.querySelectorAll('a[href]'))
            .slice(0, MAX)
            .map(a => ({
              text: (a.textContent || '').trim().slice(0, 200),
              href: a.getAttribute('href') || '',
              target: a.getAttribute('target') || ''
            }));
        }

        if (sections.includes('images')) {
          result.images = Array.from(document.querySelectorAll('img'))
            .slice(0, MAX)
            .map(img => ({
              src: (img.getAttribute('src') || '').slice(0, 500),
              alt: img.getAttribute('alt') || '',
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0
            }));
        }

        if (sections.includes('text')) {
          const body = document.body;
          if (body) {
            const text = (body.innerText || '').trim();
            result.textPreview = text.slice(0, 3000);
            result.textLength = text.length;
          }
        }

        return result;
      })();`;

      // Use daemon's evaluate endpoint to run JS without needing EVAL env var
      const res = await fetch(`${SURFAGENT_DAEMON_URL}/browser/evaluate`, {
        method: "POST",
        headers: daemonHeaders(),
        body: JSON.stringify({ expression: code }),
        signal: AbortSignal.timeout(15_000)
      });

      if (!res.ok) {
        // Fallback: use cdp.getText() for basic page info
        const url = await cdp.getURL();
        const title = await cdp.getTitle();
        const text = await cdp.getText();
        return textResult(
          JSON.stringify(
            {
              url,
              title,
              textPreview: text.slice(0, 3000),
              textLength: text.length,
              note: "Full structured extraction unavailable — daemon evaluate endpoint not reachable. Showing basic page info."
            },
            null,
            2
          )
        );
      }

      const data = await res.json() as { ok: boolean; result?: unknown };
      return textResult(JSON.stringify(data.result ?? data, null, 2));
    }
  }
];
