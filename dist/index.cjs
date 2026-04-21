"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthenticationError: () => AuthenticationError,
  NotFoundError: () => NotFoundError,
  RateLimitError: () => RateLimitError,
  TempMailClient: () => TempMailClient,
  TempMailError: () => TempMailError,
  VERSION: () => VERSION,
  ValidationError: () => ValidationError
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var TempMailError = class extends Error {
  statusCode;
  type;
  code;
  detail;
  requestId;
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : void 0);
    this.name = "TempMailError";
    this.statusCode = options.statusCode;
    this.type = options.type;
    this.code = options.code;
    this.detail = options.detail;
    this.requestId = options.requestId;
  }
};
var AuthenticationError = class extends TempMailError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "AuthenticationError";
  }
};
var RateLimitError = class extends TempMailError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "RateLimitError";
  }
};
var ValidationError = class extends TempMailError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ValidationError";
  }
};
var NotFoundError = class extends TempMailError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "NotFoundError";
  }
};
var AUTH_CODES = /* @__PURE__ */ new Set(["api_key_invalid", "api_key_empty"]);
var VALIDATION_CODES = /* @__PURE__ */ new Set(["validation_error"]);
var RATE_LIMIT_CODES = /* @__PURE__ */ new Set(["rate_limited"]);
var NOT_FOUND_CODES = /* @__PURE__ */ new Set(["not_found"]);
function errorFromEnvelope(statusCode, envelope) {
  const err = envelope.error ?? {};
  const code = err.code;
  const detail = err.detail ?? err.type ?? `HTTP ${statusCode}`;
  const options = {
    statusCode,
    ...err.type !== void 0 ? { type: err.type } : {},
    ...code !== void 0 ? { code } : {},
    ...err.detail !== void 0 ? { detail: err.detail } : {},
    ...envelope.meta?.request_id !== void 0 ? { requestId: envelope.meta.request_id } : {}
  };
  if (code && AUTH_CODES.has(code))
    return new AuthenticationError(detail, options);
  if (code && RATE_LIMIT_CODES.has(code))
    return new RateLimitError(detail, options);
  if (code && VALIDATION_CODES.has(code))
    return new ValidationError(detail, options);
  if (code && NOT_FOUND_CODES.has(code))
    return new NotFoundError(detail, options);
  if (statusCode === 401 || statusCode === 403) {
    return new AuthenticationError(detail, options);
  }
  if (statusCode === 429) return new RateLimitError(detail, options);
  if (statusCode === 404) return new NotFoundError(detail, options);
  if (statusCode === 400 || statusCode === 422) {
    return new ValidationError(detail, options);
  }
  return new TempMailError(detail, options);
}

// src/types.ts
function parseMessage(raw) {
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
  };
}
function parseRateLimitFromHeaders(headers) {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const used = headers.get("x-ratelimit-used");
  const reset = headers.get("x-ratelimit-reset");
  if (limit === null || remaining === null || used === null || reset === null) {
    return void 0;
  }
  return {
    limit: Number(limit),
    remaining: Number(remaining),
    used: Number(used),
    reset: Number(reset)
  };
}

// src/version.ts
var VERSION = "0.1.0";

// src/client.ts
var DEFAULT_BASE_URL = "https://api.temp-mail.io";
var DEFAULT_TIMEOUT_MS = 3e4;
var TempMailClient = class {
  apiKey;
  baseUrl;
  timeoutMs;
  fetchImpl;
  userAgent;
  _lastRateLimit;
  constructor(options) {
    const opts = typeof options === "string" ? { apiKey: options } : options;
    if (!opts.apiKey) {
      throw new TempMailError("API key is required", {
        code: "api_key_empty"
      });
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.userAgent = opts.userAgent ?? `temp-mail-node/${VERSION}`;
    if (typeof this.fetchImpl !== "function") {
      throw new TempMailError(
        "No fetch implementation found. Pass one via options.fetch or run on Node.js 18+."
      );
    }
  }
  get lastRateLimit() {
    return this._lastRateLimit;
  }
  async listDomains() {
    const data = await this.request({
      method: "GET",
      path: "/v1/domains"
    });
    return data.domains;
  }
  async createEmail(options = {}) {
    const payload = {};
    if (options.email !== void 0) payload.email = options.email;
    if (options.domain !== void 0) payload.domain = options.domain;
    if (options.domainType !== void 0)
      payload.domain_type = options.domainType;
    return this.request({
      method: "POST",
      path: "/v1/emails",
      body: payload
    });
  }
  async deleteEmail(email) {
    await this.request({
      method: "DELETE",
      path: `/v1/emails/${encodeURIComponent(email)}`,
      expect: "empty"
    });
  }
  async listEmailMessages(email) {
    const data = await this.request({
      method: "GET",
      path: `/v1/emails/${encodeURIComponent(email)}/messages`
    });
    const raw = Array.isArray(data) ? data : data.messages ?? [];
    return raw.map((m) => parseMessage(m));
  }
  async getMessage(messageId) {
    const raw = await this.request({
      method: "GET",
      path: `/v1/messages/${encodeURIComponent(messageId)}`
    });
    return parseMessage(raw);
  }
  async deleteMessage(messageId) {
    await this.request({
      method: "DELETE",
      path: `/v1/messages/${encodeURIComponent(messageId)}`,
      expect: "empty"
    });
  }
  async getMessageSourceCode(messageId) {
    const data = await this.request({
      method: "GET",
      path: `/v1/messages/${encodeURIComponent(messageId)}/source_code`
    });
    return data.data;
  }
  async downloadAttachment(attachmentId) {
    return this.request({
      method: "GET",
      path: `/v1/attachments/${encodeURIComponent(attachmentId)}`,
      expect: "bytes"
    });
  }
  async getRateLimit() {
    return this.request({
      method: "GET",
      path: "/v1/rate_limit"
    });
  }
  async request({
    method = "GET",
    path,
    body,
    expect = "json"
  }) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "X-API-Key": this.apiKey,
      Accept: expect === "bytes" ? "application/octet-stream" : "application/json",
      "User-Agent": this.userAgent
    };
    const init = { method, headers };
    if (body !== void 0 && method !== "GET" && method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    init.signal = controller.signal;
    let response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (cause) {
      clearTimeout(timer);
      if (cause.name === "AbortError") {
        throw new TempMailError(
          `Request to ${path} timed out after ${this.timeoutMs}ms`,
          { cause }
        );
      }
      throw new TempMailError(`Request to ${path} failed: ${String(cause)}`, {
        cause
      });
    }
    clearTimeout(timer);
    const rateLimit = parseRateLimitFromHeaders(response.headers);
    if (rateLimit) this._lastRateLimit = rateLimit;
    if (!response.ok) {
      let envelope = {};
      try {
        envelope = await response.json();
      } catch {
      }
      throw errorFromEnvelope(response.status, envelope);
    }
    if (expect === "empty") {
      return void 0;
    }
    if (expect === "bytes") {
      const buf = await response.arrayBuffer();
      return new Uint8Array(buf);
    }
    return await response.json();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  TempMailClient,
  TempMailError,
  VERSION,
  ValidationError
});
//# sourceMappingURL=index.cjs.map