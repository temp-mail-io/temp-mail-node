export type DomainType = 'public' | 'premium' | 'custom'

export interface Domain {
  name: string
  type: DomainType
}

export interface EmailAddress {
  email: string
  ttl: number
}

export interface Attachment {
  id: string
  name: string
  size: number
}

export interface Message {
  id: string
  from: string
  to: string
  cc: string[]
  subject: string
  bodyText: string
  bodyHtml: string
  createdAt: string
  attachments: Attachment[]
}

export interface RateLimit {
  limit: number
  remaining: number
  used: number
  reset: number
}

export interface CreateEmailOptions {
  email?: string
  domain?: string
  domainType?: DomainType
}

interface RawMessage {
  id: string
  from: string
  to: string
  cc?: string[] | null
  subject: string
  body_text: string
  body_html: string
  created_at: string
  attachments?: Attachment[] | null
}

export function parseMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    from: raw.from,
    to: raw.to,
    cc: raw.cc ?? [],
    subject: raw.subject,
    bodyText: raw.body_text,
    bodyHtml: raw.body_html,
    createdAt: raw.created_at,
    attachments: raw.attachments ?? []
  }
}

export function parseRateLimitFromHeaders(
  headers: Headers
): RateLimit | undefined {
  const limit = headers.get('x-ratelimit-limit')
  const remaining = headers.get('x-ratelimit-remaining')
  const used = headers.get('x-ratelimit-used')
  const reset = headers.get('x-ratelimit-reset')
  if (limit === null || remaining === null || used === null || reset === null) {
    return undefined
  }
  return {
    limit: Number(limit),
    remaining: Number(remaining),
    used: Number(used),
    reset: Number(reset)
  }
}
