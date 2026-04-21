import {
  AuthenticationError,
  NotFoundError,
  TempMailClient,
  TempMailError
} from '../src/index.js'

const apiKey = process.env.TEMP_MAIL_API_KEY
if (!apiKey) {
  console.error('TEMP_MAIL_API_KEY is required')
  process.exit(2)
}

const client = new TempMailClient({
  apiKey,
  userAgent: 'temp-mail-node-smoke/0.1.0',
  ...(process.env.TEMP_MAIL_BASE_URL
    ? { baseUrl: process.env.TEMP_MAIL_BASE_URL }
    : {})
})

const failures: string[] = []

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()
  try {
    await fn()
    console.log(`✓ ${name} (${Date.now() - start}ms)`)
  } catch (err) {
    failures.push(name)
    console.error(`✗ ${name}: ${(err as Error).message}`)
    if (err instanceof TempMailError) {
      console.error(
        `  code=${err.code} status=${err.statusCode} requestId=${err.requestId}`
      )
    }
  }
}

let email = ''
let messageLookupMissingError: unknown

await step(
  'listDomains returns a non-empty list of public domains',
  async () => {
    const domains = await client.listDomains()
    const publicDomains = domains.filter((d) => d.type === 'public')
    if (publicDomains.length === 0) {
      throw new Error('no public domains returned')
    }
  }
)

await step('getRateLimit returns numeric counters', async () => {
  const rl = await client.getRateLimit()
  if (!(Number.isFinite(rl.limit) && Number.isFinite(rl.remaining))) {
    throw new Error(`bad rate-limit payload: ${JSON.stringify(rl)}`)
  }
})

await step('createEmail returns a usable address', async () => {
  const created = await client.createEmail()
  if (!created.email.includes('@')) {
    throw new Error(`invalid email from API: ${created.email}`)
  }
  email = created.email
})

if (email) {
  await step(
    'listEmailMessages returns an array for a fresh inbox',
    async () => {
      const messages = await client.listEmailMessages(email)
      if (!Array.isArray(messages)) {
        throw new Error('expected array')
      }
    }
  )

  await step('getMessage on random id throws NotFoundError', async () => {
    try {
      await client.getMessage('does-not-exist-smoke-test-id')
      throw new Error('expected NotFoundError but call succeeded')
    } catch (err) {
      messageLookupMissingError = err
      if (!(err instanceof NotFoundError)) {
        throw err
      }
    }
  })

  await step('deleteEmail cleans up the inbox', async () => {
    await client.deleteEmail(email)
  })
}

await step('invalid api key raises AuthenticationError', async () => {
  const bogus = new TempMailClient({ apiKey: 'invalid-smoke-test-key' })
  try {
    await bogus.listDomains()
    throw new Error('expected AuthenticationError but call succeeded')
  } catch (err) {
    if (!(err instanceof AuthenticationError)) {
      throw err
    }
  }
})

if (client.lastRateLimit) {
  console.log(
    `Rate limit left: ${client.lastRateLimit.remaining}/${client.lastRateLimit.limit}`
  )
}

void messageLookupMissingError

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke step(s) failed`)
  process.exit(1)
}
console.log('\nAll smoke steps passed.')
