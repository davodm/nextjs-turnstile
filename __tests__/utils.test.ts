/**
 * @jest-environment jsdom
 */
import {
  loadTurnstileScript,
  isTurnstileLoaded,
  resetTurnstile,
  executeTurnstile,
  removeTurnstile,
  getTurnstileResponse,
  isTokenExpired,
  renderTurnstile,
} from "../src/utils";

// Silence error-path log noise in tests
jest.spyOn(console, "error").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});

describe("Turnstile utils", () => {
  // Mock Turnstile API
  const mockTurnstile = {
    render: jest.fn(() => "mock-widget-id"),
    getResponse: jest.fn(),
    reset: jest.fn(),
    execute: jest.fn(),
    remove: jest.fn(),
    isExpired: jest.fn(() => false),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up mock Turnstile on window
    (window as any).turnstile = { ...mockTurnstile };

    // Reset DOM
    document.body.innerHTML = `
      <div id="container-1"></div>
      <div id="container-2"></div>
    `;

    // Clear any cached script loading promises
    delete (window as any).__turnstile_load_promise__;
  });

  afterEach(() => {
    // Clean up
    delete (window as any).turnstile;
  });

  // ===========================================================================
  // isTurnstileLoaded
  // ===========================================================================

  describe("isTurnstileLoaded", () => {
    it("returns true when turnstile is available", () => {
      expect(isTurnstileLoaded()).toBe(true);
    });

    it("returns false when turnstile is not available", () => {
      delete (window as any).turnstile;
      expect(isTurnstileLoaded()).toBe(false);
    });
  });

  // ===========================================================================
  // loadTurnstileScript
  // ===========================================================================

  describe("loadTurnstileScript", () => {
    it("resolves immediately if turnstile already exists", async () => {
      const result = await loadTurnstileScript();
      expect(result).toBeUndefined();
    });

    it("caches the loading promise", () => {
      delete (window as any).turnstile;

      const promise1 = loadTurnstileScript();
      const promise2 = loadTurnstileScript();

      expect(promise1).toBe(promise2);
    });

    it("creates script tag with correct URL when turnstile not loaded", async () => {
      delete (window as any).turnstile;

      // Start loading (but don't await - we'll simulate the callback)
      const loadPromise = loadTurnstileScript();

      // Find the script tag
      const script = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]'
      ) as HTMLScriptElement;

      expect(script).not.toBeNull();
      expect(script?.src).toContain("render=explicit");
      expect(script?.src).toContain("onload=");
      // Note: async and defer are boolean properties, not attributes in jsdom
      expect(script?.async).toBe(true);
      expect(script?.defer).toBe(true);

      // Simulate Cloudflare calling the onload callback
      const callbackMatch = script?.src.match(/onload=([^&]+)/);
      if (callbackMatch) {
        (window as any).turnstile = mockTurnstile;
        (window as any)[callbackMatch[1]]();
      }

      await loadPromise;
    });

    it("drops the cached promise and script tag after a load failure so a retry works", async () => {
      delete (window as any).turnstile;
      document.querySelectorAll("script").forEach((el) => el.remove());

      const first = loadTurnstileScript();
      const script = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]'
      ) as HTMLScriptElement;
      script.onerror?.(new Event("error"));
      await expect(first).rejects.toThrow(/failed to load/i);

      expect(document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')).toBeNull();

      const second = loadTurnstileScript();
      expect(second).not.toBe(first);
      const retryScript = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]'
      ) as HTMLScriptElement;
      expect(retryScript).not.toBeNull();
      (window as any).turnstile = mockTurnstile;
      (window as any)[retryScript.src.match(/onload=([^&]+)/)![1]]();
      await expect(second).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // resetTurnstile
  // ===========================================================================

  describe("resetTurnstile", () => {
    it("calls turnstile.reset with widget reference", () => {
      resetTurnstile("widget-123");
      expect(mockTurnstile.reset).toHaveBeenCalledWith("widget-123");
    });

    it("calls turnstile.reset without argument to reset all", () => {
      resetTurnstile();
      expect(mockTurnstile.reset).toHaveBeenCalledWith(undefined);
    });

    it("handles errors silently", () => {
      mockTurnstile.reset.mockImplementationOnce(() => {
        throw new Error("Reset failed");
      });

      // Should not throw
      expect(() => resetTurnstile("widget-123")).not.toThrow();
    });

    it("no-ops when turnstile not loaded", () => {
      delete (window as any).turnstile;
      resetTurnstile("widget-123");
      expect(mockTurnstile.reset).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // removeTurnstile
  // ===========================================================================

  describe("removeTurnstile", () => {
    it("calls turnstile.remove with widget reference", () => {
      removeTurnstile("widget-123");
      expect(mockTurnstile.remove).toHaveBeenCalledWith("widget-123");
    });

    it("handles errors silently", () => {
      mockTurnstile.remove.mockImplementationOnce(() => {
        throw new Error("Remove failed");
      });

      expect(() => removeTurnstile("widget-123")).not.toThrow();
    });

    it("no-ops when turnstile not loaded", () => {
      delete (window as any).turnstile;
      removeTurnstile("widget-123");
      expect(mockTurnstile.remove).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getTurnstileResponse
  // ===========================================================================

  describe("getTurnstileResponse", () => {
    it("returns token when available", () => {
      mockTurnstile.getResponse.mockReturnValueOnce("test-token-abc");
      expect(getTurnstileResponse("widget-123")).toBe("test-token-abc");
    });

    it("returns null when no token", () => {
      mockTurnstile.getResponse.mockReturnValueOnce(undefined);
      expect(getTurnstileResponse("widget-123")).toBeNull();
    });

    it("returns null when empty string", () => {
      mockTurnstile.getResponse.mockReturnValueOnce("");
      expect(getTurnstileResponse("widget-123")).toBeNull();
    });

    it("returns null on error", () => {
      mockTurnstile.getResponse.mockImplementationOnce(() => {
        throw new Error("Widget not found");
      });
      expect(getTurnstileResponse("widget-123")).toBeNull();
    });

    it("returns null when turnstile not loaded", () => {
      delete (window as any).turnstile;
      expect(getTurnstileResponse("widget-123")).toBeNull();
    });
  });

  // ===========================================================================
  // executeTurnstile
  // ===========================================================================

  describe("executeTurnstile", () => {
    it("calls turnstile.execute with widget reference", () => {
      executeTurnstile("widget-123");
      expect(mockTurnstile.execute).toHaveBeenCalledWith("widget-123");
    });

    it("handles errors silently", () => {
      mockTurnstile.execute.mockImplementationOnce(() => {
        throw new Error("Execute failed");
      });

      expect(() => executeTurnstile("widget-123")).not.toThrow();
    });

    it("no-ops when turnstile not loaded", () => {
      delete (window as any).turnstile;
      executeTurnstile("widget-123");
      expect(mockTurnstile.execute).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // isTokenExpired
  // ===========================================================================

  describe("isTokenExpired", () => {
    it("returns false when token not expired", () => {
      mockTurnstile.isExpired.mockReturnValueOnce(false);
      expect(isTokenExpired("widget-123")).toBe(false);
    });

    it("returns true when token expired", () => {
      mockTurnstile.isExpired.mockReturnValueOnce(true);
      expect(isTokenExpired("widget-123")).toBe(true);
    });

    it("returns false on error", () => {
      mockTurnstile.isExpired.mockImplementationOnce(() => {
        throw new Error("Widget not found");
      });
      expect(isTokenExpired("widget-123")).toBe(false);
    });

    it("returns false when turnstile not loaded", () => {
      delete (window as any).turnstile;
      expect(isTokenExpired("widget-123")).toBe(false);
    });
  });

  // ===========================================================================
  // renderTurnstile
  // ===========================================================================

  describe("renderTurnstile", () => {
    it("renders widget and returns widget ID", async () => {
      const widgetId = await renderTurnstile("#container-1", {
        sitekey: "test-key",
      });

      expect(widgetId).toBe("mock-widget-id");
      expect(mockTurnstile.render).toHaveBeenCalledWith("#container-1", {
        sitekey: "test-key",
      });
    });

    it("returns undefined on render failure", async () => {
      mockTurnstile.render.mockImplementationOnce(() => {
        throw new Error("Render failed");
      });

      const widgetId = await renderTurnstile("#container-1", {
        sitekey: "test-key",
      });

      expect(widgetId).toBeUndefined();
    });
  });
});
