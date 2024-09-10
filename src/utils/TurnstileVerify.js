/**
 * Verifies the Cloudflare Turnstile CAPTCHA response token with the Turnstile API.
 *
 * @async
 * @function verifyTurnstile
 * @param {string} token - The CAPTCHA response token provided by the client-side Turnstile widget.
 * @param {string} [userIP] - The IP address of the user. If not provided, the function will attempt to extract it from the request headers.
 * @param {Object} [req] - The request object (optional). If provided, it is used to extract the user's IP address from headers like 'cf-connecting-ip' or 'x-forwarded-for'.
 * @returns {Promise<boolean>} - Returns `true` if the CAPTCHA verification was successful, otherwise `false`.
 *
 * @throws {Error} If the request to the Turnstile API fails or if the CAPTCHA verification fails, an error is thrown with a descriptive message.
 */
export const verifyTurnstile = async (token, userIP, req = undefined) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Fetch the user's IP address if not provided
  let userIP = ipAddress;
  if (!userIP && req?.headers) {
    userIP =
      req.headers["cf-connecting-ip"] ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress;
  }

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
          remoteip: userIP,
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
