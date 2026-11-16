/**
 * Server-side entry point: `import { verifyTurnstile } from "nextjs-turnstile/server"`.
 *
 * Kept separate from the client entry so server-only code never reaches the browser bundle.
 *
 * @module
 */
export {
  verifyTurnstile,
  getClientIp,
  TurnstileError,
  SITEVERIFY_URL_CN,
} from "./utils/verifyTurnstile";
export type { VerifyOptions } from "./utils/verifyTurnstile";
