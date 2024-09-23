# Next.js Turnstile CAPTCHA Package
![npm](https://img.shields.io/npm/v/nextjs-turnstile)
![License](https://img.shields.io/npm/l/nextjs-turnstile)
![npm](https://img.shields.io/npm/dw/nextjs-turnstile)

This package provides components and utilities to integrate Cloudflare Turnstile CAPTCHA into your Next.js applications. It supports both implicit and explicit CAPTCHA modes.

You can find the document of Cloudflare Turnstile [here](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).

## Installation

```bash
npm install nextjs-turnstile
```

## Usage

### Components
**TurnstileImplicit:**
- Note: The `onSuccess`, `onError`, and `onExpire` props are optional.

```javascript
import React from 'react';
import { TurnstileImplicit, verifyTurnstile } from 'nextjs-turnstile';

export default function MyForm() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token1 = e.target['cf-turnstile-response-1'].value;
    const token2 = e.target['cf-turnstile-response-2'].value;

    // Verify the first CAPTCHA response
    const success1 = await verifyTurnstile(token1);
    if (!success1) {
      alert('First CAPTCHA verification failed');
      return;
    }

    // Verify the second CAPTCHA response
    const success2 = await verifyTurnstile(token2);
    if (!success2) {
      alert('Second CAPTCHA verification failed');
      return;
    }
  };

  const handleSuccess = (token) => {
    console.log('Captcha success:', token);
    // Handle successful captcha verification, e.g., submit the form
  };

  const handleError = () => {
    console.error('Captcha error occurred');
    setAlerts((prev) => [
      ...prev,
      { type: 'danger', message: 'Captcha verification failed. Please try again.' },
    ]);
  };

  const handleExpire = () => {
    console.warn('Captcha expired');
    setAlerts((prev) => [
      ...prev,
      { type: 'warning', message: 'Captcha expired. Please complete it again.' },
    ]);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Turnstile Implicit CAPTCHA Example</h2>
      
      {/* First CAPTCHA */}
      <TurnstileImplicit
        theme="dark"
        size="normal"
        responseFieldName="cf-turnstile-response-1"
        onSuccess={handleSuccess}
        onError={handleError}
        onExpire={handleExpire}
      />
      
      {/* Second CAPTCHA */}
      <TurnstileImplicit
        theme="light"
        size="compact"
        responseFieldName="cf-turnstile-response-2"
        onError={handleError}
      />
      
      <button type="submit">Submit</button>
    </form>
  );
}
```

**TurnstileExplicit:**
- Note: Developers must place the divs in their HTML and pass the id of the div to the `responseFieldName` prop.
- Note: The `onSuccess`, `onError`, and `onExpire` props are optional.
```javascript
import React from 'react';
import { TurnstileExplicit, verifyTurnstile } from 'nextjs-turnstile';

export default function MyForm() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token1 = e.target['cf-turnstile-response-3'].value;
    const token2 = e.target['cf-turnstile-response-4'].value;
    
    // Verify the first CAPTCHA response
    const success1 = await verifyTurnstile(token1);
    if (!success1) {
      alert('First CAPTCHA verification failed');
      return;
    }

    // Verify the second CAPTCHA response
    const success2 = await verifyTurnstile(token2);
    if (!success2) {
      alert('Second CAPTCHA verification failed');
      return;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Turnstile Explicit CAPTCHA Example</h2>

      {/* Developers must place the divs in their HTML */}
      
      {/* First CAPTCHA */}
      <div id="cf-turnstile-response-3"></div>
      <TurnstileExplicit
        theme="dark"
        size="normal"
        responseFieldName="cf-turnstile-response-3"
        onSuccess={(token) => console.log(token)}
        onError={(error) => console.error(error)}
        onExpire={() => console.log('CAPTCHA expired')}
      />
      
      {/* Second CAPTCHA */}
      <div id="cf-turnstile-response-4"></div>
      <TurnstileExplicit
        theme="light"
        size="compact"
        responseFieldName="cf-turnstile-response-4"
      />
      
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Verification Utility
In your API routes:
ß
```javascript
import { verifyTurnstile } from 'nextjs-turnstile';

export default async function handler(req, res) {
  const { token } = req.body;

  const success = await verifyTurnstile(token);
  // Passing IP directly:
  // const success = await verifyTurnstile(token, req.connection.remoteAddress);

  if (success) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
  }
}
```

### Other Utilities
**Reset CAPTCHA:** You can reset the CAPTCHA by calling the `resetTurnstile(widgetId)` function.
`widgetId` is the query selector of the CAPTCHA widget e.g. `#cf-turnstile-response-1`.

**Check and Render CAPTCHA:** You can check if the CAPTCHA is required and render it by calling the `checkTurnstile(widgetId)` function.
`widgetId` is the query selector of the CAPTCHA widget e.g. `#cf-turnstile-response-1`.


## Environment Variables
You need to add the following environment variables to your .env.local file:

```plaintext
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
TURNSTILE_SECRET_KEY=your_secret_key_here
```

## License
This project is licensed under the MIT License - see the [License](./License) file for details.


## Author
Davod Mozafari - [Twitter](https://twitter.com/davodmozafari)
