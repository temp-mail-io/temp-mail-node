type DomainType = 'public' | 'premium' | 'custom';
interface Domain {
    name: string;
    type: DomainType;
}
interface EmailAddress {
    email: string;
    ttl: number;
}
interface Attachment {
    id: string;
    name: string;
    size: number;
}
interface Message {
    id: string;
    from: string;
    to: string;
    cc: string[];
    subject: string;
    bodyText: string;
    bodyHtml: string;
    createdAt: string;
    attachments: Attachment[];
}
interface RateLimit {
    limit: number;
    remaining: number;
    used: number;
    reset: number;
}
interface CreateEmailOptions {
    email?: string;
    domain?: string;
    domainType?: DomainType;
}

interface TempMailClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    userAgent?: string;
}
declare class TempMailClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly fetchImpl;
    private readonly userAgent;
    private _lastRateLimit;
    constructor(options: TempMailClientOptions | string);
    get lastRateLimit(): RateLimit | undefined;
    listDomains(): Promise<Domain[]>;
    createEmail(options?: CreateEmailOptions): Promise<EmailAddress>;
    deleteEmail(email: string): Promise<void>;
    listEmailMessages(email: string): Promise<Message[]>;
    getMessage(messageId: string): Promise<Message>;
    deleteMessage(messageId: string): Promise<void>;
    getMessageSourceCode(messageId: string): Promise<string>;
    downloadAttachment(attachmentId: string): Promise<Uint8Array>;
    getRateLimit(): Promise<RateLimit>;
    private request;
}

interface TempMailErrorOptions {
    statusCode?: number | undefined;
    type?: string | undefined;
    code?: string | undefined;
    detail?: string | undefined;
    requestId?: string | undefined;
    cause?: unknown;
}
declare class TempMailError extends Error {
    readonly statusCode: number | undefined;
    readonly type: string | undefined;
    readonly code: string | undefined;
    readonly detail: string | undefined;
    readonly requestId: string | undefined;
    constructor(message: string, options?: TempMailErrorOptions);
}
declare class AuthenticationError extends TempMailError {
    constructor(message: string, options?: TempMailErrorOptions);
}
declare class RateLimitError extends TempMailError {
    constructor(message: string, options?: TempMailErrorOptions);
}
declare class ValidationError extends TempMailError {
    constructor(message: string, options?: TempMailErrorOptions);
}
declare class NotFoundError extends TempMailError {
    constructor(message: string, options?: TempMailErrorOptions);
}

declare const VERSION = "0.1.0";

export { type Attachment, AuthenticationError, type CreateEmailOptions, type Domain, type DomainType, type EmailAddress, type Message, NotFoundError, type RateLimit, RateLimitError, TempMailClient, type TempMailClientOptions, TempMailError, type TempMailErrorOptions, VERSION, ValidationError };
