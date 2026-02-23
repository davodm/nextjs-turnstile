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
 * // Server-side: Verify the token
 * import { verifyTurnstile } from 'nextjs-turnstile';
 *
 * export async function POST(request: Request) {
 *   const { token } = await request.json();
 *   const ok = await verifyTurnstile(token);
 *
 *   if (!ok) {
 *     return Response.json({ error: 'CAPTCHA failed' }, { status: 400 });
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
// Server-side Verification
// =============================================================================

export {
  verifyTurnstile,
  getClientIp,
  TurnstileError,
} from "./utils/verifyTurnstile";
export type { VerifyOptions } from "./utils/verifyTurnstile";

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

// =============================================================================
// Server-side Verification
// =============================================================================

export {
  verifyTurnstile,
  getClientIp,
  getTurnstileErrorDescription,
  isSuccessfulVerifyResponse,
} from "./utils/verifyTurnstile";

export type {
  // Verification response types
  SuccessfulVerifyResponse,
  FailedVerifyResponse,
  // Verification options and error codes
  VerifyOptions,
  TurnstileErrorCode,
} from "./utils/verifyTurnstile";