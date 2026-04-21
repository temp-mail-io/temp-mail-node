import { describe, expect, it } from 'vitest'
import {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  TempMailClient,
  TempMailError,
  ValidationError
} from '../src/index.js'
import { mockFetch, RATE_LIMIT_HEADERS } from './helpers.js'

function clientFor(fetchImpl: typeof fetch) {
  return new TempMailClient({
    apiKey: 'test-key',
    fetch: fetchImpl,
    baseUrl: 'https://api.temp-mail.io'
  })
}

describe('TempMailClient construction', () => {
  it('throws when no api key is provided', () => {
    expect(() => new TempMailClient({ apiKey: '' })).toThrow(TempMailError)
  })

  it('accepts a bare string as shorthand for apiKey', () => {
    const { fetch } = mockFetch(async () => ({ json: { domains: [] } }))
    expect(() => new TempMailClient({ apiKey: 'k', fetch })).not.toThrow()
  })

  it('trims trailing slashes from baseUrl', async () => {
    const { fetch, calls } = mockFetch(async () => ({ json: { domains: [] } }))
    const client = new TempMailClient({
      apiKey: 'k',
      fetch,
      baseUrl: 'https://api.temp-mail.io/'
    })
    await client.listDomains()
    expect(calls[0]!.url).toBe('https://api.temp-mail.io/v1/domains')
  })
})

describe('headers', () => {
  it('sends X-API-Key and User-Agent on every request', async () => {
    const { fetch, calls } = mockFetch(async () => ({ json: { domains: [] } }))
    const client = clientFor(fetch)
    await client.listDomains()
    expect(calls[0]!.headers['x-api-key']).toBe('test-key')
    expect(calls[0]!.headers['user-agent']).toMatch(/^temp-mail-node\//)
  })

  it('honors a custom user-agent', async () => {
    const { fetch, calls } = mockFetch(async () => ({ json: { domains: [] } }))
    const client = new TempMailClient({
      apiKey: 'k',
      fetch,
      userAgent: 'my-app/2.3'
    })
    await client.listDomains()
    expect(calls[0]!.headers['user-agent']).toBe('my-app/2.3')
  })
})

describe('listDomains', () => {
  it('returns the domains array', async () => {
    const { fetch, calls } = mockFetch(async () => ({
      json: {
        domains: [
          { name: 'example.com', type: 'public' },
          { name: 'custom.test', type: 'custom' }
        ]
      }
    }))
    const result = await clientFor(fetch).listDomains()
    expect(calls[0]!.method).toBe('GET')
    expect(calls[0]!.url).toBe('https://api.temp-mail.io/v1/domains')
    expect(result).toHaveLength(2)
    expect(result[0]!.type).toBe('public')
  })
})

describe('createEmail', () => {
  it('POSTs to /v1/emails with options', async () => {
    const { fetch, calls } = mockFetch(async () => ({
      json: { email: 'foo@bar.com', ttl: 3600 }
    }))
    const result = await clientFor(fetch).createEmail({
      domain: 'bar.com',
      domainType: 'public'
    })
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.headers['content-type']).toBe('application/json')
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      domain: 'bar.com',
      domain_type: 'public'
    })
    expect(result).toEqual({ email: 'foo@bar.com', ttl: 3600 })
  })

  it('sends empty body when called with no options', async () => {
    const { fetch, calls } = mockFetch(async () => ({
      json: { email: 'x@y.com', ttl: 600 }
    }))
    await clientFor(fetch).createEmail()
    expect(JSON.parse(calls[0]!.body!)).toEqual({})
  })
})

describe('deleteEmail', () => {
  it('DELETEs the url-encoded email', async () => {
    const { fetch, calls } = mockFetch(async () => ({ status: 200 }))
    await clientFor(fetch).deleteEmail('user+tag@bar.com')
    expect(calls[0]!.method).toBe('DELETE')
    expect(calls[0]!.url).toBe(
      'https://api.temp-mail.io/v1/emails/user%2Btag%40bar.com'
    )
  })
})

describe('listEmailMessages', () => {
  const sample = [
    {
      id: 'a',
      from: 'x@y.com',
      to: 'me@here.com',
      cc: null,
      subject: 'hi',
      body_text: 'hi',
      body_html: '<p>hi</p>',
      created_at: '2024-01-01T00:00:00Z',
      attachments: null
    }
  ]

  it('handles the {messages: []} envelope', async () => {
    const { fetch } = mockFetch(async () => ({ json: { messages: sample } }))
    const result = await clientFor(fetch).listEmailMessages('me@here.com')
    expect(result).toHaveLength(1)
    expect(result[0]!.bodyText).toBe('hi')
    expect(result[0]!.cc).toEqual([])
    expect(result[0]!.attachments).toEqual([])
  })

  it('handles a bare array response', async () => {
    const { fetch } = mockFetch(async () => ({ json: sample }))
    const result = await clientFor(fetch).listEmailMessages('me@here.com')
    expect(result).toHaveLength(1)
  })

  it('returns empty array when the server returns {messages: null}', async () => {
    const { fetch } = mockFetch(async () => ({ json: { messages: null } }))
    const result = await clientFor(fetch).listEmailMessages('me@here.com')
    expect(result).toEqual([])
  })
})

describe('getMessage', () => {
  it('camelCases the payload', async () => {
    const { fetch } = mockFetch(async () => ({
      json: {
        id: 'm1',
        from: 'a@b.com',
        to: 'c@d.com',
        cc: ['e@f.com'],
        subject: 's',
        body_text: 't',
        body_html: '<p>t</p>',
        created_at: '2024-01-01T00:00:00Z',
        attachments: [{ id: '1', name: 'x.pdf', size: 10 }]
      }
    }))
    const msg = await clientFor(fetch).getMessage('m1')
    expect(msg.bodyHtml).toBe('<p>t</p>')
    expect(msg.createdAt).toBe('2024-01-01T00:00:00Z')
    expect(msg.cc).toEqual(['e@f.com'])
    expect(msg.attachments[0]!.name).toBe('x.pdf')
  })
})

describe('getMessageSourceCode', () => {
  it('unwraps the {data: string} envelope', async () => {
    const { fetch } = mockFetch(async () => ({
      json: { data: 'From: x@y\r\n\r\nhi' }
    }))
    const src = await clientFor(fetch).getMessageSourceCode('abc')
    expect(src).toBe('From: x@y\r\n\r\nhi')
  })
})

describe('downloadAttachment', () => {
  it('returns a Uint8Array of the body', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5])
    const { fetch, calls } = mockFetch(async () => ({ bytes: payload }))
    const bytes = await clientFor(fetch).downloadAttachment('att-1')
    expect(calls[0]!.headers['accept']).toBe('application/octet-stream')
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('getRateLimit', () => {
  it('reads from the json body', async () => {
    const { fetch } = mockFetch(async () => ({
      json: { limit: 100, remaining: 99, used: 1, reset: 1700000000 }
    }))
    const rl = await clientFor(fetch).getRateLimit()
    expect(rl.limit).toBe(100)
    expect(rl.remaining).toBe(99)
  })
})

describe('lastRateLimit', () => {
  it('is populated from response headers on success', async () => {
    const { fetch } = mockFetch(async () => ({
      json: { domains: [] },
      headers: RATE_LIMIT_HEADERS
    }))
    const client = clientFor(fetch)
    expect(client.lastRateLimit).toBeUndefined()
    await client.listDomains()
    expect(client.lastRateLimit).toEqual({
      limit: 100,
      remaining: 99,
      used: 1,
      reset: 1700000000
    })
  })

  it('stays undefined when headers are not present', async () => {
    const { fetch } = mockFetch(async () => ({ json: { domains: [] } }))
    const client = clientFor(fetch)
    await client.listDomains()
    expect(client.lastRateLimit).toBeUndefined()
  })
})

describe('error mapping', () => {
  it('maps api_key_invalid to AuthenticationError', async () => {
    const { fetch } = mockFetch(async () => ({
      status: 401,
      json: {
        error: {
          type: 'request_error',
          code: 'api_key_invalid',
          detail: 'bad key'
        },
        meta: { request_id: 'req-1' }
      }
    }))
    await expect(clientFor(fetch).listDomains()).rejects.toMatchObject({
      name: 'AuthenticationError',
      code: 'api_key_invalid',
      statusCode: 401,
      requestId: 'req-1'
    })
  })

  it('maps rate_limited to RateLimitError', async () => {
    const { fetch } = mockFetch(async () => ({
      status: 429,
      json: {
        error: {
          type: 'request_error',
          code: 'rate_limited',
          detail: 'slow down'
        }
      }
    }))
    await expect(clientFor(fetch).listDomains()).rejects.toBeInstanceOf(
      RateLimitError
    )
  })

  it('maps validation_error to ValidationError', async () => {
    const { fetch } = mockFetch(async () => ({
      status: 400,
      json: {
        error: {
          type: 'request_error',
          code: 'validation_error',
          detail: 'nope'
        }
      }
    }))
    await expect(
      clientFor(fetch).createEmail({ email: '' })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('maps not_found to NotFoundError', async () => {
    const { fetch } = mockFetch(async () => ({
      status: 404,
      json: {
        error: {
          type: 'request_error',
          code: 'not_found',
          detail: 'gone'
        }
      }
    }))
    await expect(clientFor(fetch).getMessage('x')).rejects.toBeInstanceOf(
      NotFoundError
    )
  })

  it('falls back to TempMailError for unknown 5xx', async () => {
    const { fetch } = mockFetch(async () => ({
      status: 500,
      text: 'not-json'
    }))
    await expect(clientFor(fetch).listDomains()).rejects.toBeInstanceOf(
      TempMailError
    )
  })

  it('infers AuthenticationError from status when envelope is empty', async () => {
    const { fetch } = mockFetch(async () => ({ status: 401, text: '' }))
    await expect(clientFor(fetch).listDomains()).rejects.toBeInstanceOf(
      AuthenticationError
    )
  })
})

describe('timeouts', () => {
  it('aborts and wraps as TempMailError when the request hangs', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    const client = new TempMailClient({
      apiKey: 'k',
      fetch: fetchImpl,
      timeoutMs: 25
    })
    await expect(client.listDomains()).rejects.toThrow(/timed out/)
  })
})
