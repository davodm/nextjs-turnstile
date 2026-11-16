/**
 * Utility functions for interacting with Cloudflare Turnstile.
 *
 * These helpers provide imperative control over Turnstile widgets.
 * All functions are SSR-safe and will no-op when `window` is undefined.
 *
 * @module
 */

// =============================================================================
// Constants
// =============================================================================

/** Base URL for the Turnstile script */
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** Maximum time to wait for script to load (ms) */
const SCRIPT_LOAD_TIMEOUT = 10000;

/** Polling interval when waiting for existing script (ms) */
const SCRIPT_POLL_INTERVAL = 100;

// =============================================================================
// Types
// =============================================================================

/**
 * Reference to a Turnstile widget.
 * Can be a widget ID (string or number) or a container element.
 */
export type WidgetRef = string | number | HTMLElement;

/**
 * Minimal interface for Cloudflare's Turnstile API.
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 * @internal
 */
export interface TurnstileAPI {
  render(container: WidgetRef, options?: Record<string, unknown>): string | number | undefined;
  reset(widgetId?: WidgetRef): void;
  remove(widgetId?: WidgetRef): void;
  getResponse(widgetId?: WidgetRef): string | undefined;
  execute(widgetId?: WidgetRef): void;
  isExpired(widgetId?: WidgetRef): boolean;
}

/** Window shape used internally; avoids a global augmentation leaking into consumers' types. */
type TurnstileWindow = Window & {
  turnstile?: TurnstileAPI;
  __turnstile_load_promise__?: Promise<void>;
};

/**
 * Returns Cloudflare's Turnstile API from `window`, or `undefined` on the server / before load.
 * @internal
 */
export function getTurnstile(): TurnstileAPI | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as TurnstileWindow).turnstile;
}

// =============================================================================
// Script Loading
// =============================================================================

/**
 * Loads the Cloudflare Turnstile script in explicit rendering mode.
 *
 * This function is idempotent - calling it multiple times will return
 * the same promise. The script is loaded with `async` and `defer` attributes
 * for optimal performance.
 *
 * @returns Promise that resolves when the script is loaded and `window.turnstile` is available.
 * @throws Error if the script fails to load within the timeout period.
 *
 * @example
 * ```ts
 * await loadTurnstileScript();
 * // window.turnstile is now available
 * window.turnstile.render('#my-widget', { sitekey: 'xxx' });
 * ```
 */
export function loadTurnstileScript(): Promise<void> {
  // SSR guard: resolve immediately on server
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const w = window as unknown as TurnstileWindow;

  // Return cached promise if script is already loading/loaded
  if (w.__turnstile_load_promise__) {
    return w.__turnstile_load_promise__;
  }

  // Create and cache the loading promise
  const promise = new Promise<void>((resolve, reject) => {
    // Case 1: Turnstile is already available (script was loaded elsewhere)
    if (w.turnstile) {
      resolve();
      return;
    }

    // Case 2: Script tag exists but turnstile not ready yet
    // This can happen if another part of the app loaded it
    const existingScript = document.querySelector(
      `script[src^="${TURNSTILE_SCRIPT_URL}"]`
    );

    if (existingScript) {
      // Poll for window.turnstile with timeout
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += SCRIPT_POLL_INTERVAL;

        if (w.turnstile) {
          clearInterval(interval);
          resolve();
        } else if (elapsed >= SCRIPT_LOAD_TIMEOUT) {
          clearInterval(interval);
          reject(new Error("[Turnstile] Script load timeout - turnstile object not found."));
        }
      }, SCRIPT_POLL_INTERVAL);

      return;
    }

    // Case 3: Need to load the script ourselves
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;

    // Generate unique callback name to avoid conflicts
    const callbackName = `__cfTurnstileOnLoad_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const callbacks = window as unknown as Record<string, (() => void) | undefined>;

    // Use explicit rendering mode with onload callback
    // This gives us precise control over when widgets are rendered
    script.src = `${TURNSTILE_SCRIPT_URL}?render=explicit&onload=${callbackName}`;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      cleanup();
      script.remove();
      reject(new Error("[Turnstile] Script load timeout."));
    }, SCRIPT_LOAD_TIMEOUT);

    // Cleanup helper
    const cleanup = () => {
      clearTimeout(timeoutId);
      delete callbacks[callbackName];
    };

    // Success callback (called by Cloudflare when script is ready)
    callbacks[callbackName] = () => {
      cleanup();
      if (w.turnstile) {
        resolve();
      } else {
        reject(new Error("[Turnstile] Script loaded but turnstile object not found."));
      }
    };

    // Error handler
    script.onerror = () => {
      cleanup();
      script.remove();
      reject(new Error("[Turnstile] Script failed to load."));
    };

    // Append script to document
    document.head.appendChild(script);
  });

  // Cache the promise, but drop it on failure so a later mount can retry
  // (ad-blocker, flaky network) instead of being stuck on a rejected promise.
  w.__turnstile_load_promise__ = promise;
  promise.catch(() => {
    if (w.__turnstile_load_promise__ === promise) {
      delete w.__turnstile_load_promise__;
    }
  });

  return promise;
}

/**
 * Checks if the Turnstile script has been loaded and is ready to use.
 *
 * @returns `true` if `window.turnstile` is available, `false` otherwise.
 *
 * @example
 * ```ts
 * if (isTurnstileLoaded()) {
 *   window.turnstile.reset();
 * }
 * ```
 */
export function isTurnstileLoaded(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as TurnstileWindow).turnstile !== "undefined";
}

// =============================================================================
// Widget Control Functions
// =============================================================================

/**
 * Resets a Turnstile widget, allowing the user to solve the challenge again.
 *
 * This is useful after form submission errors or when you need to
 * re-verify the user.
 *
 * @param widgetRef - Widget ID, container selector, or element.
 *                    If omitted, resets all widgets on the page.
 *
 * @example
 * ```ts
 * // Reset a specific widget by ID
 * resetTurnstile('widget-123');
 *
 * // Reset widget in a specific container
 * resetTurnstile('#my-form .turnstile-container');
 *
 * // Reset all widgets
 * resetTurnstile();
 * ```
 */
export function resetTurnstile(widgetRef?: WidgetRef): void {
  const turnstile = getTurnstile();
  if (!turnstile) return;

  try {
    turnstile.reset(widgetRef);
  } catch (error) {
    // Silently ignore errors (widget might not exist)
    if (process.env.NODE_ENV === "development") {
      console.warn("[Turnstile] Reset failed:", error);
    }
  }
}

/**
 * Removes a Turnstile widget from the page.
 *
 * This destroys the widget and removes all associated DOM elements.
 * The widget cannot be used after removal - you'll need to render a new one.
 *
 * @param widgetRef - Widget ID, container selector, or element.
 *
 * @example
 * ```ts
 * removeTurnstile('widget-123');
 * ```
 */
export function removeTurnstile(widgetRef: WidgetRef): void {
  const turnstile = getTurnstile();
  if (!turnstile) return;

  try {
    turnstile.remove(widgetRef);
  } catch (error) {
    // Silently ignore errors (widget might already be removed)
    if (process.env.NODE_ENV === "development") {
      console.warn("[Turnstile] Remove failed:", error);
    }
  }
}

/**
 * Gets the current response token from a Turnstile widget.
 *
 * The token is what you send to your server for verification.
 * Returns `null` if the widget hasn't been solved yet or doesn't exist.
 *
 * @param widgetRef - Widget ID, container selector, or element.
 * @returns The response token, or `null` if unavailable.
 *
 * @example
 * ```ts
 * const token = getTurnstileResponse('widget-123');
 * if (token) {
 *   // Send token to server for verification
 *   await verifyTurnstile(token);
 * }
 * ```
 */
export function getTurnstileResponse(widgetRef: WidgetRef): string | null {
  const turnstile = getTurnstile();
  if (!turnstile) return null;

  try {
    const response = turnstile.getResponse(widgetRef);
    return response || null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Turnstile] getResponse failed:", error);
    }
    return null;
  }
}

/**
 * Executes the challenge for a widget with `execution="execute"` mode.
 *
 * This is only needed when you've configured the widget to not run
 * automatically on render. Call this when you're ready for the user
 * to complete the challenge (e.g., when they click submit).
 *
 * @param widgetRef - Widget ID, container selector, or element.
 *
 * @example
 * ```tsx
 * // In your form component
 * <Turnstile execution="execute" ref={turnstileRef} />
 *
 * // When form is submitted
 * const handleSubmit = () => {
 *   executeTurnstile(turnstileRef.current?.getWidgetId());
 * };
 * ```
 */
export function executeTurnstile(widgetRef: WidgetRef): void {
  const turnstile = getTurnstile();
  if (!turnstile) return;

  try {
    turnstile.execute(widgetRef);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Turnstile] Execute failed:", error);
    }
  }
}

/**
 * Checks if a widget's token has expired.
 *
 * Tokens expire after 300 seconds (5 minutes). If expired, you should
 * reset the widget and have the user solve it again.
 *
 * @param widgetRef - Widget ID, container selector, or element.
 * @returns `true` if expired, `false` otherwise. Returns `false` if widget doesn't exist.
 *
 * @example
 * ```ts
 * if (isTokenExpired('widget-123')) {
 *   resetTurnstile('widget-123');
 *   alert('Please complete the CAPTCHA again.');
 * }
 * ```
 */
export function isTokenExpired(widgetRef: WidgetRef): boolean {
  const turnstile = getTurnstile();
  if (!turnstile) return false;

  try {
    return turnstile.isExpired(widgetRef);
  } catch {
    return false;
  }
}

/**
 * Renders a Turnstile widget in a container element.
 *
 * This is a low-level function for advanced use cases. In most cases,
 * you should use the `<Turnstile>` component instead.
 *
 * @param container - Element or selector where the widget should be rendered.
 * @param options - Widget configuration options.
 * @returns The widget ID, or `undefined` if rendering failed.
 *
 * @example
 * ```ts
 * const widgetId = await renderTurnstile('#my-container', {
 *   sitekey: 'your-site-key',
 *   callback: (token) => console.log('Token:', token),
 * });
 * ```
 */
export async function renderTurnstile(
  container: WidgetRef,
  options: Record<string, unknown>
): Promise<string | undefined> {
  await loadTurnstileScript();

  const turnstile = getTurnstile();
  if (!turnstile) {
    throw new Error("[Turnstile] Script loaded but turnstile object not found.");
  }

  try {
    const widgetId = turnstile.render(container, options);
    return widgetId !== undefined ? String(widgetId) : undefined;
  } catch (error) {
    console.error("[Turnstile] Render failed:", error);
    return undefined;
  }
}
