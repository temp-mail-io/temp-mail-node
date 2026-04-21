import { errorFromEnvelope, TempMailError } from './errors.js'
import {
  parseMessage,
  parseRateLimitFromHeaders,
  type CreateEmailOptions,
  type Domain,
  type EmailAddress,
  type Message,
  type RateLimit
} from './types.js'
import { VERSION } from './version.js'

export interface TempMailClientOptions {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  fetch?: typeof fetch
  userAgent?: string
}

const DEFAULT_BASE_URL = 'https://api.temp-mail.io'
const DEFAULT_TIMEOUT_MS = 30_000

interface RequestOptions {
  method?: string
  path: string
  body?: unknown
  expect?: 'json' | 'empty' | 'bytes'
}

export class TempMailClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch
  private readonly userAgent: string
  private _lastRateLimit: RateLimit | undefined

  constructor(options: TempMailClientOptions | string) {
    const opts = typeof options === 'string' ? { apiKey: options } : options
    if (!opts.apiKey) {
      throw new TempMailError('API key is required', {
        code: 'api_key_empty'
      })
    }
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.userAgent = opts.userAgent ?? `temp-mail-node/${VERSION}`
    if (typeof this.fetchImpl !== 'function') {
      throw new TempMailError(
        'No fetch implementation found. Pass one via options.fetch or run on Node.js 18+.'
      )
    }
  }

  get lastRateLimit(): RateLimit | undefined {
    return this._lastRateLimit
  }

  async listDomains(): Promise<Domain[]> {
    const data = await this.request<{ domains: Domain[] }>({
      method: 'GET',
      path: '/v1/domains'
    })
    return data.domains
  }

  async createEmail(options: CreateEmailOptions = {}): Promise<EmailAddress> {
    const payload: Record<string, unknown> = {}
    if (options.email !== undefined) payload.email = options.email
    if (options.domain !== undefined) payload.domain = options.domain
    if (options.domainType !== undefined)
      payload.domain_type = options.domainType
    return this.request<EmailAddress>({
      method: 'POST',
      path: '/v1/emails',
      body: payload
    })
  }

  async deleteEmail(email: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/v1/emails/${encodeURIComponent(email)}`,
      expect: 'empty'
    })
  }

  async listEmailMessages(email: string): Promise<Message[]> {
    const data = await this.request<{ messages?: unknown[] } | unknown[]>({
      method: 'GET',
      path: `/v1/emails/${encodeURIComponent(email)}/messages`
    })
    const raw = Array.isArray(data) ? data : (data.messages ?? [])
    return raw.map((m) => parseMessage(m as Parameters<typeof parseMessage>[0]))
  }

  async getMessage(messageId: string): Promise<Message> {
    const raw = await this.request<Parameters<typeof parseMessage>[0]>({
      method: 'GET',
      path: `/v1/messages/${encodeURIComponent(messageId)}`
    })
    return parseMessage(raw)
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/v1/messages/${encodeURIComponent(messageId)}`,
      expect: 'empty'
    })
  }

  async getMessageSourceCode(messageId: string): Promise<string> {
    const data = await this.request<{ data: string }>({
      method: 'GET',
      path: `/v1/messages/${encodeURIComponent(messageId)}/source_code`
    })
    return data.data
  }

  async downloadAttachment(attachmentId: string): Promise<Uint8Array> {
    return this.request<Uint8Array>({
      method: 'GET',
      path: `/v1/attachments/${encodeURIComponent(attachmentId)}`,
      expect: 'bytes'
    })
  }

  async getRateLimit(): Promise<RateLimit> {
    return this.request<RateLimit>({
      method: 'GET',
      path: '/v1/rate_limit'
    })
  }

  private async request<T>({
    method = 'GET',
    path,
    body,
    expect = 'json'
  }: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      Accept:
        expect === 'bytes' ? 'application/octet-stream' : 'application/json',
      'User-Agent': this.userAgent
    }

    const init: RequestInit = { method, headers }
    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    init.signal = controller.signal

    let response: Response
    try {
      response = await this.fetchImpl(url, init)
    } catch (cause) {
      clearTimeout(timer)
      if ((cause as { name?: string }).name === 'AbortError') {
        throw new TempMailError(
          `Request to ${path} timed out after ${this.timeoutMs}ms`,
          { cause }
        )
      }
      throw new TempMailError(`Request to ${path} failed: ${String(cause)}`, {
        cause
      })
    }
    clearTimeout(timer)

    const rateLimit = parseRateLimitFromHeaders(response.headers)
    if (rateLimit) this._lastRateLimit = rateLimit

    if (!response.ok) {
      let envelope: Parameters<typeof errorFromEnvelope>[1] = {}
      try {
        envelope = (await response.json()) as typeof envelope
      } catch {
        // non-JSON error body — stay with empty envelope
      }
      throw errorFromEnvelope(response.status, envelope)
    }

    if (expect === 'empty') {
      return undefined as T
    }
    if (expect === 'bytes') {
      const buf = await response.arrayBuffer()
      return new Uint8Array(buf) as T
    }
    return (await response.json()) as T
  }
}
