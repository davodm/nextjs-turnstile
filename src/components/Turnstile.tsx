"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import { loadTurnstileScript, removeTurnstile } from "../utils";

// =============================================================================
// Types
// =============================================================================

/**
 * Reference to a Turnstile widget.
 * Can be a widget ID (string or number) or a container element.
 */
type WidgetRef = string | number | HTMLElement;

/**
 * Minimal interface for Cloudflare's Turnstile API.
 * This is the global API object injected by the Turnstile script.
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 * @internal
 */
interface TurnstileAPI {
  render(container: WidgetRef, options?: Record<string, unknown>): string | number;
  reset(widgetId?: WidgetRef): void;
  remove(widgetId?: WidgetRef): void;
  getResponse(widgetId?: WidgetRef): string | undefined;
  execute(widgetId?: WidgetRef): void;
  isExpired(widgetId?: WidgetRef): boolean;
}

/**
 * Size options for the Turnstile widget.
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/#widget-sizes
 */
export type TurnstileSize = "normal" | "compact" | "flexible";

/**
 * Theme options for the Turnstile widget.
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/#theme-options
 */
export type TurnstileTheme = "auto" | "light" | "dark";

/**
 * Appearance modes control when the widget becomes visible.
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/#appearance-modes
 */
export type TurnstileAppearance = "always" | "execute" | "interaction-only";

/**
 * Execution modes control when the challenge runs.
 * - `render`: Challenge runs automatically after render (default)
 * - `execute`: Challenge runs only when `execute()` is called via ref
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/#execution-modes
 */
export type TurnstileExecution = "render" | "execute";

/**
 * Refresh behavior options.
 * - `auto`: Automatically refresh (default, recommended)
 * - `manual`: User must manually trigger refresh
 * - `never`: Never refresh automatically
 */
export type TurnstileRefreshBehavior = "auto" | "manual" | "never";

/**
 * Retry behavior options.
 * - `auto`: Automatically retry on failure (default)
 * - `never`: Never retry, handle manually via error callback
 */
export type TurnstileRetry = "auto" | "never";

/**
 * Imperative handle for the Turnstile component.
 * Access via `useRef<TurnstileRef>()` and passing to the component.
 */
export interface TurnstileRef {
  /** Resets the widget, allowing the user to solve the challenge again. */
  reset: () => void;
  /** Removes the widget from the page. */
  remove: () => void;
  /** Gets the current response token, or null if not available. */
  getResponse: () => string | null;
  /** Executes the challenge (only needed if `execution="execute"`). */
  execute: () => void;
  /** Returns true if the widget has been rendered and is ready. */
  isReady: () => boolean;
  /** Returns the internal widget ID assigned by Cloudflare. */
  getWidgetId: () => string | undefined;
}

/**
 * Props for the Turnstile component.
 */
export interface TurnstileProps {
  /**
   * Your Cloudflare Turnstile site key.
   * Falls back to `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` if not provided.
   */
  siteKey?: string;

  /**
   * Widget theme. Defaults to `"auto"` which follows user's color scheme.
   */
  theme?: TurnstileTheme;

  /**
   * Widget size.
   * - `normal`: 300×65px (default)
   * - `compact`: 150×140px
   * - `flexible`: 100% width (min 300px), 65px height
   */
  size?: TurnstileSize;

  /**
   * Controls when the widget becomes visible.
   * - `always`: Always visible (default)
   * - `execute`: Visible only after challenge begins
   * - `interaction-only`: Visible only when user interaction is required
   */
  appearance?: TurnstileAppearance;

  /**
   * Controls when the challenge runs.
   * - `render`: Runs automatically after widget renders (default)
   * - `execute`: Runs only when `execute()` is called via ref
   */
  execution?: TurnstileExecution;

  /**
   * Name for the hidden input field that stores the token.
   * Useful when submitting forms. Defaults to `"cf-turnstile-response"`.
   * Set to `false` to disable the hidden input entirely.
   */
  responseFieldName?: string | false;

  /**
   * How the widget behaves when the token expires (~5 minutes).
   * Defaults to `"auto"` (recommended).
   */
  refreshExpired?: TurnstileRefreshBehavior;

  /**
   * How the widget behaves when an interactive challenge times out.
   * Defaults to `"auto"` (recommended).
   */
  refreshTimeout?: TurnstileRefreshBehavior;

  /**
   * Retry behavior on failure.
   * - `auto`: Automatically retry (default)
   * - `never`: Handle retries manually via `onError` callback
   */
  retry?: TurnstileRetry;

  /**
   * Retry interval in milliseconds when `retry="auto"`.
   * Must be between 0 and 900000. Defaults to 8000 (8 seconds).
   */
  retryInterval?: number;

  /**
   * Custom action identifier for analytics (max 32 alphanumeric chars).
   * Returned during server-side validation.
   */
  action?: string;

  /**
   * Custom data payload (max 255 alphanumeric chars).
   * Returned during server-side validation.
   */
  cData?: string;

  /**
   * Tab index for accessibility. Defaults to 0.
   */
  tabIndex?: number;

  /**
   * ISO 639-1 language code (e.g., "en", "fr", "de").
   * Defaults to `"auto"` which uses the visitor's browser language.
   */
  language?: string;

  /**
   * Additional CSS class for the container div.
   */
  className?: string;

  /**
   * Inline styles for the container div.
   */
  style?: React.CSSProperties;

  // =========================================================================
  // Callbacks
  // =========================================================================

  /**
   * Called when the challenge is successfully completed.
   * @param token - The verification token to send to your server.
   */
  onSuccess?: (token: string) => void;

  /**
   * Called when an error occurs (e.g., network error, challenge failed).
   *
   * This callback is always treated as "handled" by the widget, which prevents
   * Cloudflare from logging duplicate errors to its backend service.
   *
   * @param errorCode - Optional error code from Cloudflare.
   * @see https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/
   */
  onError?: (errorCode?: string) => void;

  /**
   * Called when the token expires (~5 minutes after issuance).
   * You may want to reset the widget or prompt the user to retry.
   */
  onExpire?: () => void;

  /**
   * Called when an interactive challenge times out without being solved.
   */
  onTimeout?: () => void;

  /**
   * Called before the widget enters interactive mode.
   */
  onBeforeInteractive?: () => void;

  /**
   * Called after the widget leaves interactive mode.
   */
  onAfterInteractive?: () => void;

  /**
   * Called when the visitor's browser is not supported.
   */
  onUnsupported?: () => void;

  /**
   * Called when the widget script has loaded and the widget is ready.
   */
  onLoad?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Cloudflare Turnstile CAPTCHA widget for Next.js applications.
 *
 * Uses explicit rendering mode for reliable lifecycle management in React.
 * Supports all Turnstile configuration options and provides an imperative API
 * via ref for programmatic control.
 *
 * @example
 * ```tsx
 * import { Turnstile, TurnstileRef } from 'nextjs-turnstile';
 *
 * function MyForm() {
 *   const turnstileRef = useRef<TurnstileRef>(null);
 *   const [token, setToken] = useState<string | null>(null);
 *
 *   return (
 *     <form>
 *       <Turnstile
 *         ref={turnstileRef}
 *         siteKey="your-site-key"
 *         onSuccess={setToken}
 *         onError={() => console.error('Turnstile error')}
 *       />
 *       <button
 *         type="button"
 *         onClick={() => turnstileRef.current?.reset()}
 *       >
 *         Reset CAPTCHA
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */
const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(function Turnstile(
  {
    siteKey: customSiteKey,
    theme = "auto",
    size = "normal",
    appearance = "always",
    execution = "render",
    responseFieldName = "cf-turnstile-response",
    refreshExpired = "auto",
    refreshTimeout = "auto",
    retry = "auto",
    retryInterval = 8000,
    action,
    cData,
    tabIndex = 0,
    language = "auto",
    className,
    style,
    onSuccess,
    onError,
    onExpire,
    onTimeout,
    onBeforeInteractive,
    onAfterInteractive,
    onUnsupported,
    onLoad,
  },
  ref
) {
  // ===========================================================================
  // Resolve site key
  // ===========================================================================
  const siteKey = customSiteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    throw new Error(
      "[Turnstile] Missing site key. Provide `siteKey` prop or set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` environment variable."
    );
  }

  // Warn if site key format looks incorrect (should start with 0x or 1x)
  if (
    process.env.NODE_ENV === "development" &&
    !siteKey.startsWith("0x") &&
    !siteKey.startsWith("1x")
  ) {
    console.warn(
      `[Turnstile] Site key "${siteKey}" doesn't match expected format (should start with 0x or 1x).`
    );
  }

  // ===========================================================================
  // State and refs
  // ===========================================================================

  // Container element ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Widget ID assigned by Cloudflare (stored as ref to avoid re-renders)
  // This ref PERSISTS across Strict Mode effect re-runs
  const widgetIdRef = useRef<string | undefined>(undefined);

  // Track if widget is ready
  const [isReady, setIsReady] = useState(false);

  // Track if component is mounted (for async safety)
  const isMountedRef = useRef(true);

  // Track if we have successfully rendered a widget in this component instance
  // This persists across Strict Mode effect re-runs and prevents double rendering
  const hasRenderedRef = useRef(false);

  // ===========================================================================
  // Callback refs - prevents effect re-runs when callbacks change
  // ===========================================================================
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  const onTimeoutRef = useRef(onTimeout);
  const onBeforeInteractiveRef = useRef(onBeforeInteractive);
  const onAfterInteractiveRef = useRef(onAfterInteractive);
  const onUnsupportedRef = useRef(onUnsupported);
  const onLoadRef = useRef(onLoad);

  // Update callback refs when callbacks change (without triggering re-renders)
  useLayoutEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
    onTimeoutRef.current = onTimeout;
    onBeforeInteractiveRef.current = onBeforeInteractive;
    onAfterInteractiveRef.current = onAfterInteractive;
    onUnsupportedRef.current = onUnsupported;
    onLoadRef.current = onLoad;
  });

  // ===========================================================================
  // Imperative handle (ref API)
  // ===========================================================================

  /**
   * Get the Turnstile API from window, with safety check.
   */
  const getTurnstile = useCallback(() => {
    if (typeof window === "undefined") return null;
    return (window as any).turnstile as TurnstileAPI | undefined;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        const turnstile = getTurnstile();
        if (turnstile && widgetIdRef.current) {
          try {
            turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.error("[Turnstile] Reset failed:", e);
          }
        }
      },

      remove: () => {
        const turnstile = getTurnstile();
        if (turnstile && widgetIdRef.current) {
          try {
            turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = undefined;
            hasRenderedRef.current = false;
            setIsReady(false);
          } catch (e) {
            console.error("[Turnstile] Remove failed:", e);
          }
        }
      },

      getResponse: () => {
        const turnstile = getTurnstile();
        if (turnstile && widgetIdRef.current) {
          try {
            return turnstile.getResponse(widgetIdRef.current) || null;
          } catch {
            return null;
          }
        }
        return null;
      },

      execute: () => {
        const turnstile = getTurnstile();
        if (turnstile && widgetIdRef.current) {
          try {
            turnstile.execute(widgetIdRef.current);
          } catch (e) {
            console.error("[Turnstile] Execute failed:", e);
          }
        }
      },

      isReady: () => isReady,

      getWidgetId: () => widgetIdRef.current,
    }),
    [getTurnstile, isReady]
  );

  // ===========================================================================
  // Main effect: Load script and render widget
  // ===========================================================================

  useEffect(() => {
    isMountedRef.current = true;
    const container = containerRef.current;

    if (!container) {
      return;
    }

    // ==========================================================================
    // React 18+ Strict Mode Guard
    // ==========================================================================
    // In Strict Mode, effects are double-invoked:
    // 1. Effect runs → cleanup runs → effect runs again
    // 2. Additionally, React calls `reconnectPassiveEffects` which re-runs
    //    effects WITHOUT unmounting the component
    //
    // We use multiple checks to prevent double widget creation:
    // 1. hasRenderedRef - tracks if we've already rendered successfully
    // 2. widgetIdRef - tracks the current widget ID
    // 3. iframe check - DOM-level verification
    // ==========================================================================

    // Check 1: If we've already successfully rendered in this effect run, don't render again
    // This prevents double rendering within the same effect execution
    if (hasRenderedRef.current) {
      return;
    }

    // Check 2: If we have a widget ID but hasRenderedRef is false, it means this is a
    // re-render due to configuration changes - we need to remove the old widget first
    if (widgetIdRef.current) {
      // Check if turnstile is already available (script already loaded)
      const turnstile = (window as any).turnstile as TurnstileAPI | undefined;
      if (turnstile) {
        try {
          turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.warn("[Turnstile] Failed to remove previous widget:", e);
        }
      }
      widgetIdRef.current = undefined;
      setIsReady(false);
    }

    // Check 3: If container already has an iframe (widget), don't render again
    // This catches cases where the widget exists but our refs were reset
    if (container.querySelector('iframe[src*="turnstile"], iframe[allow*="cross-origin"]')) {
      return;
    }

    // Mark that we're attempting to render
    hasRenderedRef.current = true;

    // Load the Turnstile script and render the widget
    loadTurnstileScript()
      .then(() => {
        // Safety check: component might have unmounted during script load
        if (!isMountedRef.current || !containerRef.current) {
          hasRenderedRef.current = false;
          return;
        }

        const turnstile = (window as any).turnstile as TurnstileAPI | undefined;

        if (!turnstile) {
          console.error("[Turnstile] Script loaded but turnstile object not found.");
          onErrorRef.current?.("script_load_failed");
          hasRenderedRef.current = false;
          return;
        }

        // Final iframe check before rendering (in case of race conditions)
        if (containerRef.current.querySelector('iframe')) {
          // Widget already exists, just mark as ready
          setIsReady(true);
          onLoadRef.current?.();
          return;
        }

        // If we already have a widget ID (set by a previous render), don't render again
        if (widgetIdRef.current) {
          setIsReady(true);
          onLoadRef.current?.();
          return;
        }

        // Build render options
        // NOTE: We use the kebab-case API keys as per Cloudflare docs
        const options: Record<string, unknown> = {
          sitekey: siteKey,
          theme,
          size,
          appearance,
          execution,
          "refresh-expired": refreshExpired,
          "refresh-timeout": refreshTimeout,
          retry,
          "retry-interval": retryInterval,
          tabindex: tabIndex,
          language,

          // Callbacks - use refs to get latest values
          callback: (token: string) => {
            onSuccessRef.current?.(token);
          },
          "error-callback": (errorCode?: string) => {
            onErrorRef.current?.(errorCode);
            // Return true to indicate error was handled
            // This prevents Cloudflare from logging additional errors
            return true;
          },
          "expired-callback": () => {
            onExpireRef.current?.();
          },
          "timeout-callback": () => {
            onTimeoutRef.current?.();
          },
          "before-interactive-callback": () => {
            onBeforeInteractiveRef.current?.();
          },
          "after-interactive-callback": () => {
            onAfterInteractiveRef.current?.();
          },
          "unsupported-callback": () => {
            onUnsupportedRef.current?.();
          },
        };

        // Optional: response field configuration
        if (responseFieldName === false) {
          options["response-field"] = false;
        } else if (responseFieldName) {
          options["response-field-name"] = responseFieldName;
        }

        // Optional: action and cData
        if (action) {
          options.action = action;
        }
        if (cData) {
          options.cData = cData;
        }

        // Render the widget
        try {
          const renderedId = turnstile.render(containerRef.current, options);

          if (renderedId !== undefined && renderedId !== null) {
            widgetIdRef.current = String(renderedId);

            if (isMountedRef.current) {
              setIsReady(true);
              onLoadRef.current?.();
            }
          } else {
            console.error("[Turnstile] Render returned invalid widget ID.");
            onErrorRef.current?.("render_failed");
            hasRenderedRef.current = false;
          }
        } catch (e) {
          console.error("[Turnstile] Render failed:", e);
          onErrorRef.current?.("render_exception");
          hasRenderedRef.current = false;
        }
      })
      .catch((error) => {
        console.error("[Turnstile] Script load failed:", error);
        if (isMountedRef.current) {
          onErrorRef.current?.("script_load_failed");
        }
        hasRenderedRef.current = false;
      });

    // Cleanup on unmount or when dependencies change
    return () => {
      isMountedRef.current = false;

      // ==========================================================================
      // Enhanced Cleanup Strategy for Strict Mode + Re-rendering
      // ==========================================================================
      // We need to handle three scenarios:
      // 1. Real unmount: Remove widget completely
      // 2. Strict Mode cleanup: Keep widget but allow re-run
      // 3. Dependency change: Reset refs to allow re-rendering with new config
      // ==========================================================================

      const isRealUnmount = !containerRef.current || !document.body.contains(containerRef.current);

      if (isRealUnmount && widgetIdRef.current) {
        // Real unmount - clean up the widget completely
        removeTurnstile(widgetIdRef.current);
        widgetIdRef.current = undefined;
        hasRenderedRef.current = false;
        setIsReady(false);
      } else {
        // Either Strict Mode cleanup OR dependency change
        // We need to reset hasRenderedRef to allow the next effect run to proceed
        // This enables re-rendering when configuration changes
        hasRenderedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Only include props that should cause a full re-render of the widget.
    // Callbacks are intentionally excluded and accessed via refs instead.
    // This prevents widget destruction/recreation when callback functions change
    // (e.g., when parent passes inline arrow functions on every render).
    siteKey,
    theme,
    size,
    appearance,
    execution,
    responseFieldName,
    refreshExpired,
    refreshTimeout,
    retry,
    retryInterval,
    action,
    cData,
    tabIndex,
    language,
  ]);

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      // Accessibility: ensure the container can be focused if needed
      aria-label="Cloudflare Turnstile challenge"
    />
  );
});

// =============================================================================
// Internal Types (Cloudflare's API shape)
// =============================================================================

/**
 * DOM element to mount the widget.
 * Usually a div with id or a querySelector result.
 */
type TurnstileContainer = HTMLElement | null;

export default Turnstile;
