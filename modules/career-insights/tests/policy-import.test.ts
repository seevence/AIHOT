// The collector only produces PolicyDetailDraft; this layer turns drafts into the policy batch that
// writePolicyBatch accepts. Tests pin the identity, theme and hash rules that make re-imports idempotent.
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import type { PolicyDetailDraft } from "../collector/index.ts";
import { policyBatchFromDrafts, policyItemFromDraft, policyItemIdFromDraft } from "../backend/policy-ingest.ts";
import { writePolicyBatch, listPolicyEvidence } from "../backend/policy-repository.ts";
import { SqlCareerRepository } from "../backend/sql-repository.ts";

const FETCHED_AT = "2026-11-19T08:08:00.000Z";
const repository = new SqlCareerRepository(sql);

const envelope = {
  source_key: "ndrc-policy",
  source_tier: "government_official" as const,
  source_issuer: "国家发展和改革委员会",
  fetched_at: FETCHED_AT,
  collector_version: "collector/test-1",
};

function draft(overrides: Partial<PolicyDetailDraft> = {}): PolicyDetailDraft {
  return {
    sourceKey: "ndrc-policy",
    title: "关于促进人工智能就业的通知",
    url: "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202611/t20261101_1.html",
    issuingAuthority: null,
    documentNumber: "发改就业〔2026〕123号",
    bodyRaw: "大力推动人工智能人才培养和就业促进。",
    publishedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

after(async () => {
  await closeDb();
});

beforeEach(async () => {
  await sql`TRUNCATE career_job_observations, career_jobs, career_policies, career_ingest_runs RESTART IDENTITY`;
});

test("a draft maps to a policy item with a stable id, calendar date, themes and hash", () => {
  const item = policyItemFromDraft(draft(), envelope);

  assert.equal(item.policy_item_id, "doc:发改就业〔2026〕123号");
  assert.equal(item.published_at, "2026-11-01");
  assert.equal(item.issuer, "国家发展和改革委员会", "the source authority fills a missing issuer");
  assert.equal(item.source_tier, "government_official");
  assert.ok(item.theme_ids.includes("artificial_intelligence"));
  assert.ok(item.theme_ids.includes("talent_development"));
  assert.ok(item.theme_ids.includes("employment_promotion"));
  assert.ok(item.evidence_excerpt.length <= 500);
  assert.equal(item.content_hash.length, 64);
  assert.equal(policyItemFromDraft(draft(), envelope).content_hash, item.content_hash);
  assert.notEqual(policyItemFromDraft(draft({ bodyRaw: "仅推动人才培养。" }), envelope).content_hash, item.content_hash);
});

test("a draft without a document number keeps one id across tracking parameters", () => {
  const base = draft({ documentNumber: null, url: "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202611/t20261101_1.html" });
  const tracked = draft({
    documentNumber: null,
    url: "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202611/t20261101_1.html?from=wechat#top",
  });

  assert.equal(policyItemIdFromDraft(base), policyItemIdFromDraft(tracked));
  assert.ok(policyItemIdFromDraft(base).startsWith("url:"));
});

test("a draft from another source is refused instead of being written under the wrong key", () => {
  assert.throws(() => policyItemFromDraft(draft({ sourceKey: "moe-policy" }), envelope), /does not match/);
});

test("drafts from one run become an idempotent policy batch that the list endpoint returns", async () => {
  const batch = policyBatchFromDrafts([draft()], envelope);
  const first = await writePolicyBatch(sql, batch);
  const second = await writePolicyBatch(sql, batch);

  assert.deepEqual(first, { accepted: 1, updated: 0, duplicates: 0, rejected: 0, errors: [] });
  assert.deepEqual(second, { accepted: 0, updated: 0, duplicates: 1, rejected: 0, errors: [] });

  const evidence = await listPolicyEvidence(sql);
  assert.equal(evidence.length, 1);

  assert.ok(evidence[0]!.theme_ids.includes("artificial_intelligence"));

  const listed = await repository.listPolicies({ theme: "artificial_intelligence", page: 1, page_size: 20 });
  assert.equal(listed.total, 1);
  assert.equal(listed.data_origin, "live");
  assert.equal(listed.items[0]!.policy_item_id, "doc:发改就业〔2026〕123号");
});
test("a draft without any theme keyword still writes with an empty theme array", async () => {
  const batch = policyBatchFromDrafts(
    [
      draft({
        title: "关于做好冬季供暖工作的通知",
        bodyRaw: "保障居民冬季供暖。",
        documentNumber: "发改能源〔2026〕9号",
      }),
    ],
    envelope,
  );
  assert.deepEqual(batch.policies[0]!.theme_ids, []);

  const result = await writePolicyBatch(sql, batch);
  assert.equal(result.accepted, 1);

  const listed = await repository.listPolicies({ page: 1, page_size: 20 });
  assert.equal(listed.total, 1);
  assert.deepEqual(listed.items[0]!.theme_ids, []);
});