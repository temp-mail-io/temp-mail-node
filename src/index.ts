export { TempMailClient } from './client.js'
export type { TempMailClientOptions } from './client.js'
export {
  TempMailError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError
} from './errors.js'
export type { TempMailErrorOptions } from './errors.js'
export type {
  Attachment,
  CreateEmailOptions,
  Domain,
  DomainType,
  EmailAddress,
  Message,
  RateLimit
} from './types.js'
export { VERSION } from './version.js'
