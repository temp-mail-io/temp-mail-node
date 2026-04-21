import { TempMailClient } from '../src/index.js'

const apiKey = process.env.TEMP_MAIL_API_KEY
if (!apiKey) {
  throw new Error('Set TEMP_MAIL_API_KEY')
}

const client = new TempMailClient(apiKey)

const domains = await client.listDomains()
console.log(
  `Public domains: ${domains.filter((d) => d.type === 'public').length}`
)

const { email } = await client.createEmail()
console.log(`Created: ${email}`)

const messages = await client.listEmailMessages(email)
console.log(`Messages: ${messages.length}`)

await client.deleteEmail(email)
console.log('Deleted.')
console.log('Rate limit:', client.lastRateLimit)
