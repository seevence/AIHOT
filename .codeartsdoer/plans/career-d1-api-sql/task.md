# 角色 D 阶段 1（D1）：SQL 持久化与真实读取 API

Project root: `D:\桌面\huawei\AIHOT`（分支 `feat/career-api`）
设计文档：`.codeartsdoer/plans/career-d1-api-sql/design.md`
共享契约：`modules/career-insights/contracts/{job.ts,api.ts,index.ts}`（只读）
C 的数据契约：`modules/career-insights/data/{validate.ts,metrics.ts,dictionaries.ts}`（只读）

## T1: SQL 读路径与 summary 指标

- requirement_ids: R1, R2, R3, R4, R5, R11
- write_set:
  - `modules/career-insights/backend/sql-repository.ts`
  - `modules/career-insights/backend/summary.ts`
  - `modules/career-insights/backend/repository.ts`
  - `modules/career-insights/server.ts`
- provides: C-REPO@1、C-SUMMARY@1（design.md §2.2）
- consumes: 共享类型 `SummaryResponseV1`、`JobListResponseV1`、`JobDetailResponseV1`、`JobFiltersV1`；`METRIC_SPECS_V1`、`SKILL_DICTIONARY_VERSION`；`@aihot/backend/db` 的 `Db`/`sql`
- blocked_by: []
- deliverable: 新增 `SqlCareerRepository` 与 `buildSummary`，`server.ts` 改用 SQL repository；`UnavailableCareerRepository` 从 `backend/repository.ts` 移除；三个 GET 在空表时返回 `200` + `insufficient_data` 语义、在连接失败时抛 `DataUnavailableError`。

## T2: 幂等写入与采集队列

- requirement_ids: R6, R7, R8, R9
- write_set:
  - `modules/career-insights/backend/ingest.ts`
  - `modules/career-insights/backend/queue.ts`
- provides: C-INGEST@1、C-QUEUE@1（design.md §2.2）
- consumes: `CareerObservationBatchV1`、`IngestResultV1`、`NormalizedJobV1`；`validateNormalizedJobV1`；`InvalidParameterError`；`defineQueue`、`ModuleQueue`；`@aihot/backend/db` 的 `Db`/`sql`
- blocked_by: []
- deliverable: 新增 `ingestBatch(db, batch)` 实现单事务幂等写入（accepted/updated/duplicates/rejected 精确计数、first_seen_at 不变、last_seen_at 只前进、观测 ON CONFLICT DO NOTHING），新增 `careerIngestQueue` 队列定义。

## T3: 后端数据库测试

- requirement_ids: R5, R6, R7, R8, R10
- write_set:
  - `modules/career-insights/tests/ingest.test.ts`
  - `modules/career-insights/tests/repository.test.ts`
- provides: C-TEST@1（design.md §2.2）
- consumes: C-REPO@1、C-SUMMARY@1、C-INGEST@1、C-QUEUE@1 的固定签名；`@aihot/backend/db`；`NormalizedJobV1` 构造函数
- blocked_by: []
- deliverable: 两个测试文件覆盖重复批次幂等、first/last_seen 语义、content_hash 变化更新、无效条目拒绝、筛选与分页、详情观测、空表 insufficient_data、单快照 observed_new_jobs=null。

## T4: 阶段 1 独立 review

- requirement_ids: R1–R11
- write_set: `-`
- provides: 阶段 review 结论（PASS / 阻断问题清单）
- consumes: T1/T2/T3 的实现与测试、design.md §2.2 契约
- blocked_by: [1, 2, 3]
- deliverable: 一份 review 结论，逐条对照 design.md §2.2 契约与开发契约 §6/§8/§13，给出 PASS 或按严重度排序的阻断项。