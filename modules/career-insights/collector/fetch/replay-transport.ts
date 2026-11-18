import { ReplaySampleMissingError } from "./errors.ts";
import type { FetchTransport, PageRequest, TransportResponse } from "./transport.ts";

export interface ReplaySample {
  readonly request_key: string;
  readonly captured_at: string;
  readonly status: number;
  readonly request_url: string;
  readonly final_url: string;
  readonly content_type: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}

export function computeRequestKey(url: string, method = "GET"): string {
  return `${method.toUpperCase()} ${url}`;
}

export class ReplayTransport implements FetchTransport {
  private readonly samples: readonly ReplaySample[];
  private readonly anchorIso: string | null;

  constructor(samples: readonly ReplaySample[], anchorIso: string | null = null) {
    this.samples = samples;
    this.anchorIso = anchorIso;
  }

  async fetchPage(request: PageRequest): Promise<TransportResponse> {
    const key = computeRequestKey(request.url, request.method);
    const anchorMs = this.anchorIso === null ? null : Date.parse(this.anchorIso);
    const sample = this.samples
      .filter((candidate) => candidate.request_key === key)
      .filter((candidate) => anchorMs === null || Date.parse(candidate.captured_at) <= anchorMs)
      .sort((left, right) => Date.parse(right.captured_at) - Date.parse(left.captured_at))[0];

    if (sample === undefined) {
      throw new ReplaySampleMissingError(`缺少 ${key} 的回放样本`, request.sourceKey);
    }

    return {
      status: sample.status,
      requestUrl: sample.request_url,
      finalUrl: sample.final_url,
      contentType: sample.content_type,
      headers: sample.headers,
      body: sample.body,
      fetchedAt: sample.captured_at,
    };
  }
}