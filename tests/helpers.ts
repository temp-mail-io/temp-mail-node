import { vi } from 'vitest'

export interface MockCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

export interface MockResponseInit {
  status?: number
  headers?: Record<string, string>
  json?: unknown
  text?: string
  bytes?: Uint8Array
}

type HeadersLike = Headers | Record<string, string> | Array<[string, string]>

function collectHeaders(raw: HeadersLike | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out
  if (raw instanceof Headers) {
    raw.forEach((v, k) => {
      out[k.toLowerCase()] = v
    })
    return out
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const k = entry[0]
      const v = entry[1]
      if (k !== undefined && v !== undefined) {
        out[k.toLowerCase()] = v
      }
    }
    return out
  }
  for (const [k, v] of Object.entries(raw)) {
    out[k.toLowerCase()] = v as string
  }
  return out
}

export function mockFetch(
  handler: (request: MockCall) => MockResponseInit | Promise<MockResponseInit>
) {
  const calls: MockCall[] = []
  const fn = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      const headers = collectHeaders(init?.headers as HeadersLike | undefined)
      const body = typeof init?.body === 'string' ? init.body : undefined
      const call: MockCall = { url, method, headers, body }
      calls.push(call)

      const spec = await handler(call)
      const responseHeaders = new Headers(spec.headers ?? {})
      if (spec.json !== undefined) {
        responseHeaders.set('content-type', 'application/json')
        return new Response(JSON.stringify(spec.json), {
          status: spec.status ?? 200,
          headers: responseHeaders
        })
      }
      if (spec.bytes !== undefined) {
        responseHeaders.set(
          'content-type',
          responseHeaders.get('content-type') ?? 'application/octet-stream'
        )
        return new Response(spec.bytes, {
          status: spec.status ?? 200,
          headers: responseHeaders
        })
      }
      return new Response(spec.text ?? '', {
        status: spec.status ?? 200,
        headers: responseHeaders
      })
    }
  )

  return { fetch: fn as unknown as typeof fetch, calls }
}

export const RATE_LIMIT_HEADERS: Record<string, string> = {
  'x-ratelimit-limit': '100',
  'x-ratelimit-remaining': '99',
  'x-ratelimit-used': '1',
  'x-ratelimit-reset': '1700000000'
}
