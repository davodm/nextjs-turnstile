let isScriptLoaded = false;
let loadScriptPromise = null;
let URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Loads the Cloudflare Turnstile script.
 * Ensures the script is loaded only once.
 *
 * @returns {Promise<void>} - Resolves when the script is loaded successfully.
 */
const loadTurnstileScript = (explicitMode = false) => {
  if (isScriptLoaded) {
    return Promise.resolve();
  }

  if (loadScriptPromise) {
    return loadScriptPromise;
  }
  // appending onload parameter if in explicit mode
  if (explicitMode) {
    URL += `?onload=turnstileReady`;
  }

  loadScriptPromise = new Promise((resolve, reject) => {
    // Check if the script is already present in the document
    if (document.querySelector('script[src="' + URL + '"]')) {
      isScriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = URL;
    script.async = true;

    script.onload = () => {
      isScriptLoaded = true;
      resolve();
    };

    script.onerror = () => {
      console.error("Failed to load Cloudflare Turnstile script.");
      reject(new Error("Failed to load Cloudflare Turnstile script."));
    };

    document.body.appendChild(script);
  });

  return loadScriptPromise;
};

export default loadTurnstileScript;
