/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { Turnstile, TurnstileRef } from "../src";

// Mock the utils module
jest.mock("../src/utils", () => ({
  loadTurnstileScript: jest.fn(() => Promise.resolve()),
  // Make removeTurnstile actually clear the widget iframe from container
  // This simulates what the real implementation does via turnstile.remove()
  removeTurnstile: jest.fn((widgetId: string) => {
    // In JSDOM, find and remove any turnstile iframes
    const iframes = document.querySelectorAll('iframe[data-turnstile]');
    iframes.forEach(iframe => iframe.remove());
  }),
  isTurnstileLoaded: jest.fn(() => true),
}));

// Silence console noise in tests
jest.spyOn(console, "error").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});

describe("Turnstile Component", () => {
  // Mock Turnstile API
  // Simulate actual Cloudflare behavior: render() adds an iframe to the container
  const mockRender = jest.fn((container: HTMLElement) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-turnstile', 'true');
    container.appendChild(iframe);
    return "test-widget-id";
  });
  const mockReset = jest.fn();
  const mockRemove = jest.fn((widgetId?: string) => {
    // Simulate Cloudflare's remove behavior: clear the iframes
    const iframes = document.querySelectorAll('iframe[data-turnstile]');
    iframes.forEach(iframe => iframe.remove());
  });
  const mockGetResponse = jest.fn(() => "test-token");
  const mockExecute = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear any lingering iframes from previous tests
    document.querySelectorAll('iframe[data-turnstile]').forEach(el => el.remove());

    // Set up mock Turnstile on window
    (window as any).turnstile = {
      render: mockRender,
      reset: mockReset,
      remove: mockRemove,
      getResponse: mockGetResponse,
      execute: mockExecute,
    };

    // Reset environment
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  });

  afterEach(() => {
    delete (window as any).turnstile;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  });

  // ===========================================================================
  // Basic Rendering
  // ===========================================================================

  describe("Basic Rendering", () => {
    it("renders a container div", async () => {
      render(<Turnstile siteKey="test-key" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });
    });

    it("applies className prop", async () => {
      const { container } = render(
        <Turnstile siteKey="test-key" className="my-custom-class" />
      );

      const div = container.querySelector(".my-custom-class");
      expect(div).not.toBeNull();
    });

    it("applies style prop", async () => {
      const { container } = render(
        <Turnstile siteKey="test-key" style={{ marginTop: 20 }} />
      );

      const div = container.firstChild as HTMLElement;
      expect(div.style.marginTop).toBe("20px");
    });

    it("has accessibility label", async () => {
      const { container } = render(<Turnstile siteKey="test-key" />);

      const widget = container.querySelector('[aria-label="Cloudflare Turnstile challenge"]');
      expect(widget).not.toBeNull();
    });
  });

  // ===========================================================================
  // Configuration
  // ===========================================================================

  describe("Configuration", () => {
    it("uses siteKey prop", async () => {
      render(<Turnstile siteKey="custom-site-key" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            sitekey: "custom-site-key",
          })
        );
      });
    });

    it("falls back to environment variable for siteKey", async () => {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "env-site-key";

      render(<Turnstile />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            sitekey: "env-site-key",
          })
        );
      });
    });

    it("throws error when siteKey is missing", () => {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

      expect(() => {
        render(<Turnstile />);
      }).toThrow("Missing site key");
    });

    it("passes theme option", async () => {
      render(<Turnstile siteKey="test-key" theme="dark" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            theme: "dark",
          })
        );
      });
    });

    it("passes size option", async () => {
      render(<Turnstile siteKey="test-key" size="compact" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            size: "compact",
          })
        );
      });
    });

    it("passes flexible size option", async () => {
      render(<Turnstile siteKey="test-key" size="flexible" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            size: "flexible",
          })
        );
      });
    });

    it("passes appearance option", async () => {
      render(<Turnstile siteKey="test-key" appearance="interaction-only" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            appearance: "interaction-only",
          })
        );
      });
    });

    it("passes execution option", async () => {
      render(<Turnstile siteKey="test-key" execution="execute" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            execution: "execute",
          })
        );
      });
    });

    it("passes refresh options", async () => {
      render(
        <Turnstile
          siteKey="test-key"
          refreshExpired="manual"
          refreshTimeout="never"
        />
      );

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            "refresh-expired": "manual",
            "refresh-timeout": "never",
          })
        );
      });
    });

    it("passes retry options", async () => {
      render(
        <Turnstile siteKey="test-key" retry="never" retryInterval={5000} />
      );

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            retry: "never",
            "retry-interval": 5000,
          })
        );
      });
    });

    it("passes responseFieldName", async () => {
      render(<Turnstile siteKey="test-key" responseFieldName="my-token" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            "response-field-name": "my-token",
          })
        );
      });
    });

    it("disables response field when false", async () => {
      render(<Turnstile siteKey="test-key" responseFieldName={false} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            "response-field": false,
          })
        );
      });
    });

    it("passes action and cData", async () => {
      render(
        <Turnstile siteKey="test-key" action="login" cData="user-123" />
      );

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            action: "login",
            cData: "user-123",
          })
        );
      });
    });

    it("passes tabIndex and language", async () => {
      render(<Turnstile siteKey="test-key" tabIndex={1} language="fr" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            tabindex: 1,
            language: "fr",
          })
        );
      });
    });
  });

  // ===========================================================================
  // Callbacks
  // ===========================================================================

  describe("Callbacks", () => {
    it("calls onSuccess when challenge completed", async () => {
      const onSuccess = jest.fn();

      render(<Turnstile siteKey="test-key" onSuccess={onSuccess} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      // Get the callback that was passed to render
      const renderCall = mockRender.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>];
      const options = renderCall[1];

      // Simulate Cloudflare calling the callback
      act(() => {
        (options.callback as (token: string) => void)("test-token-123");
      });

      expect(onSuccess).toHaveBeenCalledWith("test-token-123");
    });

    it("calls onError when error occurs", async () => {
      const onError = jest.fn();

      render(<Turnstile siteKey="test-key" onError={onError} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      const renderCall = mockRender.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>];
      const options = renderCall[1];

      act(() => {
        const errorCallback = options["error-callback"] as (code?: string) => boolean;
        const result = errorCallback("100001");
        // Should return true to indicate error was handled
        expect(result).toBe(true);
      });

      expect(onError).toHaveBeenCalledWith("100001");
    });

    it("calls onExpire when token expires", async () => {
      const onExpire = jest.fn();

      render(<Turnstile siteKey="test-key" onExpire={onExpire} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      const renderCall = mockRender.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>];
      const options = renderCall[1];

      act(() => {
        (options["expired-callback"] as () => void)();
      });

      expect(onExpire).toHaveBeenCalled();
    });

    it("calls onTimeout when challenge times out", async () => {
      const onTimeout = jest.fn();

      render(<Turnstile siteKey="test-key" onTimeout={onTimeout} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      const renderCall = mockRender.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>];
      const options = renderCall[1];

      act(() => {
        (options["timeout-callback"] as () => void)();
      });

      expect(onTimeout).toHaveBeenCalled();
    });

    it("calls onLoad when widget is ready", async () => {
      const onLoad = jest.fn();

      render(<Turnstile siteKey="test-key" onLoad={onLoad} />);

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // Imperative Handle (Ref)
  // ===========================================================================

  describe("Imperative Handle (Ref)", () => {
    it("provides reset method", async () => {
      const ref = React.createRef<TurnstileRef>();

      render(<Turnstile siteKey="test-key" ref={ref} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      act(() => {
        ref.current?.reset();
      });

      expect(mockReset).toHaveBeenCalled();
    });

    it("provides remove method", async () => {
      const ref = React.createRef<TurnstileRef>();

      render(<Turnstile siteKey="test-key" ref={ref} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      act(() => {
        ref.current?.remove();
      });

      expect(mockRemove).toHaveBeenCalled();
    });

    it("provides getResponse method", async () => {
      const ref = React.createRef<TurnstileRef>();

      render(<Turnstile siteKey="test-key" ref={ref} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      const token = ref.current?.getResponse();

      expect(mockGetResponse).toHaveBeenCalled();
      expect(token).toBe("test-token");
    });

    it("provides execute method", async () => {
      const ref = React.createRef<TurnstileRef>();

      render(<Turnstile siteKey="test-key" ref={ref} />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      act(() => {
        ref.current?.execute();
      });

      expect(mockExecute).toHaveBeenCalled();
    });

    it("provides isReady method", async () => {
      const ref = React.createRef<TurnstileRef>();

      render(<Turnstile siteKey="test-key" ref={ref} />);

      // Initially not ready
      expect(ref.current?.isReady()).toBeFalsy();

      await waitFor(() => {
        expect(ref.current?.isReady()).toBe(true);
      });
    });

    it("provides getWidgetId method", async () => {
      const ref = React.createRef<TurnstileRef>();

      render(<Turnstile siteKey="test-key" ref={ref} />);

      await waitFor(() => {
        expect(ref.current?.getWidgetId()).toBe("test-widget-id");
      });
    });
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  describe("Cleanup", () => {
    it("removes widget on unmount", async () => {
      const { removeTurnstile } = require("../src/utils");

      const { unmount } = render(<Turnstile siteKey="test-key" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalled();
      });

      unmount();

      expect(removeTurnstile).toHaveBeenCalledWith("test-widget-id");
    });
  });

  // ===========================================================================
  // React Strict Mode Compatibility
  // ===========================================================================

  describe("React Strict Mode Compatibility", () => {
    it("prevents double rendering in Strict Mode", async () => {
      // Simulate Strict Mode by forcing useEffect to run multiple times
      // This is what happens in React Strict Mode development
      const { rerender } = render(<Turnstile siteKey="test-key" />);

      // Wait for initial render
      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledTimes(1);
      });

      // Simulate Strict Mode re-running effects (this would happen automatically in Strict Mode)
      // The component should prevent the second render
      rerender(<Turnstile siteKey="test-key" />);

      // Should still only have been called once due to our isRenderingRef guard
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockRender).toHaveBeenCalledTimes(1);
    });

    it("prevents double rendering when iframe already exists in container (React 18+ Strict Mode)", async () => {
      // In React 18+ Strict Mode, effects are double-invoked via reconnectPassiveEffects.
      // The cleanup runs between invocations, but the DOM container persists.
      // This test simulates that scenario by delaying script load resolution
      // and adding an iframe to the container before it resolves.
      
      const { loadTurnstileScript } = require("../src/utils");
      
      // Create a controlled promise for script loading
      let resolveScriptLoad: () => void;
      const scriptLoadPromise = new Promise<void>(resolve => {
        resolveScriptLoad = resolve;
      });
      
      // Override loadTurnstileScript to use our controlled promise
      (loadTurnstileScript as jest.Mock).mockReturnValue(scriptLoadPromise);

      const { container } = render(<Turnstile siteKey="test-key" />);

      // Find the container div that containerRef points to
      const turnstileContainer = container.querySelector('[aria-label="Cloudflare Turnstile challenge"]');
      expect(turnstileContainer).not.toBeNull();

      // Simulate React 18+ Strict Mode scenario:
      // Add an iframe to the container BEFORE the script load resolves
      // (as if a previous effect run already rendered the widget)
      const existingIframe = document.createElement('iframe');
      turnstileContainer!.appendChild(existingIframe);

      // Now resolve the script load
      resolveScriptLoad!();
      
      // Wait for the async code to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      // The component should have detected the existing iframe and NOT called render
      // (this prevents the "Turnstile has already been rendered" error)
      expect(mockRender).not.toHaveBeenCalled();

      // The iframe should still be there
      expect(turnstileContainer!.querySelector('iframe')).not.toBeNull();
    });

    it("allows re-rendering when configuration actually changes", async () => {
      const { rerender } = render(<Turnstile siteKey="test-key" theme="light" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledTimes(1);
      });

      // Change a configuration prop that should trigger re-render
      rerender(<Turnstile siteKey="test-key" theme="dark" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ===========================================================================
  // Callback Stability
  // ===========================================================================

  describe("Callback Stability", () => {
    it("does not re-render widget when callbacks change", async () => {
      const { rerender } = render(
        <Turnstile siteKey="test-key" onSuccess={() => {}} />
      );

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledTimes(1);
      });

      // Re-render with a new callback function
      rerender(<Turnstile siteKey="test-key" onSuccess={() => {}} />);

      // Widget should not be re-rendered
      expect(mockRender).toHaveBeenCalledTimes(1);
    });

    it("re-renders widget when configuration changes", async () => {
      const { rerender } = render(
        <Turnstile siteKey="test-key" theme="light" />
      );

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledTimes(1);
      });

      // Re-render with different theme
      rerender(<Turnstile siteKey="test-key" theme="dark" />);

      await waitFor(() => {
        expect(mockRender).toHaveBeenCalledTimes(2);
      });
    });
  });
});
