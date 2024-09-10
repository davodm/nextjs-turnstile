import React, { useEffect } from 'react';

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
  const JSUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=turnstileReady";

  useEffect(() => {
    // Register the field for later initialization
    // Check if the field is already registered
    if (explicitFields.some((field) => field.fieldName === responseFieldName)) {
      return;
    }
    explicitFields.push({
      fieldName: responseFieldName,
      size,
      theme,
    });

    return () => {
      // Cleanup: Remove the field if the component unmounts
      explicitFields = explicitFields.filter(
        (field) => field.fieldName !== responseFieldName
      );
    };
  }, [responseFieldName, size, theme]);

  useEffect(() => {
    // Ensure the Turnstile script is loaded only once
    if (!document.querySelector('script[src="' + JSUrl + '"]')) {
      const script = document.createElement("script");
      script.src = JSUrl;
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        window.turnstileReady = function () {
          explicitFields.forEach(function (field) {
            window.turnstile.render(`#${field.fieldName}`, {
              sitekey: siteKey,
              "response-field-name": field.fieldName,
              size: field.size,
              theme: field.theme,
              "error-callback": onError || (() => {}),
              "expired-callback": onExpire || (() => {}),
              callback: onSuccess || (() => {}),
              "timeout-callback": () => window.turnstile.reset(`#${field.fieldName}`),
            });
          });
        };
      };
    }
  }, []);

  return null; // No need to render anything, just register the field
};

export default TurnstileExplicit;
