const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Siteverify endpoint for China-domain widgets. */
export const SITEVERIFY_URL_CN =
  "https://challenges.cloudflare-cn.com/turnstile/v0/siteverify";

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
  /**
   * Siteverify endpoint override. Use {@link SITEVERIFY_URL_CN} for China-domain widgets.
   * Defaults to the global endpoint.
   */
  siteverifyUrl?: string;
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
 * ```ts
 * // Throws on failure, so a falsy check is never reached
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
    res = await fetch(options.siteverifyUrl ?? SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if ((error as { name?: string } | null)?.name === "AbortError") {
      throw new TurnstileError(["timeout-error"]);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  // Siteverify answers 4xx with a JSON body carrying `error-codes`; surface them when present.
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    "error-codes"?: string[];
    action?: string;
    hostname?: string;
  } | null;

  if (!res.ok) {
    const codes = json?.["error-codes"];
    if (codes?.length) throw new TurnstileError(codes);
    throw new Error(
      `[nextjs-turnstile] Siteverify request failed: ${res.status} ${res.statusText}`,
    );
  }

  if (!json) {
    throw new Error("[nextjs-turnstile] Siteverify returned an invalid JSON body.");
  }

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
    const { headers } = await import("next/headers");
    // Next 15+ returns a Promise; Next 13/14 return the Headers synchronously.
    const h = await headers();

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
