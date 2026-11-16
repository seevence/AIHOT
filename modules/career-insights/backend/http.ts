import type { FastifyInstance, FastifyReply } from "fastify";
import type { ApiErrorResponseV1, JobFiltersV1 } from "../contracts/api.ts";
import type { EmploymentType, RoleFamily, StudentFriendly } from "../contracts/index.ts";
import { CareerApiError, InvalidParameterError, NotFoundError } from "./errors.ts";
import type { CareerRepository } from "./repository.ts";

const ROLE_FAMILIES = ["ai_algorithm", "ai_application_development", "data", "ai_product_operations", "unknown"] as const;
const EMPLOYMENT_TYPES = ["campus", "internship", "experienced", "other", "unknown"] as const;
const STUDENT_FRIENDLY_VALUES = ["yes", "no", "unknown"] as const;
const FILTER_KEYS = new Set(["role_family", "company", "city", "employment_type", "student_friendly", "skill", "page", "page_size"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidParameter(parameter: string, message: string): InvalidParameterError {
  return new InvalidParameterError(message, { parameter });
}

function queryRecord(query: unknown): Record<string, unknown> {
  if (query === undefined) return {};
  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    throw new InvalidParameterError("Query parameters must be a flat object.");
  }
  return query as Record<string, unknown>;
}

function assertNoQuery(query: unknown): void {
  const input = queryRecord(query);
  const key = Object.keys(input)[0];
  if (key !== undefined) throw invalidParameter(key, `Unsupported query parameter: ${key}.`);
}

function optionalEnum<T extends string>(input: Record<string, unknown>, key: string, allowed: readonly T[]): T | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw invalidParameter(key, `Invalid value for query parameter: ${key}.`);
  }
  return value as T;
}

function optionalText(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidParameter(key, `Query parameter must be a non-empty string: ${key}.`);
  }
  return value.trim();
}

function pageNumber(input: Record<string, unknown>, key: "page" | "page_size", fallback: number, maximum?: number): number {
  const raw = input[key];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw)) {
    throw invalidParameter(key, `Query parameter must be a positive integer: ${key}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || (maximum !== undefined && value > maximum)) {
    throw invalidParameter(key, maximum === undefined ? `Query parameter is too large: ${key}.` : `Query parameter must be between 1 and ${maximum}: ${key}.`);
  }
  return value;
}

function parseJobFilters(query: unknown): JobFiltersV1 {
  const input = queryRecord(query);
  const unsupported = Object.keys(input).find((key) => !FILTER_KEYS.has(key));
  if (unsupported !== undefined) throw invalidParameter(unsupported, `Unsupported query parameter: ${unsupported}.`);

  const roleFamily = optionalEnum<RoleFamily>(input, "role_family", ROLE_FAMILIES);
  const employmentType = optionalEnum<EmploymentType>(input, "employment_type", EMPLOYMENT_TYPES);
  const studentFriendly = optionalEnum<StudentFriendly>(input, "student_friendly", STUDENT_FRIENDLY_VALUES);
  const company = optionalText(input, "company");
  const city = optionalText(input, "city");
  const skill = optionalText(input, "skill");

  return {
    ...(roleFamily === undefined ? {} : { role_family: roleFamily }),
    ...(company === undefined ? {} : { company }),
    ...(city === undefined ? {} : { city }),
    ...(employmentType === undefined ? {} : { employment_type: employmentType }),
    ...(studentFriendly === undefined ? {} : { student_friendly: studentFriendly }),
    ...(skill === undefined ? {} : { skill }),
    page: pageNumber(input, "page", 1),
    page_size: pageNumber(input, "page_size", 20, 100),
  };
}

async function respond(reply: FastifyReply, read: () => Promise<unknown>): Promise<FastifyReply> {
  reply.header("Cache-Control", "no-store");
  try {
    return reply.send(await read());
  } catch (error) {
    const apiError = error instanceof CareerApiError
      ? error
      : new CareerApiError(500, "internal_error", "Internal server error.");
    const body: ApiErrorResponseV1 = {
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details === undefined ? {} : { details: apiError.details }),
      },
    };
    return reply.code(apiError.statusCode).send(body);
  }
}

export function registerCareerHttp(app: FastifyInstance, repository: CareerRepository): void {
  app.get("/api/site/career-insights/summary", async (request, reply) => respond(reply, async () => {
    assertNoQuery(request.query);
    return repository.summary();
  }));

  app.get("/api/site/career-insights/jobs", async (request, reply) => respond(reply, async () => {
    return repository.listJobs(parseJobFilters(request.query));
  }));

  app.get<{ Params: { id: string } }>("/api/site/career-insights/jobs/:id", async (request, reply) => respond(reply, async () => {
    assertNoQuery(request.query);
    if (!UUID_PATTERN.test(request.params.id)) throw invalidParameter("id", "Job id must be a UUID.");
    const detail = await repository.jobDetail(request.params.id);
    if (detail === null) throw new NotFoundError();
    return detail;
  }));
}