// The policy list is a new public route: these tests drive the Fastify layer with a fake repository
// so query validation and error mapping are proven without a database.
import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { registerCareerHttp } from "../backend/http.ts";
import { DataUnavailableError } from "../backend/errors.ts";
import type { CareerRepository } from "../backend/repository.ts";
import type { PolicyFiltersV1, PolicyListResponseV1 } from "../backend/policy-read.ts";

function policyResponse(filters: PolicyFiltersV1): PolicyListResponseV1 {
  return {
    contract_version: "0.1",
    data_origin: "live",
    as_of: "2026-11-18T00:00:00.000Z",
    items: [],
    page: filters.page,
    page_size: filters.page_size,
    total: 0,
    filters,
  };
}

function fakeRepository(overrides: Partial<CareerRepository> = {}): CareerRepository {
  return {
    summary: async () => {
      throw new Error("not used");
    },
    listJobs: async () => {
      throw new Error("not used");
    },
    jobDetail: async () => null,
    listPolicies: async (filters) => policyResponse(filters),
    writeBatch: async () => ({ accepted: 0, updated: 0, duplicates: 0, rejected: 0, errors: [] }),
    ...overrides,
  };
}

async function build(repository: CareerRepository) {
  const app = Fastify();
  registerCareerHttp(app, repository);
  await app.ready();
  return app;
}

test("the policy route passes the parsed filters to the repository", async () => {
  let seen: PolicyFiltersV1 | undefined;
  const app = await build(fakeRepository({ listPolicies: async (filters) => ((seen = filters), policyResponse(filters)) }));
  const response = await app.inject({
    url: "/api/site/career-insights/policies?source_key=ndrc-policy&theme=employment_promotion&page=2&page_size=5",
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(seen, { source_key: "ndrc-policy", theme: "employment_promotion", page: 2, page_size: 5 });
  assert.equal(response.headers["cache-control"], "no-store");
});

test("the policy route rejects unsupported and malformed parameters", async () => {
  const app = await build(fakeRepository());

  const unsupported = await app.inject({ url: "/api/site/career-insights/policies?sort=date" });
  assert.equal(unsupported.statusCode, 400);
  assert.equal(unsupported.json().error.code, "invalid_parameter");

  const tooLarge = await app.inject({ url: "/api/site/career-insights/policies?page_size=101" });
  assert.equal(tooLarge.statusCode, 400);

  const empty = await app.inject({ url: "/api/site/career-insights/policies?theme=" });
  assert.equal(empty.statusCode, 400);

  await app.close();
});

test("the policy route maps a database outage to 503 data_unavailable", async () => {
  const app = await build(
    fakeRepository({
      listPolicies: async () => {
        throw new DataUnavailableError();
      },
    }),
  );
  const response = await app.inject({ url: "/api/site/career-insights/policies" });
  await app.close();

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "data_unavailable");
});