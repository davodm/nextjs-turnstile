# Next.js Turnstile

[![npm version](https://img.shields.io/npm/v/nextjs-turnstile)](https://www.npmjs.com/package/nextjs-turnstile)
[![License](https://img.shields.io/npm/l/nextjs-turnstile)](./LICENSE)
[![npm downloads](https://img.shields.io/npm/dw/nextjs-turnstile)](https://www.npmjs.com/package/nextjs-turnstile)

A simple, stable, and fully-typed [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) CAPTCHA integration for Next.js applications.

## Features

- ✅ **Simple API** - Single `<Turnstile>` component with sensible defaults
- ✅ **Fully Typed** - Complete TypeScript support with JSDoc comments
- ✅ **Stable** - Uses explicit rendering mode for reliable React lifecycle management
- ✅ **Imperative API** - Control the widget programmatically via ref
- ✅ **SSR Safe** - Works with Next.js App Router and Pages Router
- ✅ **Server Verification** - Built-in token verification utility

## Installation

```bash
npm install nextjs-turnstile
```

## Exports

This package ships separate entrypoints for client and server usage.

```ts
// Client components + utilities
import { Turnstile, type TurnstileRef } from "nextjs-turnstile/client";

// Server verification + helpers
import { verifyTurnstile } from "nextjs-turnstile/server";
```

## Quick Start

### 1. Set up environment variables

```env
# .env.local
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
TURNSTILE_SECRET_KEY=your_secret_key_here
```

Get your keys from the [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile).

### 2. Add the widget to your form

```tsx
"use client";

import { Turnstile } from "nextjs-turnstile/client";
import { useState } from "react";

export default function ContactForm() {
  const [token, setToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      alert("Please complete the CAPTCHA");
      return;
    }

    // Send token to your API for verification
    const response = await fetch("/api/contact", {
      method: "POST",
      body: JSON.stringify({ token, /* ...form data */ }),
    });
    
    // Handle response...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields */}
      
      <Turnstile
        onSuccess={setToken}
        onError={() => console.error("Turnstile error")}
        onExpire={() => setToken(null)}
      />
      
      <button type="submit" disabled={!token}>
        Submit
      </button>
    </form>
  );
}
```

### 3. Verify the token on your server

```ts
// app/api/contact/route.ts (App Router)
import { verifyTurnstile } from "nextjs-turnstile/server";

export async function POST(request: Request) {
  const { token } = await request.json();

  const isValid = await verifyTurnstile(token);
  
  if (!isValid) {
    return Response.json(
      { error: "CAPTCHA verification failed" },
      { status: 400 }
    );
  }

  // Token is valid, continue with your logic...
  return Response.json({ success: true });
}
```

## Component Props

```tsx
<Turnstile
  // Site key (falls back to NEXT_PUBLIC_TURNSTILE_SITE_KEY env var)
  siteKey="your-site-key"
  
  // Appearance
  theme="auto"        // "auto" | "light" | "dark"
  size="normal"       // "normal" | "compact" | "flexible"
  appearance="always" // "always" | "execute" | "interaction-only"
  
  // Behavior
  execution="render"       // "render" | "execute"
  refreshExpired="auto"    // "auto" | "manual" | "never"
  refreshTimeout="auto"    // "auto" | "manual" | "never"
  retry="auto"             // "auto" | "never"
  retryInterval={8000}     // Retry interval in ms
  
  // Form integration
  responseFieldName="cf-turnstile-response"  // Name for hidden input, or false to disable
  
  // Analytics
  action="login"           // Custom action identifier (max 32 chars)
  cData="user-123"         // Custom data payload (max 255 chars)
  
  // Accessibility
  tabIndex={0}
  language="auto"          // ISO 639-1 code or "auto"
  
  // Styling
  className="my-turnstile"
  style={{ marginTop: 16 }}
  
  // Callbacks
  onSuccess={(token) => {}}  // Called with verification token
  onError={(code) => {}}     // Called on error
  onExpire={() => {}}        // Called when token expires (~5 min)
  onTimeout={() => {}}       // Called on interactive timeout
  onLoad={() => {}}          // Called when widget is ready
  onBeforeInteractive={() => {}}  // Called before interactive challenge
  onAfterInteractive={() => {}}   // Called after interactive challenge
  onUnsupported={() => {}}        // Called if browser not supported
/>
```

## Imperative API (Ref)

Use a ref to control the widget programmatically:

```tsx
import { Turnstile, type TurnstileRef } from "nextjs-turnstile/client";
import { useRef } from "react";

function MyForm() {
  const turnstileRef = useRef<TurnstileRef>(null);

  const handleReset = () => {
    turnstileRef.current?.reset();
  };

  const handleSubmit = async () => {
    const token = turnstileRef.current?.getResponse();
    
    if (!token) {
      alert("Please complete the CAPTCHA");
      return;
    }

    // Submit form...
  };

  return (
    <form>
      <Turnstile ref={turnstileRef} onSuccess={console.log} />
      
      <button type="button" onClick={handleReset}>
        Reset CAPTCHA
      </button>
      <button type="button" onClick={handleSubmit}>
        Submit
      </button>
    </form>
  );
}
```

### Ref Methods

| Method | Description |
|--------|-------------|
| `reset()` | Reset the widget for a new challenge |
| `remove()` | Remove the widget from the page |
| `getResponse()` | Get the current token (or `null`) |
| `execute()` | Start the challenge (when `execution="execute"`) |
| `isReady()` | Check if the widget is ready |
| `getWidgetId()` | Get the internal Cloudflare widget ID |

## Server-Side Verification

### `verifyTurnstile(token, options?)`

Verifies a Turnstile token with Cloudflare's API.

```ts
import { verifyTurnstile, isSuccessfulVerifyResponse } from "nextjs-turnstile/server";

// Basic usage (uses TURNSTILE_SECRET_KEY env var)
const isValid = await verifyTurnstile(token);

// With options
const isValid = await verifyTurnstile(token, {
  secretKey: "custom-secret-key",  // Override secret key
  ip: "1.2.3.4",                   // User's IP (auto-detected if not provided)
  headers: request.headers,         // For IP detection in Pages Router
  action: "login",                 // Expected action
  hostname: "example.com",         // Expected hostname
  timeout: 3000,                    // Abort after 3s
  idempotencyKey: "uuid-v4",        // Retry protection
  maxTokenAge: 300,                 // Max age in seconds
});

// Full response (for advanced handling)
const response = await verifyTurnstile(token, { returnFullResponse: true });
if (isSuccessfulVerifyResponse(response)) {
  console.log("Verified at:", response.challenge_ts);
}
```

**Parameters:**
- `token` (string): The token from the Turnstile widget
- `options` (object, optional):
  - `secretKey`: Override the default secret key
  - `ip`: User's IP address (auto-detected from headers)
  - `headers`: Request headers for IP detection
  - `action`: Expected action string for validation
  - `hostname`: Expected hostname for validation
  - `timeout`: Abort validation after timeout in milliseconds
  - `idempotencyKey`: UUID used for retry protection
  - `maxTokenAge`: Maximum token age in seconds
  - `returnFullResponse`: Return the full response instead of boolean

**Returns:** `Promise<boolean | SuccessfulVerifyResponse | FailedVerifyResponse>`

## Utility Functions

These client-side utilities are SSR-safe and can be imported anywhere:

```ts
import {
  // Script loading
  loadTurnstileScript,
  isTurnstileLoaded,

  // Widget control
  resetTurnstile,
  removeTurnstile,
  getTurnstileResponse,
  executeTurnstile,
  isTokenExpired,
  renderTurnstile,
} from "nextjs-turnstile/client";
```

| Function | Description |
|----------|-------------|
| `loadTurnstileScript()` | Load the Turnstile script (returns Promise) |
| `isTurnstileLoaded()` | Check if script is loaded |
| `resetTurnstile(widgetRef?)` | Reset a widget |
| `removeTurnstile(widgetRef)` | Remove a widget from the page |
| `getTurnstileResponse(widgetRef)` | Get token from a widget |
| `executeTurnstile(widgetRef)` | Execute challenge on a widget |
| `isTokenExpired(widgetRef)` | Check if token is expired |
| `renderTurnstile(container, options)` | Render a widget (low-level API) |

## Size Options

| Size | Dimensions | Use Case |
|------|------------|----------|
| `normal` | 300×65px | Standard forms |
| `compact` | 150×140px | Space-constrained layouts |
| `flexible` | 100% width (min 300px), 65px | Responsive designs |

## Examples

### Deferred Execution

Only run the challenge when the user clicks submit:

```tsx
function DeferredForm() {
  const turnstileRef = useRef<TurnstileRef>(null);
  const [token, setToken] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Start the challenge
    turnstileRef.current?.execute();
    
    // Wait for token via onSuccess callback
    // The form will submit once token is set
  };

  useEffect(() => {
    if (token) {
      // Token received, submit the form
      submitForm(token);
    }
  }, [token]);

  return (
    <form>
      <Turnstile
        ref={turnstileRef}
        execution="execute"
        appearance="interaction-only"
        onSuccess={setToken}
      />
      <button type="button" onClick={handleSubmit}>
        Submit
      </button>
    </form>
  );
}
```

### With React Hook Form

```tsx
import { useForm } from "react-hook-form";
import { Turnstile } from "nextjs-turnstile/client";

function HookFormExample() {
  const { register, handleSubmit, setValue, formState } = useForm();

  const onSubmit = async (data) => {
    const response = await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Handle response...
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      
      <Turnstile
        onSuccess={(token) => setValue("turnstileToken", token)}
        onExpire={() => setValue("turnstileToken", "")}
      />
      <input type="hidden" {...register("turnstileToken", { required: true })} />
      
      <button type="submit" disabled={!formState.isValid}>
        Submit
      </button>
    </form>
  );
}
```

### Multiple Widgets

Each widget needs a unique key when using multiple on the same page:

```tsx
function MultipleWidgets() {
  return (
    <div>
      <Turnstile
        key="widget-1"
        responseFieldName="captcha-1"
        onSuccess={(token) => console.log("Widget 1:", token)}
      />
      <Turnstile
        key="widget-2"
        responseFieldName="captcha-2"
        onSuccess={(token) => console.log("Widget 2:", token)}
      />
    </div>
  );
}
```

## Migration from v0.x

Version 1.0.0 is a breaking change with a simplified API:

```tsx
// Before (v0.x)
import { TurnstileImplicit, TurnstileExplicit } from "nextjs-turnstile";

<TurnstileImplicit
  responseFieldName="my-token"
  onSuccess={handleSuccess}
/>

// After (v1.0.0)
import { Turnstile } from "nextjs-turnstile/client";

<Turnstile
  responseFieldName="my-token"
  onSuccess={handleSuccess}
/>
```

**Key changes:**
- Single `Turnstile` component replaces both `TurnstileImplicit` and `TurnstileExplicit`
- Uses explicit rendering internally for better React compatibility
- Added imperative API via ref
- Added new props: `execution`, `retry`, `retryInterval`, `action`, `cData`, `onLoad`, etc.
- Requires React 18+ and Next.js 13+

## Troubleshooting

### Widget not appearing

1. Check that your site key is correct
2. Ensure you're running on `http://` or `https://` (not `file://`)
3. Check the browser console for errors

### Token verification fails

1. Verify your secret key is correct
2. Tokens expire after 5 minutes - ensure quick submission
3. Each token can only be verified once

### Widget resets unexpectedly

This usually happens when React re-renders the component. Ensure:
1. The `siteKey` prop is stable (not recreated each render)
2. Parent components don't unmount/remount the Turnstile component
3. Use `key` prop if you need to force a reset

## Resources

- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [Widget Configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)
- [Error Codes](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/)
- [GitHub Repository](https://github.com/davodm/nextjs-turnstile)

## License

MIT © [Davod Mozafari](https://twitter.com/davodmozafari)
