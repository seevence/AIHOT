import type { RawCollectedJobV1 } from "../../contracts/index.ts";
import type { CareerSourceAdapter } from "../index.ts";
import {
  AccessBlockedError,
  CollectorError,
  ConfigError,
  ParseFailedError,
  SchemaChangedError,
} from "../fetch/errors.ts";
import type { CollectorFailureType } from "../fetch/errors.ts";
import { validateRawCollectedJob } from "../validate.ts";
import type { SourceStatus } from "./status.ts";
import { decideSourceStatus } from "./status.ts";

export type FailureStage = "fetch" | "parse" | "access" | "config";

export interface SourceRunResult {
  readonly source_key: string;
  readonly entry_url: string;
  readonly attempted_at: string;
  readonly status: SourceStatus;
  readonly failure_type: CollectorFailureType | null;
  readonly failure_stage: FailureStage | null;
  readonly limitation_type: string | null;
  readonly original_error_name: string | null;
  readonly original_error_message: string | null;
  readonly jobs: readonly RawCollectedJobV1[];
  readonly invalid: readonly { index: number; messages: readonly string[] }[];
  readonly counts: {
    readonly collected: number;
    readonly invalid: number;
  };
  readonly error: Error | null;
}

export interface RunContext {
  readonly collectEnabled: boolean;
  readonly signal?: AbortSignal;
  readonly now?: () => string;
}

function toFailureType(error: unknown): CollectorFailureType {
  if (error instanceof CollectorError) {
    return error.failureType;
  }
  return "parse_failed";
}

function toFailureStage(error: unknown): FailureStage {
  if (error instanceof AccessBlockedError) {
    return "access";
  }
  if (error instanceof ConfigError) {
    return "config";
  }
  if (error instanceof ParseFailedError || error instanceof SchemaChangedError) {
    return "parse";
  }
  return "fetch";
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failureName(error: unknown): string | null {
  return error instanceof Error ? error.name : null;
}

function limitationType(error: unknown): string | null {
  return error instanceof AccessBlockedError ? error.limitationType : null;
}

export function validateCollectedJobs(jobs: readonly unknown[]): {
  readonly valid: readonly RawCollectedJobV1[];
  readonly invalid: readonly { index: number; messages: readonly string[] }[];
} {
  const valid: RawCollectedJobV1[] = [];
  const invalid: { index: number; messages: readonly string[] }[] = [];
  jobs.forEach((job, index) => {
    const result = validateRawCollectedJob(job);
    if (result.ok) {
      valid.push(result.value);
    } else {
      invalid.push({ index, messages: result.errors.map((issue) => `${issue.path}: ${issue.message}`) });
    }
  });
  return { valid, invalid };
}

export async function runSource(
  adapter: CareerSourceAdapter,
  context: RunContext,
): Promise<SourceRunResult> {
  const sourceKey = adapter.definition.source_key;
  const entryUrl = adapter.definition.entry_url;
  const attemptedAt = (context.now ?? (() => new Date().toISOString()))();

  if (!context.collectEnabled) {
    return {
      source_key: sourceKey,
      entry_url: entryUrl,
      attempted_at: attemptedAt,
      status: "rejected",
      failure_type: null,
      failure_stage: null,
      limitation_type: null,
      original_error_name: null,
      original_error_message: null,
      jobs: [],
      invalid: [],
      counts: { collected: 0, invalid: 0 },
      error: null,
    };
  }

  try {
    const raw = await adapter.collect(context.signal);
    const checked = validateCollectedJobs(raw);
    const failure = checked.valid.length === 0 && checked.invalid.length === 0 ? "empty_result" : null;
    const decision = decideSourceStatus({
      enabled: true,
      safetyValveClosed: false,
      collected: checked.valid.length,
      invalid: checked.invalid.length,
      failure,
    });
    return {
      source_key: sourceKey,
      entry_url: entryUrl,
      attempted_at: attemptedAt,
      status: decision.status,
      failure_type: decision.failure_type,
      failure_stage: null,
      limitation_type: null,
      original_error_name: null,
      original_error_message: null,
      jobs: checked.valid,
      invalid: checked.invalid,
      counts: { collected: checked.valid.length, invalid: checked.invalid.length },
      error: null,
    };
  } catch (error) {
    return {
      source_key: sourceKey,
      entry_url: entryUrl,
      attempted_at: attemptedAt,
      status: "failed",
      failure_type: toFailureType(error),
      failure_stage: toFailureStage(error),
      limitation_type: limitationType(error),
      original_error_name: failureName(error),
      original_error_message: failureMessage(error),
      jobs: [],
      invalid: [],
      counts: { collected: 0, invalid: 0 },
      error: new Error(`[${sourceKey}] ${failureMessage(error)}`, { cause: error }),
    };
  }
}

export async function runEnabledSources(
  adapters: readonly CareerSourceAdapter[],
  context: RunContext,
): Promise<readonly SourceRunResult[]> {
  const results: SourceRunResult[] = [];
  for (const adapter of adapters) {
    results.push(await runSource(adapter, context));
  }
  return results;
}