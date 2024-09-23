/**
 * Resets the Turnstile widget with the specified ID.
 *
 * @param {string} widgetId - The ID of the Turnstile widget to reset (e.g., '.cf-turnstile').
 * @returns {void}
 */
export function resetTurnstile(widgetId) {
  if (typeof window === "undefined") return;
  if ("turnstile" in window) {
    checkTurnstile();
    window.turnstile.reset(widgetId);
  }
}

/**
 * Checks if the Turnstile widget is already rendered and renders it if not.
 *
 * @param {string} widgetId - The ID of the Turnstile widget to check and render if needed (e.g., '.cf-turnstile').
 * @returns {void}
 */
export const checkTurnstile = (widgetId) => {
  if (typeof window === "undefined") return;
  if ("turnstile" in window) {
    try {
      window.turnstile.getResponse(widgetId);
    } catch (err) {
      if (err?.message?.includes("not find")) {
        window.turnstile.render(widgetId);
      }
    }
  }
};

/**
 * Retrieves the Turnstile response token for the specified widget.
 *
 * @param {string} widgetSelector - The CSS selector of the Turnstile widget (e.g., '#cft-cf-turnstile-response-uniqueId').
 * @returns {string|null} The CAPTCHA response token or null if not available.
 */
export function getTurnstileResponse(widgetSelector) {
  if (typeof window === "undefined") return null;
  if ("turnstile" in window) {
    try {
      return window.turnstile.getResponse(widgetSelector);
    } catch (err) {
      console.error("Error retrieving Turnstile response:", err);
      return null;
    }
  }
  return null;
}
