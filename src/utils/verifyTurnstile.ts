/** Cloudflare Turnstile error codes */
export type TurnstileErrorCode =
  | "missing-input-secret"
  | "invalid-input-secret"
  | "missing-input-response"
  | "invalid-input-response"
  | "bad-request"
  | "timeout-or-duplicate"
  | "internal-error"
  | "invalid-token-format"
  | "token-too-long"
  | "action-mismatch"
  | "hostname-mismatch"
  | "token-too-old"
  | "validation-timeout";

const turnstileErrorDescriptions: Record<TurnstileErrorCode, string> = {
  "missing-input-secret": "Secret parameter not provided",
  "invalid-input-secret": "Secret key is invalid or expired",
  "missing-input-response": "Response parameter was not provided",
  "invalid-input-response": "Token is invalid, malformed, or expired",
  "bad-request": "Request is malformed",
  "timeout-or-duplicate": "Token has already been validated or expired",
  "internal-error": "Internal error occurred in Cloudflare service",
  "invalid-token-format": "Token is not a valid string format",
  "token-too-long": "Token exceeds maximum length (2048 characters)",
  "action-mismatch": "Token action does not match expected action",
  "hostname-mismatch": "Token hostname does not match expected hostname",
  "token-too-old": "Token age exceeds maximum allowed age",
  "validation-timeout": "Token validation request timed out",
} as const satisfies Record<TurnstileErrorCode, string>;

/** Options for verifying a Turnstile token. */
export interface VerifyOptions {
  /** Override default secret key (falls back to `TURNSTILE_SECRET_KEY`). */
  secretKey?: string;
  /** Provide IP manually – otherwise we attempt to auto‑detect via `getClientIp()`. */
  ip?: string;
  /** Optional headers fallback when running in pages router API routes. */
  headers?: Record<string, string | string[] | undefined> | Headers;
  /** Expected Action (e.g. "login", "signup", etc.). */
  action?: string;
  /** Expected Hostname (e.g. "example.com"). */
  hostname?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** UUID for retry protection (idempotency key). Recommended for production. */
  idempotencyKey?: string;
  /** Maximum token age in seconds. Defaults to 300 (5 minutes). */
  maxTokenAge?: number;
  /** If true, returns full validation response. Otherwise returns only success boolean. */
  returnFullResponse?: boolean;
}

export type SuccessfulVerifyResponse = {
  success: true,
  challenge_ts: string,
  hostname: string,
  "error-codes": never[],
  action: string,
  cdata: string,
  metadata: Record<string, string>
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


/**
 * Verifies a Cloudflare Turnstile token on the server.
 *
 * Follows Cloudflare security best practices:
 * - Validates token format and length (max 2048 characters)
 * - Optional action and hostname validation
 * - Optional token age validation
 * - Optional idempotency key for retry protection
 *
 * ```ts
 * const result = await verifyTurnstile(token);
 * if (!result.success) throw new Error("Captcha failed");
 * ```
 *
 * @param token   - The token returned by the widget.
 * @param options - Optional configuration and security settings.
 * @returns Boolean (by default) or full verification response if `returnFullResponse` is true.
 */
export async function verifyTurnstile(
  token: string,
  options: VerifyOptions = {}
): Promise<boolean | SuccessfulVerifyResponse | FailedVerifyResponse> {
  // 1. Validate token format and length
  if (!token || typeof token !== "string") {
    if (options.returnFullResponse) return { success: false, "error-codes": ["invalid-token-format"] };
    return false;
  }

  if (token.length > 2048) {
    if (options.returnFullResponse) return { success: false, "error-codes": ["token-too-long"] };
    return false;
  }

  const secret = options.secretKey ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("Turnstile Secret key not provided");

  const ip = options.ip ?? await getClientIp(options?.headers);

  // Cloudflare's API accepts JSON (cf. docs 2024‑12‑01)
  const body: Record<string, string> = { secret, response: token };
  if (ip) body["remoteip"] = ip;
  if (options.idempotencyKey) body["idempotency_key"] = options.idempotencyKey;

  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeoutId = options.timeout ? setTimeout(() => controller.abort(), options.timeout) : undefined;

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options.timeout ? controller.signal : undefined,
      }
    );

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(
        `[nextjs-turnstile] Verification request failed: ${res.status} ${res.statusText}`
      );
    }
    // Cloudflare's API returns JSON with a consistent structure, so we can safely cast it.
    const responseBody = (await res.json()) as SuccessfulVerifyResponse | FailedVerifyResponse;

    // 2. Check basic success
    if (!isSuccessfulVerifyResponse(responseBody)) {
      if (options.returnFullResponse) return responseBody as FailedVerifyResponse;
      return false;
    }
    // At this point, the type guard has narrowed the type safely.
    const verifyResponse = responseBody;

    // 3. Validate action if specified
    if (options.action && verifyResponse.action !== options.action) {
      if (options.returnFullResponse) {
        return {
          success: false,
          "error-codes": ["action-mismatch"]
        } satisfies FailedVerifyResponse;
      }
      return false;
    }

    // 4. Validate hostname if specified
    if (options.hostname && verifyResponse.hostname !== options.hostname) {
      if (options.returnFullResponse) {
        return {
          success: false,
          "error-codes": ["hostname-mismatch"]
        } satisfies FailedVerifyResponse;
      }
      return false;
    }

    // 5. Check token age if maxTokenAge is specified
    if (options.maxTokenAge !== undefined) {
      const challengeTime = new Date(verifyResponse.challenge_ts);
      const now = new Date();
      const ageSeconds = (now.getTime() - challengeTime.getTime()) / 1000;

      if (ageSeconds > options.maxTokenAge) {
        if (options.returnFullResponse) {
          return {
            success: false,
            "error-codes": ["token-too-old"]
          } satisfies FailedVerifyResponse;
        }
        return false;
      }
    }

    if (options.returnFullResponse) return verifyResponse;
    return true;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      if (options.returnFullResponse) return { success: false, "error-codes": ["validation-timeout"] } satisfies FailedVerifyResponse;
      return false;
    }
    throw error;
  } finally {
    // Clear timeout if it was set
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function getClientIp(
  initHeaders?: Record<string, string | string[] | undefined> | Headers
): Promise<string | undefined> {
  // 1. Try next/headers (App Router & Server Actions)
  try {
    // Lazy require so code still compiles in Next 12 environments
    // where `next/headers` doesn't exist.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers } = require("next/headers");

    // Handle both sync (Next.js 12) and async (Next.js 13+) headers()
    let h: Headers;
    try {
      // Try calling headers() as async first (Next.js 13+)
      h = await headers();
    } catch {
      // Fallback to sync call (Next.js 12)
      h = headers();
    }

    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip");
    if (ip) return ip;
    // fallthrough to initHeaders if nothing found
  } catch {
    /* not in app‑router context */
  }

  // 2. Fallback: inspect provided initHeaders (Pages API route etc.)
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
      get("x-forwarded-for")?.split(",")[0]?.trim() ||
      get("cf-connecting-ip") ||
      get("x-real-ip") ||
      undefined
    );
  }

  // 3. Nothing found
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
