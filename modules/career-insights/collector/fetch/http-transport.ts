import { detectBlock } from "./block-detector.ts";
import { RequestTimeoutError } from "./errors.ts";
import { networkCallCounter } from "./transport.ts";
import type { FetchTransport, PageRequest, TransportResponse } from "./transport.ts";

const CHARSET_PATTERN = /charset=["']?([A-Za-z0-9_-]+)/i;

function decodeBody(
  body: Buffer,
  contentType: string | null,
  headers: Readonly<Record<string, string>>,
): string {
  let charset: string | null = null;
  if (contentType !== null) {
    charset = CHARSET_PATTERN.exec(contentType)?.[1] ?? null;
  }
  if (charset === null) {
    const headerCharset = headers["content-type"] ?? null;
    if (headerCharset !== null) {
      charset = CHARSET_PATTERN.exec(headerCharset)?.[1] ?? null;
    }
  }
  if (charset === null) {
    charset = CHARSET_PATTERN.exec(body.subarray(0, 2048).toString("latin1"))?.[1] ?? null;
  }
  try {
    return new TextDecoder(charset?.toLowerCase() ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export interface HttpTransportOptions {
  readonly fetchImpl?: typeof fetch;
}

export class HttpTransport implements FetchTransport {
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpTransportOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async fetchPage(request: PageRequest): Promise<TransportResponse> {
    networkCallCounter.increment();
    const timeoutMs = Math.min(request.pageTimeoutMs, 30_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const signal =
        request.signal === undefined
          ? controller.signal
          : AbortSignal.any([controller.signal, request.signal]);
      const response = await this.fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        redirect: "follow",
        signal,
      });
      const body = Buffer.from(await response.arrayBuffer());
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const contentType = headers["content-type"] ?? null;
      const blocked = detectBlock({
        status: response.status,
        requestUrl: request.url,
        finalUrl: response.url,
        bodyText: decodeBody(body, contentType, headers),
        sourceKey: request.sourceKey,
      });
      if (blocked !== null) {
        throw blocked;
      }
      return {
        status: response.status,
        requestUrl: request.url,
        finalUrl: response.url,
        contentType,
        headers,
        body,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (request.signal?.aborted === true) {
          throw error;
        }
        throw new RequestTimeoutError(`单页请求在 ${timeoutMs}ms 后超时`, request.sourceKey);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}