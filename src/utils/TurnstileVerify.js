import { headers } from "next/headers";

/**
 * Verifies the Cloudflare Turnstile CAPTCHA response token with the Turnstile API.
 *
 * @async
 * @function verifyTurnstile
 * @param {string} token - The CAPTCHA response token provided by the client-side Turnstile widget.
 * @param {string} [ipAddress] - The IP address of the user. If not provided, the function will attempt to extract it from the request headers.
 * @returns {Promise<boolean>} - Returns `true` if the CAPTCHA verification was successful, otherwise `false`.
 *
 * @throws {Error} If the request to the Turnstile API fails or if the CAPTCHA verification fails, an error is thrown with a descriptive message.
 */
export const verifyTurnstile = async (token, ipAddress=undefined) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  try {
    const response = await fetch(
      `https://challenges.cloudflare.com/turnstile/v0/siteverify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          remoteip: ipAddress || getIP(),
        }),
      }
    );

    // Check for a successful response
    if (!response.ok) {
      throw new Error(
        `Verification request failed with status ${response.status}`
      );
    }

    const data = await response.json();

    // Check if the success field is true
    if (!data.success) {
      throw new Error(
        `Verification failed: ${
          data["error-codes"] ? data["error-codes"].join(", ") : "Unknown error"
        }`
      );
    }

    return true;
  } catch (error) {
    console.error("Error verifying Turnstile CAPTCHA:", error.message);
    return false;
  }
};


/**
 * Get the user's IP address from the request headers
 * @returns {string} The user's IP address
 */
function getIP() {
  const FALLBACK_IP_ADDRESS = "0.0.0.0";
  const forwardedFor = headers().get("x-forwarded-for");
  const CF = headers().get("cf-connecting-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0] ?? FALLBACK_IP_ADDRESS;
  }

  if (CF) {
    return CF;
  }

  return headers().get("x-real-ip") ?? FALLBACK_IP_ADDRESS;
}