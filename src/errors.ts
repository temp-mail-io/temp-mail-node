export interface TempMailErrorOptions {
  statusCode?: number | undefined
  type?: string | undefined
  code?: string | undefined
  detail?: string | undefined
  requestId?: string | undefined
  cause?: unknown
}

export class TempMailError extends Error {
  readonly statusCode: number | undefined
  readonly type: string | undefined
  readonly code: string | undefined
  readonly detail: string | undefined
  readonly requestId: string | undefined

  constructor(message: string, options: TempMailErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'TempMailError'
    this.statusCode = options.statusCode
    this.type = options.type
    this.code = options.code
    this.detail = options.detail
    this.requestId = options.requestId
  }
}

export class AuthenticationError extends TempMailError {
  constructor(message: string, options: TempMailErrorOptions = {}) {
    super(message, options)
    this.name = 'AuthenticationError'
  }
}

export class RateLimitError extends TempMailError {
  constructor(message: string, options: TempMailErrorOptions = {}) {
    super(message, options)
    this.name = 'RateLimitError'
  }
}

export class ValidationError extends TempMailError {
  constructor(message: string, options: TempMailErrorOptions = {}) {
    super(message, options)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends TempMailError {
  constructor(message: string, options: TempMailErrorOptions = {}) {
    super(message, options)
    this.name = 'NotFoundError'
  }
}

const AUTH_CODES = new Set(['api_key_invalid', 'api_key_empty'])
const VALIDATION_CODES = new Set(['validation_error'])
const RATE_LIMIT_CODES = new Set(['rate_limited'])
const NOT_FOUND_CODES = new Set(['not_found'])

export function errorFromEnvelope(
  statusCode: number,
  envelope: {
    error?: { type?: string; code?: string; detail?: string }
    meta?: { request_id?: string }
  }
): TempMailError {
  const err = envelope.error ?? {}
  const code = err.code
  const detail = err.detail ?? err.type ?? `HTTP ${statusCode}`
  const options: TempMailErrorOptions = {
    statusCode,
    ...(err.type !== undefined ? { type: err.type } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(err.detail !== undefined ? { detail: err.detail } : {}),
    ...(envelope.meta?.request_id !== undefined
      ? { requestId: envelope.meta.request_id }
      : {})
  }

  if (code && AUTH_CODES.has(code))
    return new AuthenticationError(detail, options)
  if (code && RATE_LIMIT_CODES.has(code))
    return new RateLimitError(detail, options)
  if (code && VALIDATION_CODES.has(code))
    return new ValidationError(detail, options)
  if (code && NOT_FOUND_CODES.has(code))
    return new NotFoundError(detail, options)

  if (statusCode === 401 || statusCode === 403) {
    return new AuthenticationError(detail, options)
  }
  if (statusCode === 429) return new RateLimitError(detail, options)
  if (statusCode === 404) return new NotFoundError(detail, options)
  if (statusCode === 400 || statusCode === 422) {
    return new ValidationError(detail, options)
  }

  return new TempMailError(detail, options)
}
