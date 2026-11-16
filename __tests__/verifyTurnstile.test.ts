/**
 * @jest-environment node
 */
import {
  verifyTurnstile,
  getClientIp,
  TurnstileError,
  SITEVERIFY_URL_CN,
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

it("throws TurnstileError with error-codes from a non-ok siteverify response", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ success: false, "error-codes": ["invalid-input-secret"] }),
    { status: 400 },
  );
  await expect(
    verifyTurnstile("token-abc", { secretKey: "shhh" }),
  ).rejects.toMatchObject({ errorCodes: ["invalid-input-secret"] });
});

it("uses a custom siteverifyUrl", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ success: true }));
  await verifyTurnstile("token-abc", {
    secretKey: "shhh",
    siteverifyUrl: SITEVERIFY_URL_CN,
  });
  expect(fetchMock.mock.calls[0][0]).toBe(SITEVERIFY_URL_CN);
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
