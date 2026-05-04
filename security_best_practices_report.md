# Security Best Practices Report

Date: 2026-05-03

## Executive Summary

The World Asset Prices app has a solid security baseline for a public, no-login dashboard. The audit found no critical issues, no raw HTML/XSS sinks, no client-bundled secrets, and no production dependency advisories from `npm audit --omit=dev`.

The main hardening opportunities were around trust boundaries for client IP based rate limiting, client error telemetry redaction, CSP tightening, and documenting the HSTS preload decision. The rate-limit and telemetry issues were fixed after this report was drafted.

## Remediation Update

Implemented after the initial review:

- Centralized client-key derivation in `server/client-key.ts` and stopped trusting forwarding headers outside Vercel-evidenced requests.
- Added route tests proving spoofed forwarding headers do not bypass local/non-Vercel rate limits.
- Added server-side telemetry URL redaction in `api/client-error.ts` so username, password, query strings, and fragments are stripped before logs.
- Added a route test proving token-like URL query and fragment values are not logged.

## Scope

Reviewed stack:

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Backend/API: Vercel serverless TypeScript handlers plus shared Node server modules
- Data flow: public market-data dashboard, logo proxy, client error telemetry, optional Upstash/Vercel KV durable cache

Security guidance used:

- JavaScript/TypeScript general frontend security
- React web frontend security
- Express/Node server security as the nearest local reference for Node request handling; this repo does not use Express

Validation:

- `npm audit --omit=dev`: found 0 production dependency vulnerabilities
- Static search for raw HTML sinks, dynamic code execution, URL/navigation sinks, browser storage, headers, env/secrets, and outbound fetches

## Positive Findings

- No `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`, `new Function`, or string-to-code timers were found in production code.
- `vercel.json` sets a CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a limited `Permissions-Policy` at lines 11-38.
- The logo proxy only accepts HTTPS logo URLs from an allowlist and rejects private/local hosts in `server/security.ts:82-102`.
- The logo proxy enforces rate limits, request timeouts, response content-type allowlisting, response size limits, and `nosniff` in `api/logo.ts:120-184`.
- Browser storage is limited to UI preferences and pinned markets in `src/App.tsx:80-118`; no tokens or secrets are stored there.
- Frontend build-time env usage in `src/api.ts:5-11` does not expose secrets; server-only secrets stay under `process.env`.

## Critical Findings

None found.

## High Findings

None found.

## Medium Findings

### S1. Rate limiting trusts `X-Forwarded-For` when `X-Real-IP` is absent

Status: fixed

Rule ID: NODE-PROXY-001

Location:

- Original issue: `api/logo.ts` and `api/client-error.ts` route-local `getClientKey` helpers.
- Fix: `server/client-key.ts:34-50`, plus route tests in `api/logo.test.ts` and `api/client-error.test.ts`.

Evidence:

```ts
const forwarded = getHeader(request, "x-forwarded-for");
if (forwarded) {
  const parts = forwarded.split(",");
  const last = parts[parts.length - 1]?.trim();
  if (last && IP_PATTERN.test(last)) {
    return last;
  }
}
```

Impact:

If the app is ever run behind a platform that does not overwrite `X-Forwarded-For`, an attacker could spoof that header and rotate apparent client keys to bypass the logo proxy and client-error endpoint rate limits.

Fix implemented:

The routes now use `server/client-key.ts`. Forwarding headers are trusted only when `process.env.VERCEL === "1"` or `x-vercel-id` is present; otherwise the socket IP is used. This preserves Vercel behavior while avoiding silent spoofable header trust in local/non-Vercel deployments.

Mitigation:

Document the deployment assumption if Vercel always provides a trusted `x-real-ip` for these functions, and add tests for the non-Vercel fallback behavior.

False positive notes:

This may be low risk on Vercel if `x-real-ip` is guaranteed and client-supplied `x-real-ip` cannot override the platform value. The code should still avoid making `X-Forwarded-For` a silent fallback outside that assumption.

### S2. Client error telemetry can log full URLs and raw stack text from unauthenticated clients

Status: fixed for URL redaction; stack text remains length-limited.

Rule ID: LOG-PII-001

Location:

- `src/main.tsx:20-43`
- `src/components/ErrorBoundary.tsx:24-32`
- `api/client-error.ts:71-96`
- `api/client-error.ts:157-162`

Evidence:

```ts
url: window.location.href,
userAgent: window.navigator.userAgent,
```

```ts
const stack = toTrimmedString(payload.stack, 6_000);
const url = toTrimmedString(payload.url, 2_000);
```

```ts
logEvent("warn", "api.client-error.received", {
  requestId,
  clientKey,
  payload: normalized,
});
```

Impact:

Full URLs can contain query strings or fragments with sensitive values from future features, marketing campaigns, or upstream redirects. Raw stack/message fields are also attacker-controlled through the public telemetry endpoint, so logs can accumulate noisy or sensitive client-supplied data even with size limits and rate limiting.

Fix implemented:

The server now strips URL username, password, query string, and fragment before logging telemetry. This protects the route even if a future client sends a full URL. Stack text remains length-limited; consider stack hashing or first-party-frame extraction in a future observability pass if logs become noisy.

Mitigation:

Keep the existing content-length limits and rate limits, but add a server-side redaction step so telemetry remains safe if a future client accidentally sends sensitive URL data.

False positive notes:

The current dashboard has no authentication or token-bearing routes, so this is a forward-looking hardening issue rather than evidence of a current secret leak.

## Low Findings

### S3. CSP allows broad image sources and inline styles

Rule ID: CSP-HARDEN-001

Location:

- `vercel.json:36-37`

Evidence:

```json
"Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; connect-src 'self' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; font-src 'self' https://fonts.gstatic.com data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
```

Impact:

This is not a direct vulnerability because `script-src` remains restricted and React escapes rendered text by default. However, `img-src https:` permits any HTTPS image origin, and `style-src 'unsafe-inline'` weakens CSP's ability to constrain style injection.

Fix:

If production image rendering is always routed through `/api/logo`, tighten `img-src` to `'self' data:` plus any exact origins still needed. Keep `unsafe-inline` only if required by React/framer inline styles or current CSS delivery, and document why.

Mitigation:

Leave `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'` in place. Consider a staged CSP report-only deployment before tightening image/style directives.

False positive notes:

The broad image source may be intentional for logo resilience. The report recommends tightening only after confirming the runtime image paths.

### S4. HSTS preload setting should be explicitly confirmed

Rule ID: HSTS-OPS-001

Location:

- `vercel.json:31-33`

Evidence:

```json
{
  "key": "Strict-Transport-Security",
  "value": "max-age=63072000; includeSubDomains; preload"
}
```

Impact:

This is an operational safety issue, not a vulnerability. HSTS preload is sticky and can affect every subdomain if the domain is submitted to preload lists. A mistaken preload configuration can cause long-lived access problems for subdomains that are not HTTPS-ready.

Fix:

Confirm the deployed domain and all subdomains are intended to be HTTPS-only before keeping `includeSubDomains; preload`. If this is not deliberate, remove `preload` and possibly `includeSubDomains`, then manage HSTS at the domain/edge layer with an explicit rollout plan.

Mitigation:

Document the HSTS decision in `SECURITY.md` or deployment docs so future maintainers do not change it casually.

False positive notes:

If this app only serves a domain whose subdomains are fully under control and HTTPS-ready, the setting can be acceptable.

## Informational Notes

- The logo proxy has good SSRF controls for configured hostnames, but DNS-level private IP enforcement after resolution is not visible. This is acceptable for the current strict allowlist, but custom `LOGO_ALLOWED_HOSTS` should only include trusted domains.
- No CSRF finding was raised because the app does not use cookie-authenticated state-changing user actions. The public `client-error` endpoint is state-changing only for telemetry and already has schema, size, and rate-limit controls.
- `npm audit --omit=dev` required network access; after allowing the audit request, it reported 0 production vulnerabilities.

## Recommended Fix Order

1. Review S3 during the next deployment hardening pass.
2. Confirm and document S4 before relying on HSTS preload long term.
3. Consider stack hashing or first-party stack-frame extraction if client telemetry volume grows.
