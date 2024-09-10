import React, { useEffect } from "react";

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
  const JSUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js";

  useEffect(() => {
    // Load the Turnstile script only once
    if (!document.querySelector('script[src="' + JSUrl + '"]')) {
      const script = document.createElement("script");
      script.src = JSUrl;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      <div
        id={`cft-${responseFieldName}`}
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme={theme}
        data-size={size}
        data-response-field={responseFieldName}
        data-expired-callback={() => onExpire()} // Invoking functions passed as props
        data-error-callback={() => onError()}
        data-callback={() => onSuccess()}
        data-timeout-callback={() => turnstile && turnstile.reset(`#cft-${responseFieldName}`)} // Automatically reset the captcha on timeout
      ></div>
    </>
  );
};

export default TurnstileImplicit;
