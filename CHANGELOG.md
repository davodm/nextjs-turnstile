# Changelog

All notable changes to this project will be documented in this file.


## [1.0.5] - 2026-03-10

### Added

- **Invisible Mode Support**: Full support for Cloudflare's invisible widget type with auto-run and deferred execution patterns
- **`feedbackEnabled` prop**: Control Cloudflare's visitor feedback on widget failure (`feedback-enabled`), recommended to disable for invisible widgets
- **Dev-mode warning**: `execute()` via ref now warns in development when called before the widget is ready, helping debug invisible mode where there is no visual feedback

### Tests

- **Invisible Mode**: Added 6 new tests covering deferred execution, auto-run, `feedbackEnabled`, and token expiration/refresh flows

### Docs

- **Invisible Mode Guide**: Added comprehensive README section with three usage patterns — auto-run, deferred execution, and API endpoint protection (Troy Hunt pattern)

## [1.0.4] - 2026-02-23

### Changed

- **Server-side Verification**: Rewrote `verifyTurnstile()` to align with Cloudflare's siteverify best practices

### Added

- **`TurnstileError` class**: Thrown on verification failure with `.errorCodes` array for structured error handling
- **Token validation**: Input validation with empty check and 2048-char max length
- **Fetch timeout**: AbortController-based fetch timeout (default 10s)
- **Post-validation checks**: Optional `action` and `hostname` post-validation against the siteverify response
- **Idempotency key**: Auto-generated per request for safe retries

### Fixed

- **IP detection**: Prioritize `cf-connecting-ip` over `x-forwarded-for` for more reliable IP detection

### Tests

- **Server verification**: Expanded test suite from 9 to 19 cases covering all new verification behavior

## [1.0.3] - 2026-01-10

### Fixed

- **Widget Re-rendering**: Fixed component re-rendering when configuration props change (theme, size, etc.)
- **Configuration Changes**: Properly remove and recreate widgets when props like theme or size are updated
- **Test Configuration**: Added explicit testSequencer configuration to resolve Jest setup issues

### Changed

- **Rendering Guards**: Reordered effect guards to prioritize hasRenderedRef checks and enable proper re-rendering flow

## [1.0.2] - 2026-01-10

### Fixed

- **React Strict Mode**: Enhanced React 18+ Strict Mode compatibility with multiple guards against double widget rendering
- **Widget Persistence**: Improved cleanup logic to distinguish between Strict Mode effect re-runs and real component unmounts
- **Race Condition Protection**: Added DOM-level iframe checks to prevent rendering when widgets already exist

### Tests

- **Strict Mode Testing**: Added comprehensive test coverage for React 18+ Strict Mode double-invocation scenarios

## [1.0.1] - 2026-01-10

### Fixed

- **React Strict Mode**: Fixed "Turnstile has already been rendered in this container" error in React Strict Mode by preventing double widget rendering

## [1.0.0] - 2026-01-10

### ⚠️ Breaking Changes

This is a major version bump with breaking changes to improve stability and simplify the API.

- **Single Component**: Replaced `TurnstileImplicit` and `TurnstileExplicit` with a unified `Turnstile` component
- **Explicit Mode Only**: The component now uses explicit rendering internally for reliable React lifecycle management
- **React 18+**: Minimum React version is now 18.0.0
- **Next.js 13+**: Minimum Next.js version is now 13.0.0
- **Node 18+**: Minimum Node.js version is now 18.0.0

### Added

- **Imperative API**: New ref-based API with `reset()`, `remove()`, `getResponse()`, `execute()`, `isReady()`, and `getWidgetId()` methods
- **`flexible` size**: Added support for the `flexible` size option (100% width, min 300px)
- **`execution` prop**: Control when the challenge runs (`"render"` or `"execute"`)
- **`retry` prop**: Control retry behavior (`"auto"` or `"never"`)
- **`retryInterval` prop**: Customize retry interval in milliseconds
- **`action` prop**: Custom action identifier for analytics
- **`cData` prop**: Custom data payload returned during validation
- **`language` prop**: Control widget language
- **`onLoad` callback**: Called when widget is ready
- **`onBeforeInteractive` callback**: Called before interactive challenge
- **`onAfterInteractive` callback**: Called after interactive challenge
- **`onUnsupported` callback**: Called when browser is not supported
- **`isTokenExpired()` utility**: Check if a widget's token has expired
- **`renderTurnstile()` utility**: Low-level function for advanced use cases

### Fixed

- **Callback Stability**: Callbacks no longer cause widget re-renders (stored in refs)
- **Script Loading**: Added timeout and proper error handling for script loading
- **Error Handling**: Error callback now returns `true` as per Cloudflare docs
- **Cleanup**: Proper widget cleanup on unmount and re-render
- **React Strict Mode**: Better handling of React 18's Strict Mode double-mount

### Changed

- **Simplified Exports**: Cleaner export structure with better TypeScript types
- **Improved Docs**: Comprehensive JSDoc comments on all public APIs
- **Better Logging**: Development-only warnings for common issues

### Migration Guide

```tsx
// Before (v0.x)
import { TurnstileImplicit, TurnstileExplicit } from "nextjs-turnstile";

<TurnstileImplicit
  responseFieldName="my-token"
  onSuccess={handleSuccess}
/>

// After (v1.0.0)
import { Turnstile } from "nextjs-turnstile";

<Turnstile
  responseFieldName="my-token"
  onSuccess={handleSuccess}
/>
```

---


## [0.1.3] - 2026-01-08
- Add `appearance` support for implicit and explicit widgets
- Update README examples to document appearance modes

## [0.1.2] - 2025-01-27
- **Fix**: Resolve compatibility issue with Next.js 13+ async `headers()` function
- **Improvement**: `getClientIp()` now handles both sync (Next.js 12) and async (Next.js 13+) `headers()` calls
- **Breaking**: `getClientIp()` is now async and returns `Promise<string | undefined>`

## [0.1.1] - 2025-06-27
- Fix issue with callback invocation in implicit mode
- Fix issue with duplicate script tag in implicit mode

## [0.1.0] - 2025-06-26
- **TypeScript rewrite**: Complete migration of the codebase to TypeScript for improved type safety and maintainability
- Added comprehensive server-side tests with Jest
- Added support for React 19
- Added support for Next.js 15
- Fixed page reload on token expiry
- Supporting timeout callback for widgets

## [0.0.6] - 2024-09-23
- Improved callback handling for explicit and implicit widgets
- Utility functions for reset/get/check updated
- Implicit widget: check for duplicate responseFieldName and load script with helper
- Explicit widget: improved callback invocation
- Documentation updates regarding callbacks
- Version and build updates

## [0.0.05] - 2024-09-22
- Improved IP detection in `verifyTurnstile`
- Improved rendering checks in `resetTurnstile`
- Peer dependency fixes for React and Next.js
- Babel build added for compatibility
- Bugfix: duplicate userIP declaration in `verifyTurnstile`

## [0.0.4] - 2024-09-11
- Initial release: Next.js Cloudflare Turnstile integration
- Supports implicit and explicit widget modes
- SSR-safe utility functions
- Server-side verification helper
- `resetTurnstile()` utility added
- `onError`, `onExpire`, `onSuccess` attributes for widgets

---

> For a full commit history, see the [GitHub repository](https://github.com/davodm/nextjs-turnstile/commits/main). 
