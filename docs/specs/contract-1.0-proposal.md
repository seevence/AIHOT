# 契约 1.0 增量提案（D 起草，A 落地）

> 状态：提案，**未修改 `contracts/**`**（A 独占写集）
> 日期：2026-11-17
> 前置：BLK-09 由 A/C/D/E 评审

## 一、必须新增/调整的字段

### 1. `SummaryResponseV1` 新增可选字段

```ts
export interface SourceCoverageV1 {
  source_key: string;
  last_ok_at: string | null;      // UTC ISO Z；无成功批次为 null
  last_attempt_at: string | null; // UTC ISO Z；无批次为 null
  job_count: number;              // 当前态职位数
  status: "ok" | "failed" | "stale";
}

export interface SummaryResponseV1 {
  // ... 现有字段不变
  source_coverage?: SourceCoverageV1[]; // 按 source_key 升序
  snapshot_count?: number;              // 可区分观测时点数
}
```

- 可选字段，旧客户端不受影响。
- `source_coverage` 为一次批量查询结果，不按来源逐个查询。
- `status=failed` 的批次不推进 `last_seen_at`，但该来源的职位仍保留。

### 2. `PolicyEvidenceRefV1.published_at` 允许 null

```ts
// contracts/job.ts
published_at: string | null;
```

- 现状 `published_at: string`（`contracts/job.ts:87`）无法表达“发布日期未知”。
- 放宽后，无日期政策可如实返回 `null`，前端显示“发布日期未知”，不得回填采集时间。
- 受影响：`SharedThemeV1.policies`、E 的 `SharedThemeList` 渲染、政策证据测试。
- 若 A 拒绝：政策只允许入库有明确日期的记录（当前实现已按此限制）。

### 3. 批次记录类型（可选）

`CareerIngestRunV1` 是否需要暴露给 E 的后台信源状态页：

```ts
export interface CareerIngestRunV1 {
  id: string;
  kind: "jobs" | "policy";
  source_key: string;
  fetched_at: string;
  collector_version: string;
  data_origin: "live" | "verified_import" | "synthetic_fixture";
  status: "ok" | "partial" | "failed";
  job_count: number;
  accepted: number;
  updated: number;
  duplicates: number;
  rejected: number;
  error: string | null;
}
```

- D 侧已在 `backend/run-repository.ts` 内部定义同形类型，未写 `contracts/`。
- 若 E 需要“后台可查看信源状态、采集时间和失败原因”（P0），建议提升到契约。

## 二、版本策略

- 当前 `contract_version = "0.1"`。
- 真实样本验收后升级 `"1.0"`；只允许新增可选字段。
- `published_at` 改为可空属于**放宽**，不删除字段，但会改变类型语义，需 A/C/D/E 同步确认。
- 禁止在同一版本内删除、改名、改枚举或改指标含义。

## 三、落地顺序（A）

1. 修改 `contracts/api.ts`：新增 `SourceCoverageV1`、两个可选字段。
2. 修改 `contracts/job.ts`：`published_at: string | null`。
3. 更新 `contracts/openapi.json` 与 `docs/development-contract.md`。
4. 跑 `npm run typecheck` 与 `npm test`。
5. 通知 D：D 再实现 `listRunCoverage` 与 `summary.source_coverage`（T-S1-14），并把政策读取从 `published_at IS NOT NULL` 放宽为返回 null。

## 四、验收

- [ ] `SummaryResponseV1` 含 `source_coverage?`、`snapshot_count?`
- [ ] `PolicyEvidenceRefV1.published_at` 可空
- [ ] `npm run typecheck` 通过
- [ ] OpenAPI 与实现一致
- [ ] 旧客户端（不读新字段）行为不变