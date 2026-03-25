import CDP from "chrome-remote-interface";

const DEFAULT_CDP_ENDPOINT = "ws://127.0.0.1:9222";
const CONNECT_TIMEOUT_MS = 12_000;

type RawClient = {
  Page: {
    enable: () => Promise<void>;
    navigate: (params: { url: string }) => Promise<{ errorText?: string }>;
    getNavigationHistory: () => Promise<{
      currentIndex: number;
      entries: Array<{ id: number }>;
    }>;
    navigateToHistoryEntry: (params: { entryId: number }) => Promise<void>;
    captureScreenshot: (params: Record<string, unknown>) => Promise<{ data: string }>;
    getLayoutMetrics: () => Promise<Record<string, unknown>>;
  };
  Runtime: {
    enable: () => Promise<void>;
    evaluate: (params: {
      expression: string;
      awaitPromise: boolean;
      returnByValue: boolean;
      userGesture: boolean;
    }) => Promise<{
      result: { value?: unknown; description?: string };
      exceptionDetails?: {
        text?: string;
        exception?: { description?: string; value?: string };
      };
    }>;
  };
  DOM: {
    enable: () => Promise<void>;
  };
  Network: {
    enable: () => Promise<void>;
    getCookies: (params?: { urls?: string[] }) => Promise<{ cookies: CookieRecord[] }>;
    setCookie: (params: CookieInput) => Promise<{ success: boolean }>;
  };
  Input: {
    dispatchMouseEvent: (params: Record<string, unknown>) => Promise<void>;
  };
  on: (event: string, cb: () => void) => void;
  close: () => Promise<void>;
};

type TargetDescriptor = {
  id: string;
  type?: string;
  title?: string;
  url?: string;
};

type EndpointConfig = {
  host: string;
  port: number;
  secure: boolean;
};

export type TabInfo = {
  id: string;
  title: string;
  url: string;
  type: string;
  active: boolean;
};

export type ElementInfo = {
  index: number;
  tag: string;
  text: string;
  id: string | null;
  className: string | null;
  name: string | null;
  href: string | null;
  value: string | null;
};

export type FillFormResult = {
  filled: string[];
  missing: string[];
};

export type CookieInput = {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  expires?: number;
};

export type CookieRecord = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  size: number;
  httpOnly: boolean;
  secure: boolean;
  session: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  priority?: string;
};

function parseEndpoint(rawValue: string): EndpointConfig {
  const value = rawValue.trim() === "" ? DEFAULT_CDP_ENDPOINT : rawValue;
  const normalized = /^[a-zA-Z]+:\/\//.test(value) ? value : `ws://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid CDP endpoint URL: ${rawValue}`);
  }

  const secure = parsed.protocol === "wss:" || parsed.protocol === "https:";
  const fallbackPort = secure ? 443 : 80;
  const port = parsed.port ? Number(parsed.port) : fallbackPort;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid CDP endpoint port in ${rawValue}`);
  }

  return {
    host: parsed.hostname,
    port,
    secure
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class CDPClient {
  private readonly endpoint: EndpointConfig;

  private client: RawClient | null = null;

  private currentTargetId: string | null = null;

  private connectPromise: Promise<void> | null = null;

  constructor(cdpUrl = process.env.SURFAGENT_CDP_URL ?? DEFAULT_CDP_ENDPOINT) {
    this.endpoint = parseEndpoint(cdpUrl);
  }

  public getCurrentTargetId(): string | null {
    return this.currentTargetId;
  }

  public async navigate(url: string): Promise<{ url: string; title: string }> {
    this.assertUrl(url);

    await this.withClient(async (client) => {
      const response = await client.Page.navigate({ url });
      if (response.errorText) {
        throw new Error(`Navigation failed: ${response.errorText}`);
      }
    });

    await this.waitForDocumentReady(30_000);

    const currentUrl = await this.getURL();
    const title = await this.getTitle();

    return {
      url: currentUrl,
      title
    };
  }

  public async goBack(): Promise<boolean> {
    return this.navigateHistory(-1);
  }

  public async goForward(): Promise<boolean> {
    return this.navigateHistory(1);
  }

  public async clickSelector(selector: string): Promise<void> {
    const clicked = await this.evaluateValue<boolean>(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        return false;
      }

      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'center', inline: 'center' });
      }

      if (typeof element.click === 'function') {
        element.click();
      } else {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }

      return true;
    })();`);

    if (!clicked) {
      throw new Error(`Element not found for selector: ${selector}`);
    }
  }

  public async clickText(text: string): Promise<void> {
    const clicked = await this.evaluateValue<boolean>(`(() => {
      const needle = ${JSON.stringify(text)}.trim().toLowerCase();
      if (!needle) {
        return false;
      }

      const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"], label, div, span, p'));
      const match = candidates.find((element) => {
        const content = (element.textContent || '').trim().toLowerCase();
        return content.includes(needle);
      });

      if (!match) {
        return false;
      }

      if (typeof match.scrollIntoView === 'function') {
        match.scrollIntoView({ block: 'center', inline: 'center' });
      }

      if (typeof match.click === 'function') {
        match.click();
      } else {
        match.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }

      return true;
    })();`);

    if (!clicked) {
      throw new Error(`Element containing text \"${text}\" was not found.`);
    }
  }

  public async clickCoordinates(x: number, y: number): Promise<void> {
    await this.withClient(async (client) => {
      await client.Input.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
        button: "none"
      });

      await client.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1
      });

      await client.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1
      });
    });
  }

  public async typeInto(selector: string, text: string, submit = false): Promise<void> {
    const result = await this.evaluateValue<{ ok: boolean; reason?: string }>(`(() => {
      const selector = ${JSON.stringify(selector)};
      const value = ${JSON.stringify(text)};
      const submit = ${submit};

      const element = document.querySelector(selector);
      if (!element) {
        return { ok: false, reason: 'not_found' };
      }

      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'center', inline: 'center' });
      }
      if (typeof element.focus === 'function') {
        element.focus();
      }

      const setNativeValue = (target, nextValue) => {
        const prototype = Object.getPrototypeOf(target);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && typeof descriptor.set === 'function') {
          descriptor.set.call(target, nextValue);
        } else {
          target.value = nextValue;
        }
      };

      if ('value' in element) {
        setNativeValue(element, '');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        setNativeValue(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        element.textContent = value;
      }

      if (submit) {
        const form = element.closest('form');
        if (form) {
          if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
          } else {
            form.submit();
          }
        } else {
          element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
      }

      return { ok: true };
    })();`);

    if (!result.ok) {
      throw new Error(`Element not found for selector: ${selector}`);
    }
  }

  public async captureScreenshot(options: {
    fullPage?: boolean;
    selector?: string;
  }): Promise<string> {
    const { fullPage, selector } = options;

    return this.withClient(async (client) => {
      if (selector) {
        await this.scrollToElement(selector);

        const clip = await this.evaluateValue<
          | {
              x: number;
              y: number;
              width: number;
              height: number;
              scale: number;
            }
          | null
        >(`(() => {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) {
            return null;
          }

          return {
            x: Math.max(rect.left, 0),
            y: Math.max(rect.top, 0),
            width: Math.max(rect.width, 1),
            height: Math.max(rect.height, 1),
            scale: 1
          };
        })();`);

        if (!clip) {
          throw new Error(`Cannot capture screenshot. Element not found or not visible: ${selector}`);
        }

        const { data } = await client.Page.captureScreenshot({
          format: "png",
          clip,
          fromSurface: true
        });

        return data;
      }

      if (fullPage) {
        const metrics = await client.Page.getLayoutMetrics();
        const contentSize = (metrics.cssContentSize ?? metrics.contentSize ?? {}) as {
          width?: number;
          height?: number;
        };

        const width = Math.max(1, Math.ceil(contentSize.width ?? 0));
        const height = Math.max(1, Math.ceil(contentSize.height ?? 0));

        const { data } = await client.Page.captureScreenshot({
          format: "png",
          fromSurface: true,
          captureBeyondViewport: true,
          clip: {
            x: 0,
            y: 0,
            width,
            height,
            scale: 1
          }
        });

        return data;
      }

      const { data } = await client.Page.captureScreenshot({
        format: "png",
        fromSurface: true
      });

      return data;
    });
  }

  public async scroll(direction: "up" | "down", amount = 600): Promise<number> {
    const delta = direction === "up" ? -Math.abs(amount) : Math.abs(amount);

    return this.evaluateValue<number>(`(() => {
      window.scrollBy({ top: ${delta}, left: 0, behavior: 'auto' });
      return Number(window.scrollY || window.pageYOffset || 0);
    })();`);
  }

  public async scrollToElement(selector: string): Promise<void> {
    const found = await this.evaluateValue<boolean>(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        return false;
      }

      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      }

      return true;
    })();`);

    if (!found) {
      throw new Error(`Element not found for selector: ${selector}`);
    }
  }

  public async getHTML(selector?: string): Promise<string> {
    if (selector) {
      const html = await this.evaluateValue<string | null>(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        return element ? element.outerHTML : null;
      })();`);

      if (html === null) {
        throw new Error(`Element not found for selector: ${selector}`);
      }

      return html;
    }

    return this.evaluateValue<string>("document.documentElement.outerHTML");
  }

  public async getText(selector?: string): Promise<string> {
    if (selector) {
      const text = await this.evaluateValue<string | null>(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        return element ? (element.textContent || '').trim() : null;
      })();`);

      if (text === null) {
        throw new Error(`Element not found for selector: ${selector}`);
      }

      return text;
    }

    return this.evaluateValue<string>("(document.body?.innerText || '').trim()");
  }

  public async getURL(): Promise<string> {
    return this.evaluateValue<string>("window.location.href");
  }

  public async getTitle(): Promise<string> {
    return this.evaluateValue<string>("document.title || ''");
  }

  public async findElements(selector: string): Promise<ElementInfo[]> {
    return this.evaluateValue<ElementInfo[]>(`(() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      return nodes.slice(0, 200).map((element, index) => ({
        index,
        tag: String(element.tagName || '').toLowerCase(),
        text: String((element.textContent || '').trim()).slice(0, 500),
        id: element.id || null,
        className: typeof element.className === 'string' ? element.className : null,
        name: element.getAttribute('name'),
        href: element.getAttribute('href'),
        value: 'value' in element ? String(element.value ?? '') : null
      }));
    })();`);
  }

  public async listTabs(): Promise<TabInfo[]> {
    const targets = await this.listTargets();

    return targets
      .filter((target) => !target.type || target.type === "page")
      .map((target) => ({
        id: target.id,
        title: target.title ?? "",
        url: target.url ?? "",
        type: target.type ?? "page",
        active: target.id === this.currentTargetId
      }));
  }

  public async newTab(url = "about:blank"): Promise<TabInfo> {
    this.assertUrl(url, true);

    const target = (await (CDP as unknown as {
      New: (options: Record<string, unknown>) => Promise<TargetDescriptor>;
    }).New({
      ...this.endpoint,
      url
    })) as TargetDescriptor;

    await (CDP as unknown as {
      Activate: (options: Record<string, unknown>) => Promise<void>;
    }).Activate({
      ...this.endpoint,
      id: target.id
    });

    this.currentTargetId = target.id;
    await this.reconnect(target.id);

    return {
      id: target.id,
      title: target.title ?? "",
      url: target.url ?? url,
      type: target.type ?? "page",
      active: true
    };
  }

  public async switchTab(targetId: string): Promise<TabInfo> {
    const targets = await this.listTargets();
    const target = targets.find((item) => item.id === targetId);
    if (!target) {
      throw new Error(`Tab not found: ${targetId}`);
    }

    await (CDP as unknown as {
      Activate: (options: Record<string, unknown>) => Promise<void>;
    }).Activate({
      ...this.endpoint,
      id: targetId
    });

    this.currentTargetId = targetId;
    await this.reconnect(targetId);

    return {
      id: target.id,
      title: target.title ?? "",
      url: target.url ?? "",
      type: target.type ?? "page",
      active: true
    };
  }

  public async closeTab(targetId: string): Promise<void> {
    await (CDP as unknown as {
      Close: (options: Record<string, unknown>) => Promise<void>;
    }).Close({
      ...this.endpoint,
      id: targetId
    });

    if (this.currentTargetId === targetId) {
      this.currentTargetId = null;
      await this.reconnect();
    }
  }

  public async fillForm(values: Record<string, string>): Promise<FillFormResult> {
    return this.evaluateValue<FillFormResult>(`(() => {
      const values = ${JSON.stringify(values)};
      const entries = Object.entries(values);
      const filled = [];
      const missing = [];

      const normalize = (input) => String(input || '').trim().toLowerCase();

      const setNativeValue = (target, nextValue) => {
        const prototype = Object.getPrototypeOf(target);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && typeof descriptor.set === 'function') {
          descriptor.set.call(target, nextValue);
        } else {
          target.value = nextValue;
        }
      };

      const setValue = (element, nextValue) => {
        if (!element) {
          return;
        }

        if (element instanceof HTMLSelectElement) {
          const option = Array.from(element.options).find((item) => item.value === nextValue || normalize(item.textContent).includes(normalize(nextValue)));
          if (option) {
            element.value = option.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          setNativeValue(element, nextValue);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }

        if ('value' in element) {
          setNativeValue(element, nextValue);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }

        element.textContent = nextValue;
      };

      const findByLabel = (key) => {
        const label = Array.from(document.querySelectorAll('label')).find((node) => normalize(node.textContent).includes(normalize(key)));
        if (!label) {
          return null;
        }

        const htmlFor = label.getAttribute('for');
        if (htmlFor) {
          return document.getElementById(htmlFor);
        }

        return label.querySelector('input, textarea, select');
      };

      const findField = (key) => {
        const escapedKey = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key;
        const byName = document.querySelector('[name=\"' + escapedKey + '\"]');
        const byId = document.getElementById(key);
        const byPlaceholder = Array.from(document.querySelectorAll('input, textarea, select')).find((node) =>
          normalize(node.getAttribute('placeholder')).includes(normalize(key))
        );
        return byName || byId || byPlaceholder || findByLabel(key);
      };

      for (const [key, nextValue] of entries) {
        const element = findField(key);
        if (!element) {
          missing.push(key);
          continue;
        }

        if (typeof element.scrollIntoView === 'function') {
          element.scrollIntoView({ block: 'center', inline: 'center' });
        }
        if (typeof element.focus === 'function') {
          element.focus();
        }

        setValue(element, String(nextValue));
        filled.push(key);
      }

      return { filled, missing };
    })();`);
  }

  public async selectOption(selector: string, value: string): Promise<void> {
    const result = await this.evaluateValue<{ ok: boolean; reason?: string }>(`(() => {
      const selector = ${JSON.stringify(selector)};
      const value = ${JSON.stringify(value)};
      const element = document.querySelector(selector);

      if (!element) {
        return { ok: false, reason: 'not_found' };
      }

      if (!(element instanceof HTMLSelectElement)) {
        return { ok: false, reason: 'not_select' };
      }

      const option = Array.from(element.options).find((item) => item.value === value || (item.textContent || '').trim() === value);
      if (!option) {
        return { ok: false, reason: 'option_not_found' };
      }

      element.value = option.value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return { ok: true };
    })();`);

    if (!result.ok) {
      if (result.reason === "not_found") {
        throw new Error(`Element not found for selector: ${selector}`);
      }

      if (result.reason === "not_select") {
        throw new Error(`Element for selector ${selector} is not a <select> element.`);
      }

      throw new Error(`Option \"${value}\" was not found in ${selector}.`);
    }
  }

  public async evaluate(code: string): Promise<unknown> {
    return this.withClient(async (client) => {
      const response = await client.Runtime.evaluate({
        expression: code,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true
      });

      if (response.exceptionDetails) {
        const details = response.exceptionDetails;
        const text = details.exception?.description ?? details.exception?.value ?? details.text ?? "Unknown evaluation error";
        throw new Error(`Evaluation failed: ${text}`);
      }

      if (Object.prototype.hasOwnProperty.call(response.result, "value")) {
        return response.result.value;
      }

      return response.result.description ?? null;
    });
  }

  public async waitForSelector(selector: string, timeoutMs = 10_000): Promise<void> {
    const started = Date.now();

    while (Date.now() - started <= timeoutMs) {
      const exists = await this.evaluateValue<boolean>(`Boolean(document.querySelector(${JSON.stringify(selector)}));`);
      if (exists) {
        return;
      }

      await wait(120);
    }

    throw new Error(`Timed out waiting for selector \"${selector}\" after ${timeoutMs}ms.`);
  }

  public async getCookies(urls?: string[]): Promise<CookieRecord[]> {
    return this.withClient(async (client) => {
      const response = urls && urls.length > 0 ? await client.Network.getCookies({ urls }) : await client.Network.getCookies();
      return response.cookies;
    });
  }

  public async setCookie(cookie: CookieInput): Promise<void> {
    const result = await this.withClient(async (client) => {
      return client.Network.setCookie(cookie);
    });

    if (!result.success) {
      throw new Error(`Failed to set cookie ${cookie.name}.`);
    }
  }

  private async navigateHistory(direction: -1 | 1): Promise<boolean> {
    const moved = await this.withClient(async (client) => {
      const history = await client.Page.getNavigationHistory();
      const targetEntry = history.entries[history.currentIndex + direction];
      if (!targetEntry) {
        return false;
      }

      await client.Page.navigateToHistoryEntry({ entryId: targetEntry.id });
      return true;
    });

    if (moved) {
      await this.waitForDocumentReady(20_000);
    }

    return moved;
  }

  private async waitForDocumentReady(timeoutMs: number): Promise<void> {
    const started = Date.now();

    while (Date.now() - started <= timeoutMs) {
      try {
        const state = await this.evaluateValue<string>("document.readyState");
        if (state === "interactive" || state === "complete") {
          return;
        }
      } catch {
        // Page can be mid-navigation. Retry until timeout.
      }

      await wait(150);
    }

    throw new Error(`Timed out waiting for page load after ${timeoutMs}ms.`);
  }

  private async evaluateValue<T>(code: string): Promise<T> {
    const value = await this.evaluate(code);
    return value as T;
  }

  private assertUrl(value: string, allowAboutBlank = false): void {
    if (allowAboutBlank && value === "about:blank") {
      return;
    }

    try {
      // eslint-disable-next-line no-new
      new URL(value);
    } catch {
      throw new Error(`Invalid URL: ${value}`);
    }
  }

  private async withClient<T>(fn: (client: RawClient) => Promise<T>): Promise<T> {
    await this.ensureConnected();

    try {
      return await fn(this.requireClient());
    } catch (error) {
      if (!this.shouldReconnect(error)) {
        throw error;
      }

      await this.reconnect(this.currentTargetId ?? undefined);
      return fn(this.requireClient());
    }
  }

  private requireClient(): RawClient {
    if (!this.client) {
      throw new Error("CDP client is not connected.");
    }

    return this.client;
  }

  private async ensureConnected(targetId?: string): Promise<void> {
    if (this.client && (!targetId || this.currentTargetId === targetId)) {
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.connectInternal(targetId).finally(() => {
        this.connectPromise = null;
      });
    }

    await this.connectPromise;
  }

  private async reconnect(targetId?: string): Promise<void> {
    await this.closeClient();
    await this.ensureConnected(targetId);
  }

  private async connectInternal(targetId?: string): Promise<void> {
    const target = await this.pickTarget(targetId);

    const clientPromise = (CDP as unknown as {
      (options: Record<string, unknown>): Promise<RawClient>;
    })({
      ...this.endpoint,
      target: target.id
    });

    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<RawClient>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Timed out connecting to Chrome CDP at ${this.endpoint.host}:${this.endpoint.port}`));
      }, CONNECT_TIMEOUT_MS);
    });

    const client = await Promise.race([clientPromise, timeoutPromise]);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    this.client = client;
    this.currentTargetId = target.id;

    client.on("disconnect", () => {
      this.client = null;
    });

    const enableResults = await Promise.allSettled([
      client.Page.enable(),
      client.Runtime.enable(),
      client.DOM.enable(),
      client.Network.enable()
    ]);

    const failed = enableResults.find((result) => result.status === "rejected") as
      | PromiseRejectedResult
      | undefined;

    if (failed) {
      await this.closeClient();
      throw new Error(`Failed to initialize CDP domains: ${stringifyError(failed.reason)}`);
    }
  }

  private async closeClient(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;

    try {
      await client.close();
    } catch {
      // Ignore close errors during reconnect.
    }
  }

  private async pickTarget(targetId?: string): Promise<TargetDescriptor> {
    const targets = await this.listTargets();

    if (targetId) {
      const explicit = targets.find((target) => target.id === targetId);
      if (explicit) {
        return explicit;
      }
    }

    if (this.currentTargetId) {
      const current = targets.find((target) => target.id === this.currentTargetId);
      if (current) {
        return current;
      }
    }

    const firstPage = targets.find((target) => !target.type || target.type === "page");
    if (firstPage) {
      return firstPage;
    }

    return (CDP as unknown as {
      New: (options: Record<string, unknown>) => Promise<TargetDescriptor>;
    }).New({
      ...this.endpoint,
      url: "about:blank"
    });
  }

  private async listTargets(): Promise<TargetDescriptor[]> {
    const targets = await (CDP as unknown as {
      List: (options: Record<string, unknown>) => Promise<TargetDescriptor[]>;
    }).List({
      ...this.endpoint
    });

    if (!Array.isArray(targets)) {
      throw new Error("Chrome CDP returned an invalid target list.");
    }

    return targets;
  }

  private shouldReconnect(error: unknown): boolean {
    const message = stringifyError(error).toLowerCase();

    return (
      message.includes("target closed") ||
      message.includes("session closed") ||
      message.includes("websocket") ||
      message.includes("not connected") ||
      message.includes("econnrefused") ||
      message.includes("connection closed")
    );
  }
}
