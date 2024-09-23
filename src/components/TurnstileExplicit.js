import { useEffect } from "react";
import loadTurnstileScript from "../utils/loadScript";

let explicitFields = []; // Array to track the explicit CAPTCHA fields

/**
 * TurnstileExplicit component registers and initializes the Cloudflare Turnstile CAPTCHA in explicit mode.
 *
 * This component registers CAPTCHA instances, which must be manually initialized using the provided
 * response field name as the ID for the corresponding `<div>` element. The initialization script will
 * render the CAPTCHA based on the specified theme and size.
 *
 * @component
 * @param {string} [theme='light'] - The theme of the CAPTCHA widget. Options are 'light' or 'dark'.
 * @param {string} [size='normal'] - The size of the CAPTCHA widget. Options are 'normal' or 'compact'.
 * @param {string} [responseFieldName='cf-turnstile-response'] - The name of the hidden input field and the ID of the `<div>` that will contain the CAPTCHA widget.
 * @param {string} [siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY] - The site key for Turnstile CAPTCHA. Defaults to the value in the environment variables.
 * @param {function} [onExpire=() => {}] - The callback function to execute when the CAPTCHA expires.
 * @param {function} [onError=() => {}] - The callback function to execute when an error occurs.
 * @param {function} [onSuccess=() => {}] - The callback function to execute when the CAPTCHA is successfully solved.
 * @returns {null} No visible component is rendered, only registers the field for later initialization.
 */
const TurnstileExplicit = ({
  theme = "light",
  size = "normal",
  responseFieldName = "cf-turnstile-response",
  onExpire = () => {},
  onError = () => {},
  onSuccess = () => {},
}) => {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    // Prevent Duplicate `responseFieldName`
    const isDuplicate = explicitFields.some(
      (field) => field.fieldName === responseFieldName
    );
    if (isDuplicate) {
      throw new Error(
        `Duplicate responseFieldName "${responseFieldName}" detected. Each TurnstileExplicit component must have a unique responseFieldName.`
      );
    }

    // Register the field for later initialization
    explicitFields.push({
      fieldName: responseFieldName,
      size,
      theme,
      callbacks: { onExpire, onError, onSuccess },
    });

    return () => {
      // Cleanup: Remove the field if the component unmounts
      explicitFields = explicitFields.filter(
        (field) => field.fieldName !== responseFieldName
      );
    };
  }, [responseFieldName, size, theme, onSuccess, onError, onExpire]);

  useEffect(() => {
    // Load the Turnstile script in explicit mode
    loadTurnstileScript(true)
      .then(() => {
        // Define the global callback function turnstileReady
        if (
          typeof window.turnstile !== "undefined" &&
          window.turnstile &&
          window.turnstileReady
        ) {
          // Define Function
          window.turnstileReady = function () {
            explicitFields.forEach(function (field) {
              // Define unique callback function names
              const CALLBACK_PREFIX = `turnstileCallbacks_${field.fieldName}`;
              const CALLBACK_NAMES = {
                verify: `${CALLBACK_PREFIX}_verify`,
                error: `${CALLBACK_PREFIX}_error`,
                expire: `${CALLBACK_PREFIX}_expire`,
                timeout: `${CALLBACK_PREFIX}_timeout`,
              };
              // Assign global callback functions
              window[CALLBACK_NAMES.verify] = (token) => {
                field.callbacks.onSuccess(token);
              };

              window[CALLBACK_NAMES.error] = () => {
                field.callbacks.onError();
              };

              window[CALLBACK_NAMES.expire] = () => {
                field.callbacks.onExpire();
              };

              window[CALLBACK_NAMES.timeout] = () => {
                if (
                  window.turnstile &&
                  typeof window.turnstile.reset === "function"
                ) {
                  window.turnstile.reset(`#${field.fieldName}`);
                }
              };
              // Render the CAPTCHA widget
              window.turnstile.render(`#${field.fieldName}`, {
                sitekey: siteKey,
                "response-field-name": field.fieldName,
                size: field.size,
                theme: field.theme,
                "error-callback": CALLBACK_NAMES.error,
                "expired-callback": CALLBACK_NAMES.expire,
                callback: CALLBACK_NAMES.verify,
                "timeout-callback": CALLBACK_NAMES.timeout,
              });
            });
          };
        } else if (window?.turnstileReady) {
          // If the script is already loaded, initialize the new field
          window.turnstileReady();
        }
      })
      .catch((error) => {
        throw new Error(`Failed to load Turnstile script: ${error}`);
      });
  }, [siteKey]);

  return null; // No need to render anything, just register the field
};

export default TurnstileExplicit;
