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