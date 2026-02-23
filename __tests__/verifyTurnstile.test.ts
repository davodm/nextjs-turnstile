/**
 * @jest-environment node
 */
import {
  verifyTurnstile,
  getClientIp,
  TurnstileError,
} from "../src/utils/verifyTurnstile";
import fetchMock from "jest-fetch-mock";

fetchMock.enableMocks();

beforeEach(() => fetchMock.resetMocks());

// ---------------------------------------------------------------------------
// verifyTurnstile – success
// ---------------------------------------------------------------------------

it("returns true on successful verification", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ success: true, "error-codes": [] }),
  );
  const ok = await verifyTurnstile("token-abc", { secretKey: "shhh" });
  expect(ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    expect.objectContaining({ method: "POST" }),
  );
});

it("passes when action matches", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ success: true, action: "login", "error-codes": [] }),
  );
  const ok = await verifyTurnstile("token-abc", {
    secretKey: "shhh",
    action: "login",
  });
  expect(ok).toBe(true);
});

it("passes when hostname matches", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      success: true,
      hostname: "example.com",
      "error-codes": [],
    }),
  );
  const ok = await verifyTurnstile("token-abc", {
    secretKey: "shhh",
    hostname: "example.com",
  });
  expect(ok).toBe(true);
});

// ---------------------------------------------------------------------------
// verifyTurnstile – TurnstileError on failure
// ---------------------------------------------------------------------------

it("throws TurnstileError with error-codes on failed verification", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      success: false,
      "error-codes": ["invalid-input-response"],
    }),
  );

  try {
    await verifyTurnstile("bad-token", { secretKey: "shhh" });
    fail("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TurnstileError);
    expect((e as TurnstileError).errorCodes).toContain(
      "invalid-input-response",
    );
  }
});

it("throws TurnstileError for empty token", async () => {
  try {
    await verifyTurnstile("", { secretKey: "shhh" });
    fail("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TurnstileError);
    expect((e as TurnstileError).errorCodes).toContain(
      "missing-input-response",
    );
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it("throws TurnstileError for token exceeding 2048 chars", async () => {
  const longToken = "a".repeat(2049);
  try {
    await verifyTurnstile(longToken, { secretKey: "shhh" });
    fail("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TurnstileError);
    expect((e as TurnstileError).errorCodes).toContain(
      "invalid-input-response",
    );
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it("throws TurnstileError with action-mismatch when action differs", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ success: true, action: "signup", "error-codes": [] }),
  );

  try {
    await verifyTurnstile("token-abc", {
      secretKey: "shhh",
      action: "login",
    });
    fail("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TurnstileError);
    expect((e as TurnstileError).errorCodes).toContain("action-mismatch");
  }
});

it("throws TurnstileError with hostname-mismatch when hostname differs", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ success: true, hostname: "evil.com", "error-codes": [] }),
  );

  try {
    await verifyTurnstile("token-abc", {
      secretKey: "shhh",
      hostname: "example.com",
    });
    fail("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TurnstileError);
    expect((e as TurnstileError).errorCodes).toContain("hostname-mismatch");
  }
});

it("throws TurnstileError with timeout-error when request times out", async () => {
  fetchMock.mockAbortOnce();

  try {
    await verifyTurnstile("token-abc", { secretKey: "shhh", timeout: 1 });
    fail("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TurnstileError);
    expect((e as TurnstileError).errorCodes).toContain("timeout-error");
  }
});

// ---------------------------------------------------------------------------
// verifyTurnstile – config / network errors (plain Error, not TurnstileError)
// ---------------------------------------------------------------------------

it("throws when secret key missing", async () => {
  await expect(verifyTurnstile("token-abc")).rejects.toThrow(
    /Secret key not provided/i,
  );
});

it("throws on non-ok HTTP status", async () => {
  fetchMock.mockResponseOnce("", { status: 500 });
  await expect(
    verifyTurnstile("token-abc", { secretKey: "shhh" }),
  ).rejects.toThrow(/Siteverify request failed.*500/);
});

// ---------------------------------------------------------------------------
// verifyTurnstile – idempotency key is auto-generated
// ---------------------------------------------------------------------------

it("sends an auto-generated idempotency_key", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ success: true, "error-codes": [] }),
  );

  await verifyTurnstile("token-abc", { secretKey: "shhh" });

  const sentBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(sentBody.idempotency_key).toBeDefined();
  expect(typeof sentBody.idempotency_key).toBe("string");
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------

it("getClientIp works with provided headers", async () => {
  const mockHeaders = {
    "x-forwarded-for": "192.168.1.1, 10.0.0.1",
    "cf-connecting-ip": "203.0.113.1",
  };
  const ip = await getClientIp(mockHeaders);
  expect(ip).toBe("203.0.113.1");
});

it("getClientIp works with Headers instance", async () => {
  const mockHeaders = new Headers({
    "x-forwarded-for": "192.168.1.1, 10.0.0.1",
    "cf-connecting-ip": "203.0.113.1",
  });
  const ip = await getClientIp(mockHeaders);
  expect(ip).toBe("203.0.113.1");
});

it("getClientIp falls back to x-forwarded-for when cf-connecting-ip not available", async () => {
  const mockHeaders = { "x-forwarded-for": "192.168.1.1, 10.0.0.1" };
  const ip = await getClientIp(mockHeaders);
  expect(ip).toBe("192.168.1.1");
});

it("getClientIp falls back to x-real-ip when other headers not available", async () => {
  const mockHeaders = { "x-real-ip": "198.51.100.1" };
  const ip = await getClientIp(mockHeaders);
  expect(ip).toBe("198.51.100.1");
});

it("getClientIp returns undefined when no headers provided and not in Next.js context", async () => {
  const ip = await getClientIp();
  expect(ip).toBeUndefined();
});

it("getClientIp handles next/headers async behavior (Next.js 13+)", async () => {
  const mockHeaders = new Headers({ "x-forwarded-for": "192.168.1.1" });

  jest.doMock("next/headers", () => ({
    headers: jest.fn().mockResolvedValue(mockHeaders),
  }));

  const { getClientIp: getClientIpMocked } = await import(
    "../src/utils/verifyTurnstile"
  );

  const ip = await getClientIpMocked();
  expect(ip).toBe("192.168.1.1");

  jest.dontMock("next/headers");
});

it("getClientIp handles next/headers sync behavior (Next.js 12)", async () => {
  const mockHeaders = new Headers({ "x-forwarded-for": "192.168.1.1" });

  jest.doMock("next/headers", () => ({
    headers: jest.fn().mockReturnValue(mockHeaders),
  }));

  const { getClientIp: getClientIpMocked } = await import(
    "../src/utils/verifyTurnstile"
  );

  const ip = await getClientIpMocked();
  expect(ip).toBe("192.168.1.1");

  jest.dontMock("next/headers");
});

// Security best practices tests

it("returns false when token is invalid format", async () => {
  const ok = await verifyTurnstile("", { secretKey: "shhh" });
  expect(ok).toBe(false);
});

it("returns false when token is not a string", async () => {
  const ok = await verifyTurnstile(null as unknown as string, { secretKey: "shhh" });
  expect(ok).toBe(false);
});

it("returns false when token exceeds max length (2048 characters)", async () => {
  const longToken = "a".repeat(2049);
  const ok = await verifyTurnstile(longToken, { secretKey: "shhh" });
  expect(ok).toBe(false);
});

it("returns detailed error response when returnFullResponse is true and token is invalid", async () => {
  const result = await verifyTurnstile("", { secretKey: "shhh", returnFullResponse: true });
  expect(result).toHaveProperty("success", false);
  expect(result).toHaveProperty("error-codes");
  expect((result as FailedVerifyResponse)["error-codes"]).toContain("invalid-token-format");
});

it("includes idempotency key in request when provided", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ success: true }));
  const idempotencyKey = "test-uuid-12345";
  
  await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    idempotencyKey,
  });
  
  const callBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(callBody.idempotency_key).toBe(idempotencyKey);
});

it("returns false on action mismatch", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: new Date().toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const ok = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    action: "signup",
  });
  
  expect(ok).toBe(false);
});

it("returns detailed error on action mismatch with returnFullResponse", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: new Date().toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const result = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    action: "signup",
    returnFullResponse: true,
  });
  
  expect(result).toHaveProperty("success", false);
  expect((result as FailedVerifyResponse)["error-codes"]).toContain("action-mismatch");
});

it("returns false on hostname mismatch", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: new Date().toISOString(),
    hostname: "evil.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const ok = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    hostname: "example.com",
  });
  
  expect(ok).toBe(false);
});

it("returns detailed error on hostname mismatch with returnFullResponse", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: new Date().toISOString(),
    hostname: "evil.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const result = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    hostname: "example.com",
    returnFullResponse: true,
  });
  
  expect(result).toHaveProperty("success", false);
  expect((result as any)["error-codes"]).toContain("hostname-mismatch");
});

it("returns true when action matches", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: new Date().toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const ok = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    action: "login",
  });
  
  expect(ok).toBe(true);
});

it("returns true when hostname matches", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: new Date().toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const ok = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    hostname: "example.com",
  });
  
  expect(ok).toBe(true);
});

it("returns false when token age exceeds maxTokenAge", async () => {
  const pastDate = new Date();
  pastDate.setSeconds(pastDate.getSeconds() - 400); // 400 seconds old
  
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: pastDate.toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const ok = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    maxTokenAge: 300, // 5 minutes
  });
  
  expect(ok).toBe(false);
});

it("returns true when token age is within maxTokenAge", async () => {
  const recentDate = new Date();
  recentDate.setSeconds(recentDate.getSeconds() - 100); // 100 seconds old
  
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: recentDate.toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const ok = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    maxTokenAge: 300, // 5 minutes
  });
  
  expect(ok).toBe(true);
});

it("returns detailed error on token too old with returnFullResponse", async () => {
  const pastDate = new Date();
  pastDate.setSeconds(pastDate.getSeconds() - 400); // 400 seconds old
  
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: pastDate.toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const result = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    maxTokenAge: 300,
    returnFullResponse: true,
  });
  
  expect(result).toHaveProperty("success", false);
  expect((result as any)["error-codes"]).toContain("token-too-old");
});

it("returns full verification response when returnFullResponse is true and token is valid", async () => {
  const now = new Date();
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: now.toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "session-123",
    metadata: { ephemeral_id: "test-id" },
  }));
  
  const result = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    returnFullResponse: true,
  });
  
  expect(result).toHaveProperty("success", true);
  expect(result).toHaveProperty("challenge_ts", now.toISOString());
  expect(result).toHaveProperty("hostname", "example.com");
  expect(result).toHaveProperty("action", "login");
  expect(result).toHaveProperty("cdata", "session-123");
});

it("handles timeout with AbortController", async () => {
  // Mock fetch to reject with AbortError when signal is aborted
  fetchMock.mockImplementation((url, options) => {
    const signal = (options as any).signal;
    if (signal) {
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }
    return new Promise(() => {}); // Never resolves
  });
  
  const result = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    timeout: 50,
  });
  
  expect(result).toBe(false);
}, 30000); // Longer timeout for this async test

it("returns timeout error with returnFullResponse", async () => {
  // Mock fetch to reject with AbortError when signal is aborted
  fetchMock.mockImplementation((url, options) => {
    const signal = (options as any).signal;
    if (signal) {
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }
    return new Promise(() => {}); // Never resolves
  });
  
  const result = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    timeout: 50,
    returnFullResponse: true,
  });
  
  expect(result).toHaveProperty("success", false);
  expect((result as any)["error-codes"]).toContain("validation-timeout");
}, 30000); // Longer timeout for this async test

it("returns false when API returns failure", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: false,
    "error-codes": ["timeout-or-duplicate"],
  }));
  
  const ok = await verifyTurnstile("token-abc", { secretKey: "shhh" });
  expect(ok).toBe(false);
});

it("returns detailed failure response with returnFullResponse", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: false,
    "error-codes": ["invalid-input-response"],
  }));
  
  const result = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    returnFullResponse: true,
  });
  
  expect(result).toHaveProperty("success", false);
  expect(result).toHaveProperty("error-codes");
});

it("includes remoteip in request when ip is provided", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ success: true }));
  
  await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    ip: "192.168.1.100",
  });
  
  const callBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(callBody.remoteip).toBe("192.168.1.100");
});

it("validates action and hostname together", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ 
    success: true,
    action: "login",
    challenge_ts: new Date().toISOString(),
    hostname: "example.com",
    "error-codes": [],
    cdata: "",
    metadata: {},
  }));
  
  const ok = await verifyTurnstile("token-abc", { 
    secretKey: "shhh",
    action: "login",
    hostname: "example.com",
  });
  
  expect(ok).toBe(true);
});

// =============================================================================
// getTurnstileErrorDescription tests
// =============================================================================

describe("getTurnstileErrorDescription", () => {
  it("returns description for valid error code", () => {
    const description = getTurnstileErrorDescription("invalid-input-response");
    expect(description).toBe("Token is invalid, malformed, or expired");
  });

  it("returns description for all error codes", () => {
    const errorCodes: TurnstileErrorCode[] = [
      "missing-input-secret",
      "invalid-input-secret",
      "missing-input-response",
      "invalid-input-response",
      "bad-request",
      "timeout-or-duplicate",
      "internal-error",
      "invalid-token-format",
      "token-too-long",
      "action-mismatch",
      "hostname-mismatch",
      "token-too-old",
      "validation-timeout",
    ];

    for (const code of errorCodes) {
      const description = getTurnstileErrorDescription(code);
      expect(description).toBeTruthy();
      expect(typeof description).toBe("string");
      expect(description.length).toBeGreaterThan(0);
    }
  });

  it("returns unknown error message for invalid code", () => {
    const description = getTurnstileErrorDescription("unknown-error" as TurnstileErrorCode);
    expect(description).toBe("Unknown error");
  });
});

// =============================================================================
// isSuccessfulVerifyResponse type guard tests
// =============================================================================

describe("isSuccessfulVerifyResponse", () => {
  it("returns true for successful response object", () => {
    const response: SuccessfulVerifyResponse = {
      success: true,
      challenge_ts: new Date().toISOString(),
      hostname: "example.com",
      "error-codes": [],
      action: "login",
      cdata: "session-123",
      metadata: { ephemeral_id: "test-id" },
    };

    expect(isSuccessfulVerifyResponse(response)).toBe(true);
  });

  it("returns false for failed response object", () => {
    const response: FailedVerifyResponse = {
      success: false,
      "error-codes": ["invalid-input-response"],
    };

    expect(isSuccessfulVerifyResponse(response)).toBe(false);
  });

  it("returns false for boolean true", () => {
    expect(isSuccessfulVerifyResponse(true)).toBe(false);
  });

  it("returns false for boolean false", () => {
    expect(isSuccessfulVerifyResponse(false)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSuccessfulVerifyResponse(null as any)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSuccessfulVerifyResponse(undefined as any)).toBe(false);
  });

  it("narrows type correctly in conditional", () => {
    const response: SuccessfulVerifyResponse | FailedVerifyResponse | boolean = {
      success: true,
      challenge_ts: new Date().toISOString(),
      hostname: "example.com",
      "error-codes": [],
      action: "login",
      cdata: "",
      metadata: {},
    };

    if (isSuccessfulVerifyResponse(response)) {
      // TypeScript should be able to access properties of SuccessfulVerifyResponse
      expect(response.challenge_ts).toBeTruthy();
      expect(response.hostname).toBe("example.com");
    } else {
      throw new Error("Type guard failed");
    }
  });
});

// =============================================================================
// returnFullResponse comprehensive tests
// =============================================================================

describe("returnFullResponse option", () => {
  it("returns SuccessfulVerifyResponse with full details when successful", async () => {
    const mockResponse = {
      success: true,
      action: "signup",
      challenge_ts: "2024-01-15T10:30:00Z",
      hostname: "example.com",
      "error-codes": [],
      cdata: "user-session-data",
      metadata: { custom_field: "value" },
    };

    fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

    const result = await verifyTurnstile("token-abc", {
      secretKey: "shhh",
      returnFullResponse: true,
    });

    expect(isSuccessfulVerifyResponse(result)).toBe(true);
    if (isSuccessfulVerifyResponse(result)) {
      expect(result.success).toBe(true);
      expect(result.action).toBe("signup");
      expect(result.challenge_ts).toBe("2024-01-15T10:30:00Z");
      expect(result.hostname).toBe("example.com");
      expect(result.cdata).toBe("user-session-data");
      expect(result.metadata.custom_field).toBe("value");
    }
  });

  it("returns FailedVerifyResponse on failure", async () => {
    const mockResponse = {
      success: false,
      "error-codes": ["invalid-input-secret", "bad-request"],
    };

    fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

    const result = await verifyTurnstile("token-abc", {
      secretKey: "shhh",
      returnFullResponse: true,
    });

    expect(isSuccessfulVerifyResponse(result)).toBe(false);
    if (!isSuccessfulVerifyResponse(result) && typeof result === "object") {
      expect((result as FailedVerifyResponse).success).toBe(false);
      expect((result as FailedVerifyResponse)["error-codes"]).toContain(
        "invalid-input-secret",
      );
    }
  });

  it("returns FailedVerifyResponse on action mismatch with returnFullResponse", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        success: true,
        action: "login",
        challenge_ts: new Date().toISOString(),
        hostname: "example.com",
        "error-codes": [],
        cdata: "",
        metadata: {},
      }),
    );

    const result = await verifyTurnstile("token-abc", {
      secretKey: "shhh",
      action: "signup",
      returnFullResponse: true,
    });

    expect(isSuccessfulVerifyResponse(result)).toBe(false);
    if (!isSuccessfulVerifyResponse(result) && typeof result === "object") {
      expect((result as FailedVerifyResponse).success).toBe(false);
      expect((result as FailedVerifyResponse)["error-codes"]).toContain(
        "action-mismatch",
      );
    }
  });
});
