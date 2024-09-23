import React, { useEffect, useRef } from "react";
import loadTurnstileScript from "../utils/loadScript";

// Global registry to track used responseFieldNames
const usedResponseFieldNames = new Set();

/**
 * TurnstileImplicit component renders the Cloudflare Turnstile CAPTCHA in implicit mode.
 *
 * This component automatically loads the Turnstile script and renders the CAPTCHA based on the specified
 * theme, size, and response field name.
 *
 * @component
 * @param {string} [theme='light'] - The theme of the CAPTCHA widget. Options are 'light' or 'dark'.
 * @param {string} [size='normal'] - The size of the CAPTCHA widget. Options are 'normal' or 'compact'.
 * @param {string} [responseFieldName='cf-turnstile-response'] - The name of the hidden input field that stores the CAPTCHA response token.
 * @param {string} [onExpire=() => {}] - The callback function to execute when the CAPTCHA expires.
 * @param {string} [onError=() => {}] - The callback function to execute when an error occurs.
 * @param {string} [onSuccess=() => {}] - The callback function to execute when the CAPTCHA is successfully solved.
 * @returns {JSX.Element} The TurnstileImplicit component
 */
const TurnstileImplicit = ({
  theme = "light",
  size = "normal",
  responseFieldName = "cf-turnstile-response",
  onExpire = () => {},
  onError = () => {},
  onSuccess = () => {},
}) => {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaDivRef = useRef(null);

  useEffect(() => {
    // Check for duplicate responseFieldName
    if (usedResponseFieldNames.has(responseFieldName)) {
      throw new Error(
        `Duplicate responseFieldName "${responseFieldName}" detected. Each TurnstileImplicit component must have a unique responseFieldName.`
      );
    }

    // Register the responseFieldName
    usedResponseFieldNames.add(responseFieldName);

    // Define unique callback function names
    const CALLBACK_PREFIX = `turnstileCallbacks_${responseFieldName}`;
    const CALLBACK_NAMES = {
      verify: `${CALLBACK_PREFIX}_verify`,
      error: `${CALLBACK_PREFIX}_error`,
      expire: `${CALLBACK_PREFIX}_expire`,
      timeout: `${CALLBACK_PREFIX}_timeout`,
    };

    // Load the Turnstile script
    loadTurnstileScript(false)
      .then(() => {
        if (typeof window.turnstile !== "undefined" && window.turnstile) {
          // Define global callback functions
          window[CALLBACK_NAMES.verify] = (token) => {
            onSuccess(token);
          };
          window[CALLBACK_NAMES.error] = () => {
            onError();
          };
          window[CALLBACK_NAMES.expire] = () => {
            onExpire();
          };
          window[CALLBACK_NAMES.timeout] = () => {
            if (
              window.turnstile &&
              typeof window.turnstile.reset === "function"
            ) {
              window.turnstile.reset(`#cft-${responseFieldName}`);
            }
          };

          // **Optional:** Trigger Turnstile to scan for new elements
          // window.turnstile.execute();
        }
      })
      .catch((error) => {
        throw new Error(`Failed to load Turnstile script: ${error}`);
      });

    // Cleanup on unmount
    return () => {
      // Remove callbacks from window
      window[`${CALLBACK_PREFIX}_verify`] = null;
      window[`${CALLBACK_PREFIX}_error`] = null;
      window[`${CALLBACK_PREFIX}_expire`] = null;
      window[`${CALLBACK_PREFIX}_timeout`] = null;

      // Remove the responseFieldName from the registry
      usedResponseFieldNames.delete(responseFieldName);
    };
  }, [theme, size, responseFieldName, siteKey, onExpire, onError, onSuccess]);

  return (
    <div
      id={`cft-${responseFieldName}`}
      ref={captchaDivRef}
      className="cf-turnstile"
      data-sitekey={siteKey}
      data-theme={theme}
      data-size={size}
      data-response-field={responseFieldName}
      data-callback={`turnstileCallbacks_${responseFieldName}_verify`}
      data-error-callback={`turnstileCallbacks_${responseFieldName}_error`}
      data-expired-callback={`turnstileCallbacks_${responseFieldName}_expire`}
      data-timeout-callback={`turnstileCallbacks_${responseFieldName}_timeout`}
    ></div>
  );
};

export default TurnstileImplicit;
