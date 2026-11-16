/**
 * Next.js Turnstile - Cloudflare Turnstile CAPTCHA integration for Next.js
 *
 * @packageDocumentation
 * @module nextjs-turnstile
 *
 * @example
 * ```tsx
 * // Client-side: Render the CAPTCHA widget
 * import { Turnstile, TurnstileRef } from 'nextjs-turnstile';
 *
 * function MyForm() {
 *   const turnstileRef = useRef<TurnstileRef>(null);
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <Turnstile
 *         ref={turnstileRef}
 *         onSuccess={(token) => setToken(token)}
 *       />
 *       <button type="submit">Submit</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example
 * ```ts
 * // Server-side: Verify the token (separate entry point)
 * import { verifyTurnstile, TurnstileError } from 'nextjs-turnstile/server';
 *
 * export async function POST(request: Request) {
 *   const { token } = await request.json();
 *   try {
 *     await verifyTurnstile(token);
 *   } catch (e) {
 *     if (e instanceof TurnstileError) {
 *       return Response.json({ error: 'CAPTCHA failed', codes: e.errorCodes }, { status: 400 });
 *     }
 *     throw e;
 *   }
 *
 *   // Continue with your logic...
 * }
 * ```
 */

// =============================================================================
// Component
// =============================================================================

export { default as Turnstile } from "./components/Turnstile";

// =============================================================================
// Component Types
// =============================================================================

export type {
  TurnstileProps,
  TurnstileRef,
  TurnstileSize,
  TurnstileTheme,
  TurnstileAppearance,
  TurnstileExecution,
  TurnstileRefreshBehavior,
  TurnstileRetry,
} from "./components/Turnstile";

// =============================================================================
// Client-side Utilities
// =============================================================================

export {
  // Script loading
  loadTurnstileScript,
  isTurnstileLoaded,

  // Widget control
  resetTurnstile,
  removeTurnstile,
  getTurnstileResponse,
  executeTurnstile,
  isTokenExpired,
  renderTurnstile,
} from "./utils";

export type { WidgetRef } from "./utils";
