
/**
 * Resets the Turnstile widget with the specified ID.
 *
 * @param {string} widgetId - The ID of the Turnstile widget to reset (e.g., '.cf-turnstile').
 * @returns {void}
 */
export function resetTurnstile(widgetId) {
    if (typeof window === "undefined") return;
    if ("turnstile" in window) {
      checkWidgetRender();
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
  