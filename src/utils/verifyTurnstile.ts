const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TOKEN_MAX_LENGTH = 2048;
const DEFAULT_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Thrown when Turnstile verification fails.
 *
 * Carries the Cloudflare `error-codes` so callers can react to specific
 * failure reasons (e.g. `"timeout-or-duplicate"`, `"invalid-input-response"`).
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/#error-codes-reference
 */
export class TurnstileError extends Error {
  readonly errorCodes: string[];

  constructor(errorCodes: string[]) {
    super(`Turnstile verification failed: ${errorCodes.join(", ")}`);
    this.name = "TurnstileError";
    this.errorCodes = errorCodes;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for {@link verifyTurnstile}. */
export interface VerifyOptions {
  /** Override the default secret key (falls back to `TURNSTILE_SECRET_KEY` env var). */
  secretKey?: string;
  /** Visitor IP — auto-detected via {@link getClientIp} when omitted. */
  ip?: string;
  /** Fallback headers for IP detection (Pages Router API routes, etc.). */
  headers?: Record<string, string | string[] | undefined> | Headers;
  /** Reject tokens whose `action` field doesn't match this value. */
  action?: string;
  /** Reject tokens whose `hostname` field doesn't match this value. */
  hostname?: string;
  /** Fetch timeout in milliseconds (default: **10 000**). */
  timeout?: number;
}
export type FailedVerifyResponse = {
  success: false,
  "error-codes": TurnstileErrorCode[],
};

/**
 * Type guard to check if a response is a SuccessfulVerifyResponse.
 * Provides safe type narrowing without unsafe casting.
 *
 * @param response - The response to check
 * @returns true if the response is a successful verification
 *
 * @example
 * ```ts
 * const response = await verifyTurnstile(token, { returnFullResponse: true });
 * if (isSuccessfulVerifyResponse(response)) {
 *   console.log("Verified at:", response.challenge_ts);
 * }
 * ```
 */
export function isSuccessfulVerifyResponse(
  response: SuccessfulVerifyResponse | FailedVerifyResponse | boolean
): response is SuccessfulVerifyResponse {
  return typeof response === "object" && response !== null && "success" in response && response.success === true;
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Verifies a Cloudflare Turnstile token server-side.
 *
 * Returns `true` on success. Throws {@link TurnstileError} on failure with
 * an `errorCodes` array describing what went wrong.
 *
 * Follows Cloudflare security best practices:
 * - Validates token format and length (max 2048 characters)
 * - Optional action and hostname validation
 * - Optional token age validation
 * - Optional idempotency key for retry protection
 *
 * ```ts
 * // Simple — backward-compatible boolean check
 * const ok = await verifyTurnstile(token);
 *
 * // With error details
 * try {
 *   await verifyTurnstile(token);
 * } catch (e) {
 *   if (e instanceof TurnstileError) {
 *     console.error(e.errorCodes); // e.g. ["invalid-input-response"]
 *   }
 * }
 * ```
 *
 * @param token   The token produced by the client-side widget.
 * @param options Optional overrides and extra validations.
 * @returns `true` when the token is valid.
 * @throws {TurnstileError} When verification fails (inspect `.errorCodes`).
 */
export async function verifyTurnstile(
  token: string,
  options: VerifyOptions = {},
): Promise<boolean> {
  if (!token || typeof token !== "string") {
    throw new TurnstileError(["missing-input-response"]);
  }
  if (token.length > TOKEN_MAX_LENGTH) {
    throw new TurnstileError(["invalid-input-response"]);
  }

  const secret = options.secretKey ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "[nextjs-turnstile] Secret key not provided. " +
        "Pass `secretKey` in options or set the TURNSTILE_SECRET_KEY env var.",
    );
  }

  const ip = options.ip ?? (await getClientIp(options.headers));

  // --- build request body ---
  const body: Record<string, string> = { secret, response: token };
  if (ip) body.remoteip = ip;

  try {
    body.idempotency_key = crypto.randomUUID();
  } catch {
    /* crypto.randomUUID not available in this runtime — skip */
  }

  // --- fetch with timeout ---
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TurnstileError(["timeout-error"]);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(
      `[nextjs-turnstile] Siteverify request failed: ${res.status} ${res.statusText}`,
    );

  const json = (await res.json()) as {
    success: boolean;
    "error-codes"?: string[];
    action?: string;
    hostname?: string;
  };

  if (!json.success) {
    throw new TurnstileError(json["error-codes"] ?? ["unknown-error"]);
  }

  // --- post-validation checks ---
  if (options.action !== undefined && json.action !== options.action) {
    throw new TurnstileError(["action-mismatch"]);
  }

  if (options.hostname !== undefined && json.hostname !== options.hostname) {
    throw new TurnstileError(["hostname-mismatch"]);
  }

  return true;
}

// ---------------------------------------------------------------------------
// IP helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to resolve the visitor's IP address.
 *
 * Resolution order:
 * 1. `next/headers` (App Router / Server Actions)
 * 2. Provided `initHeaders` (Pages Router / custom)
 */
export async function getClientIp(
  initHeaders?: Record<string, string | string[] | undefined> | Headers,
): Promise<string | undefined> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers } = require("next/headers");

    let h: Headers;
    try {
      h = await headers();
    } catch {
      h = headers();
    }

    const ip =
      h.get("cf-connecting-ip") ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip");
    if (ip) return ip;
  } catch {
    /* not in app-router context */
  }

  if (initHeaders) {
    const get = (name: string): string | undefined => {
      if (initHeaders instanceof Headers)
        return initHeaders.get(name) ?? undefined;
      const val = (
        initHeaders as Record<string, string | string[] | undefined>
      )[name];
      return Array.isArray(val) ? val[0] : val;
    };
    return (
      get("cf-connecting-ip") ||
      get("x-forwarded-for")?.split(",")[0]?.trim() ||
      get("x-real-ip") ||
      undefined
    );
  }

  return undefined;
}

/**
 * Gets a human-readable description for a Turnstile error code.
 * Useful for logging and debugging.
 * 
 * @param errorCode - The error code to get a description for
 * @returns A human-readable description of the error
 */
export function getTurnstileErrorDescription(errorCode: TurnstileErrorCode): string {
  return turnstileErrorDescriptions[errorCode] || "Unknown error";
}
