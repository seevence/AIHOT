// 每日离线生成学生就业三层研判（事实/推断/建议）并缓存；读者访问 /brief 只读缓存，不触发模型调用。
// node scripts/build-career-brief.ts                    调用模型，并按 (as_of, prompt_version) upsert 缓存
// node scripts/build-career-brief.ts --dry-run          调用模型并打印结果，不写库
// node scripts/build-career-brief.ts --window-days 30 --limit 6
// 需要 MODEL_CALLS_ENABLED=true 与 LLM_* 配置；模型输入只有聚合指标、时间窗、样本量和可引用 id。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import { z } from "zod";
import {
  CAREER_BRIEF_PROMPT_VERSION,
  CAREER_BRIEF_PURPOSE,
  CareerBriefValidationError,
  generateCareerBrief,
} from "../modules/career-insights/backend/brief.ts";
import {
  DEFAULT_CATALOG_LIMIT,
  DEFAULT_CATALOG_WINDOW_DAYS,
  MAX_CATALOG_LIMIT,
  MAX_CATALOG_WINDOW_DAYS,
} from "../modules/career-insights/backend/career-catalog.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const LLM_MODEL = "default";
const LLM_MAX_TOKENS = 2000;
const LLM_TIMEOUT_MS = 120_000;

const careerBriefDraftSchema = z.object({
  facts: z.array(z.string()),
  inferences: z.array(z.string()),
  actions: z.array(z.string()),
  limitations: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  evidence: z.array(z.object({ kind: z.enum(["job", "policy"]), id: z.string(), title: z.string() })).default([]),
});

function loadDotEnvIfPresent(): void {
  const file = path.join(REPO_ROOT, ".env");
  if (!existsSync(file)) return;
  const parsed = parseEnv(readFileSync(file, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL 无法解析)";
  }
}

function positiveIntArg(name: string, fallback: number, maximum: number): number {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const raw = process.argv[index + 1] ?? "";
  const value = Number.parseInt(raw, 10);
  if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${name} 需要一个 1-${maximum} 的整数`);
  }
  return value;
}

function printHelp(): void {
  console.log("用法: node scripts/build-career-brief.ts [--dry-run] [--window-days N] [--limit N]");
  console.log("  默认调用模型并按 (as_of, prompt_version) 写入 career_briefs。");
  console.log("  --dry-run：调用模型、打印结果，但不写库。");
  console.log(`  --window-days：观察窗，默认 ${DEFAULT_CATALOG_WINDOW_DAYS}，上限 ${MAX_CATALOG_WINDOW_DAYS}。`);
  console.log(`  --limit：方向榜/职位榜条数，默认 ${DEFAULT_CATALOG_LIMIT}，上限 ${MAX_CATALOG_LIMIT}。`);
  console.log("  需要 MODEL_CALLS_ENABLED=true；尚无岗位样本时不调用模型。");
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  const dryRun = process.argv.includes("--dry-run");
  const windowDays = positiveIntArg("--window-days", DEFAULT_CATALOG_WINDOW_DAYS, MAX_CATALOG_WINDOW_DAYS);
  const limit = positiveIntArg("--limit", DEFAULT_CATALOG_LIMIT, MAX_CATALOG_LIMIT);

  loadDotEnvIfPresent();
  const { config } = await import("../packages/backend/src/config.ts");
  if (!config.modelCallsEnabled) {
    console.error("MODEL_CALLS_ENABLED 为 false。本脚本会真实调用模型；请设置 MODEL_CALLS_ENABLED=true 后再运行。");
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || config.databaseUrl;
  const { sql, closeDb } = await import("../packages/backend/src/db.ts");
  console.log(`=== 学生就业研判（${dryRun ? "dry-run" : "apply"}） ===`);
  console.log(`prompt_version: ${CAREER_BRIEF_PROMPT_VERSION}`);
  console.log(`数据库:   ${describeDatabase(databaseUrl)}`);

  try {
    const { chatJson } = await import("../packages/backend/src/providers/llm.ts");
    const record = await generateCareerBrief(
      sql,
      async (input, prompt) => {
        const result = await chatJson({
          model: LLM_MODEL,
          purpose: CAREER_BRIEF_PURPOSE,
          subject: `career-brief:${input.as_of}`,
          promptVersion: CAREER_BRIEF_PROMPT_VERSION,
          system: prompt.system,
          user: prompt.user,
          schema: careerBriefDraftSchema,
          temperature: 0.2,
          maxTokens: LLM_MAX_TOKENS,
          timeoutMs: LLM_TIMEOUT_MS,
        });
        return { draft: result.data, receipt_id: result.receiptId, model: result.model };
      },
      { limit, window_days: windowDays, prompt_version: CAREER_BRIEF_PROMPT_VERSION, dry_run: dryRun },
    );

    if (record === null) {
      console.log("尚无岗位样本，未调用模型；等待采集积累观测日后再生成。");
      return;
    }
    console.log(`as_of: ${record.as_of}`);
    console.log(`观测日: ${record.observation_days}，样本量: ${record.sample_size}，置信度: ${record.confidence}`);
    if (dryRun) {
      console.log(JSON.stringify(record, null, 2));
      return;
    }
    console.log("已写入 career_briefs（按 as_of + prompt_version upsert）。");
  } catch (error) {
    if (error instanceof CareerBriefValidationError) {
      console.error(`模型输出不合规，未写库：${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {

    await closeDb();
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}