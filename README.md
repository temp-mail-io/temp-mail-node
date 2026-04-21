# @temp-mail-io/sdk

Official Node.js SDK for the [temp-mail.io](https://temp-mail.io) API.

- TypeScript-first, ships with `.d.ts`
- Zero runtime dependencies — uses the built-in `fetch`
- Works on Node.js 18+, Deno, Bun, and any other fetch-capable runtime

## Install

```bash
npm install @temp-mail-io/sdk
```

## Usage

```ts
import { TempMailClient } from '@temp-mail-io/sdk'

const client = new TempMailClient('YOUR_API_KEY')

const email = await client.createEmail()
console.log(`Your temporary email: ${email.email}`)

const messages = await client.listEmailMessages(email.email)
for (const message of messages) {
  console.log(`From: ${message.from}`)
  console.log(`Subject: ${message.subject}`)
}
```

Grab an API key at <https://temp-mail.io/profile/api>.

## API

### `new TempMailClient(apiKey | options)`

```ts
new TempMailClient('YOUR_API_KEY')

new TempMailClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://api.temp-mail.io', // override for staging/testing
  timeoutMs: 30_000, // per-request timeout
  fetch: globalThis.fetch, // custom fetch implementation
  userAgent: 'my-app/1.0' // custom User-Agent header
})
```

### Methods

| Method                     | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `listDomains()`            | List available domains (public / premium / custom) |
| `createEmail(options?)`    | Create a temporary email address                   |
| `deleteEmail(email)`       | Delete a temporary email                           |
| `listEmailMessages(email)` | List messages received on an address               |
| `getMessage(id)`           | Get a single message by id                         |
| `deleteMessage(id)`        | Delete a single message                            |
| `getMessageSourceCode(id)` | Get the raw `.eml` source for a message            |
| `downloadAttachment(id)`   | Download an attachment as `Uint8Array`             |
| `getRateLimit()`           | Current rate-limit counters                        |

All methods return a promise and throw on non-2xx responses (see **Errors** below).

### Rate limits

Every successful response carries `X-Ratelimit-*` headers. The client caches
the last-seen values on `client.lastRateLimit`, so you can check remaining
quota without spending another request:

```ts
await client.listDomains()
console.log(client.lastRateLimit) // { limit, remaining, used, reset }
```

### Errors

All errors extend `TempMailError`, which carries `statusCode`, `code`,
`type`, `detail`, and `requestId` fields (the last one is the API's
`meta.request_id` for support tickets).

```ts
import {
  TempMailError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError
} from '@temp-mail-io/sdk'

try {
  await client.createEmail({ domain: 'does-not-exist.com' })
} catch (err) {
  if (err instanceof RateLimitError) {
    // back off until err.statusCode 429 resets
  } else if (err instanceof ValidationError) {
    console.error(err.detail, err.requestId)
  } else {
    throw err
  }
}
```

| Class                 | Triggered by                                      |
| --------------------- | ------------------------------------------------- |
| `AuthenticationError` | `api_key_invalid`, `api_key_empty`, 401, 403      |
| `RateLimitError`      | `rate_limited`, 429                               |
| `ValidationError`     | `validation_error`, 400, 422                      |
| `NotFoundError`       | `not_found`, 404                                  |
| `TempMailError`       | Everything else (network failures, timeouts, 5xx) |

## License

MIT
