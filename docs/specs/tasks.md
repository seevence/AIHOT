# 就业HOT：编码任务规划（S0–S5）

> 文档状态：待用户/队长确认（本阶段只出任务计划，不写业务代码、不建迁移、不做 Git 提交）
> 上游需求：`docs/specs/2026-11-17-career-hot-increment-spec.md`（已确认）
> 技术设计：`docs/specs/2026-11-18-career-hot-design.md`（已确认）
> 权威基线：`origin/feat/integration` @ `21d07eb894ad9e0703a3ba037d5a67177f401d64`（2026-11-17）
> 云端路线图：`git show origin/feat/integration:ROADMAP.md`（以云端为基准；本地 `ROADMAP.md` 落后，不作为口径）
> 角色：**D（后端与 API）**；写集 `modules/career-insights/{server.ts,backend/**,migrations/**}`
> 分支：`feat/career-api-d2`（新建，基于云端 21d07eb）；推送目标仅此分支
> 版本：v1（2026-11-17 首版）

---

## 0. 使用须知（执行前必读）

1. **任务粒度**：一条任务 = 一次 commit 可完成并单独验证；迁移**一文件一语句**，绝不把多个迁移揉进一条任务。
2. **写集红线**：D 只提交 `modules/career-insights/{server.ts,backend/**,migrations/**}`。`contracts/**`、`site/**`、`collector/**`、`data/**`、`web/**`、`module.ts`、`scripts/**`、`tests/**`、`package-lock.json` 越界即回退（第 1 章逐条说明待拍板）。
3. **禁止重复实现**：SQL repository、幂等 `ingestBatch`、`career-insights.ingest` 队列、三条 GET API 已由队长并行完成并合入 `feat/integration`（`c666b46`…`21d07eb`）。本计划只补缺口，不改写既有语义（D01-10）。
4. **不得假设 B 的改动已提交**：主工作区存在 B 采集线未提交改动（`collector/{index,sources,tencent,xiaomi,netease}.ts`、`scripts/collect-career.ts`）。这些文件**不在任何 D commit 中**；新 worktree 里也不会存在（见 BLK-06）。
5. **数据真实性**：不得用 fixture、`synthetic-*`、编造政策/观测时点/采集日志"先过验收"。阻塞未解除时，对应任务只能记为"受阻"。
6. **阶段串行**：S0 → S1 → S2 → S3 → S4 → S5。每阶段必须"本地 review PASS → 更新路线图 → 推 `feat/career-api-d2` → 才进下一阶段"。

---

## 1. 阻塞与待拍板清单（先于任务执行）

> 本节排在所有任务之前。**标注"不可开工"的任务，必须在对应 BLK 拍板后才能动手**；标注"可开工不可推送"的任务可本地编写与本地验证，但不得推送/合入。

| ID | 阻塞事项 | 实测事实 | 需拍板人 | 影响任务 | 开工判定 |
|---|---|---|---|---|---|
| **BLK-01** | `site/site.ts`、`site/changelog.json`、`site/brand/**` 归属未定 | 云端 `ROADMAP.md` §6 的 A 独占写集不含这三个路径；设计 §2.4.1 判定为"未分配共享文件"；上游规格误写为 A 写集 | 队长（A 参与） | T-S4-05、T-S4-06、T-S4-07、T-S4-08 | **不可开工**（等裁定路径 A：A 执行；路径 B：队长书面授权 D 单 commit） |
| **BLK-02** | 新增迁移 `0156`–`0162` 是否批准；编号是否与 B/C/E 同期冲突 | 现状 career 迁移到 `0155`，核心库到 `0151`；`scripts/migration-safety.ts` 要求一文件一语句、索引 `CONCURRENTLY IF NOT EXISTS` | A（契约/迁移评审） | T-S1-01～S1-05、T-S2-01～S2-04 及所有依赖新表/新列的任务 | 可开工（本地编写+本地安全检查），**不可推送**；合并前须重排编号 |
| **BLK-03** | 官方媒体（新华网/人民网/中新网）作政策源是否被评审接受；`source_tier` 展示名用"官方媒体解读"还是其他 | 所有 `.gov.cn` 本机不可达（代理握手失败）；设计 §2.6.3 定为 `official_media` → "官方媒体解读" | 队长/评审 | T-S2-07、T-S2-09（文案定稿）、T-S2-10 的政策样本前提 | T-S2-07 **不可开工**；机制类任务可先写代码 |
| **BLK-04** | 正式站名/英文名/副标题/域名是否定稿 | 现状 `site/site.ts:23` 为 `MyHOT`；规格采用工作名"就业HOT" | 队长 | T-S4-05、T-S4-08 | **不可开工**（工作名可先用于清单，但不得提交品牌文件） |
| **BLK-05** | 第二次观测间隔：≥30 分钟还是次日同时段；评审前能否完成第二次采集 | 现状仅 1 个时点（70 条真实职位） | 队长/B/D | T-S3-01、T-S3-07 | T-S3-01 **不可开工**（执行时点未定）；T-S3-02 代码可先写 |
| **BLK-06** | `tests/**` 与 `scripts/**` 写集归属；`scripts/collect-career.ts` 与 `collector/*` 尚未提交 | 云端 ROADMAP 未列 `tests/**`、`scripts/**`；`scripts/check-career-integration.ts` 由 A 维护；B 的 6 个采集文件为未提交状态，新 worktree 内**不存在** | 队长/A | T-S1-09、T-S1-10（需采集脚本）、T-S1-16、T-S2-07、T-S2-15、T-S1-13 入口、门禁加严 | 测试可本地跑但**不可提交**；采集执行需 B 提交、A 合入后才可复现 |
| **BLK-07** | 样本量底线（3 家 70 条是否够）；网易分页失效是否接受"首批 + 去重" | 3 家已入库 70 条；网易分页失效 | 队长/B | T-S1-09、T-S3-03 的验收口径 | 可开工，但验收结论需标注覆盖局限；是否扩第 4 家待拍板 |
| **BLK-08** | `mcpPrefix`（现 `myhot`）是否随品牌改名 | 设计建议保持 `myhot`，P1 再评估；改名需升 `interfaceVersion` 主版本 | 队长/A | T-S4-09 | 可先起草建议记录，**定稿需拍板** |
| **BLK-09** | 契约写集在 A（`contracts/**`）：`source_coverage` / `snapshot_count` / `CareerPolicyBatchV1` / `PolicyEvidenceRefV1.published_at` 可空 / `contract_version=1.0` | 实测 `contracts/api.ts:52-66` 无 `source_coverage`、`snapshot_count`；`contracts/job.ts:87` `published_at: string`（非可空），无法如实表达"发布日期未知" | A（D 提供提案与受影响清单） | T-S1-13、T-S1-14、T-S2-13、T-S3-04、T-S4-01～S4-03 | 提案清单可写；**实现与冻结不可开工** |
| **BLK-10** | `footerNote`/`poweredBy` 全移除，还是保留一行非品牌化文案 | 现状 `site/site.ts:73`“由 AIHOT 开源框架驱动”、`:81` `poweredBy=AIHOT/aihot.news` | 队长 | T-S4-05、T-S4-08 | 随 BLK-01/BLK-04 一起解决 |

**阻塞判定**：BLK-01/03/04/05/09 未解除时，对应任务状态只能是"受阻"，不得用工作名、官方媒体默认口径或契约临时改动"先过验收"。

---

## 2. 阶段总览

| 阶段 | 范围 | 任务数 | 关键出口 |
|---|---|---|---|
| S0 基线 | worktree、云端同步、路线图副本、基线门禁 | 5 | 落后提交为 0；typecheck 通过 |
| S1 D-01 职位闭环 | 迁移 0156–0159、批次记录、`data_origin` 落库/读回、真实入库、幂等、UTC Z、`--require-data` 双向 | 15 | 3 源 ≥3 公司、空库门禁失败、批次表 ≥3 条 `ok` |
| S2 D-02 政策证据 | 迁移 0160–0162、`career_policies`、`writePolicyBatch`/`listPolicyEvidence`、`shared_themes`、`unknown_*`、非因果文案 | 15 | 2 政策源各 ≥1 条、≥1 个双侧主题、空政策 `insufficient_data` |
| S3 两个观测时点 | 第二次采集、批次差集、不翻倍、单快照语义、`value=0` vs `unsupported` | 7 | 两个可区分时点、职位数不翻倍 |
| S4 契约 1.0 与品牌 | 契约提案与落地（A）、品牌差异清单与验收（归属待裁定） | 9 | `rg "MyHOT"` 0 命中；契约与测试一致 |
| S5 联调缺陷 | 只修缺陷、全门禁复跑、性能与 503 语义 | 5 | 全部命令复跑全绿 |
| **合计** | | **56** | |

---

## 3. S0 基线（5 个任务）

### 3.1 S0 任务

- [ ] **T-S0-01 创建独立 worktree 与角色分支**
  - 目标：在不污染主工作区（含 B 未提交改动）的前提下，建立基于云端基线的 D 开发树。
  - 负责：D
  - 文件/写集：不涉及业务文件；worktree 目录 `D:/Codex下载/GitHub项目/seevence/AIHOT-d2`
  - 前置：无
  - 验收：
    - `git fetch origin --prune` 无错误；
    - `git rev-parse origin/feat/integration` = `21d07eb894ad9e0703a3ba037d5a67177f401d64`；
    - `git worktree add "D:/Codex下载/GitHub项目/seevence/AIHOT-d2" -b feat/career-api-d2 origin/feat/integration` 成功（若 `feat/career-api-d2` 已存在则改用 `-d2b`，**不覆盖已有分支**）；
    - 新 worktree 内 `git log --oneline -1` 为 `21d07eb`，`git status --short` 为空（B 的未提交改动不会被带过来）。
  - 预计产出：无 commit；后续全部 D 提交只在本 worktree 产生。

- [ ] **T-S0-02 基线一致性断言与记录**
  - 目标：证明本地落后提交为 0，并把基线 SHA 写入路线图。
  - 负责：D
  - 文件/写集：`docs/roadmaps/career-api-roadmap.md`（D 维护的本地副本，非云端 `ROADMAP.md`）
  - 前置：T-S0-01
  - 验收：
    - `git log --oneline HEAD..origin/feat/integration` 输出为空；
    - `git rev-parse --abbrev-ref HEAD` = `feat/career-api-d2`；
    - `git log -1 --format='%H %s'` 记录为 `21d07eb …`；
    - 路线图"基线提交"行由 `142e99a` 更新为 `21d07eb`（含完整 SHA）。
  - 预计产出：`docs: pin D2 baseline to 21d07eb`（1 个 commit）。

- [ ] **T-S0-03 复核云端路线图并登记后续更新位置**
  - 目标：把云端 `ROADMAP.md` 中与 D 相关的约束（§6 写集、§9 待确认）落到 D 路线图，明确"谁改哪个文件"。
  - 负责：D
  - 文件/写集：`docs/roadmaps/career-api-roadmap.md`（**不直接改** 云端 `ROADMAP.md`，它由 A 维护）
  - 前置：T-S0-02
  - 验收：
    - `git show origin/feat/integration:ROADMAP.md` 的 §6 写集表、§9 待确认事项摘录进 D 路线图；
    - 路线图内写明更新位置与时机：本文件（每阶段开始/结束各一次）；云端 `ROADMAP.md` 通过 PR 描述交 A；
    - 路线图不含 `site/site.ts` 属 A 的错误表述（以云端原文为准，标注为"待裁定"）。
  - 预计产出：`docs(roadmap): record cloud constraints and update points`（1 个 commit）。

- [ ] **T-S0-04 基线门禁复跑**
  - 目标：在干净基线上确认工具链可用，避免把既有失败误判为本阶段缺陷。
  - 负责：D
  - 文件/写集：无
  - 前置：T-S0-01
  - 验收：
    - `npm run typecheck` → 0 error；
    - `npx tsc -p modules/tsconfig.json` → 0 error；
    - `npm run test:standalone` → 全通过（基线 311+ 用例）；
    - `node scripts/check-migrations.ts --base origin/feat/integration` → `migration history and online safety checked`；
    - 命令与结果写入路线图阶段记录（**不写"通过"而不留输出**）。
  - 预计产出：`docs(roadmap): record S0 baseline gates`（1 个 commit，与 T-S0-03 合并亦可）。

- [ ] **T-S0-05 建立写集隔离检查模板并实测一次**
  - 目标：把"只提交 D 写集"变成可复制执行的命令，而不是口头约定。
  - 负责：D
  - 文件/写集：`docs/roadmaps/career-api-roadmap.md`（记录命令模板）
  - 前置：T-S0-04
  - 验收：
    - 模板命令至少包含：
      - `git status --short`；
      - `git diff --name-only origin/feat/integration...HEAD`；
      - `git diff origin/feat/integration...HEAD --name-only | rg -v '^modules/career-insights/(server\.ts|backend/|migrations/)'` 期望无输出；
      - `rg -n "collector/|scripts/collect-career" <(git diff --name-only origin/feat/integration...HEAD)` 期望无命中；
    - 实测一次并记录输出（空 diff 时记为"基线无改动"）。
  - 预计产出：`docs(roadmap): add write-set isolation checks`（可与 T-S0-04 合并提交）。

### 3.2 S0 阶段出口

> **本地 review PASS → 更新路线图 → 推 `feat/career-api-d2` → 才进入 S1。**

- review 检查项：`typecheck`、`tsc -p modules`、`test:standalone`、`check-migrations --base origin/feat/integration`、写集隔离（无越界文件）、无 `.env`/`.data/`/密钥。
- 推送：`git push -u origin feat/career-api-d2`；**不推 `main`、不合 `feat/integration`**。
- 记录：路线图写明 S0 结论、基线 SHA、遗留（如 BLK-02 待批）。

---

## 4. S1 D-01 真实职位闭环（15 个任务，含批次记录）

### 4.1 迁移（一文件一语句，逐条可单独验证）

- [ ] **T-S1-01 新增迁移 `0156_career_ingest_runs.sql`（批次表）**
  - 目标：为"两个观测时点""来源覆盖变化""导入标注"提供唯一权威批次事实。
  - 负责：D
  - 文件/写集：`modules/career-insights/migrations/0156_career_ingest_runs.sql`
  - 前置：T-S0-01；BLK-02 批准（可先本地编写）
  - 验收：
    - 单条 `CREATE TABLE career_ingest_runs`，含：`id uuid PK DEFAULT gen_random_uuid()`、`kind text CHECK ('jobs','policy')`、`source_key`、`fetched_at timestamptz NOT NULL`、`collector_version`、`data_origin CHECK ('live','verified_import','synthetic_fixture')`、`status CHECK ('ok','partial','failed')`、五个计数 `integer NOT NULL DEFAULT 0`、`error text NULL`、`created_at timestamptz DEFAULT now()`；
    - 表内 `UNIQUE (source_key, kind, fetched_at)`；
    - `node scripts/check-migrations.ts --base origin/feat/integration` 通过（无 `AS`/`LIKE`/`PARTITION`）；
    - 本地应用：`npm run db:migrate` 后 `\d career_ingest_runs` 结构一致。
  - 预计产出：`feat(db): add career_ingest_runs for batch facts`（1 个 commit，仅 1 个迁移文件）。

- [ ] **T-S1-02 新增迁移 `0157_career_jobs_data_origin.sql`**
  - 目标：让 `data_origin` 从写死字面量变成真实列（D01-09 的写入载体）。
  - 负责：D
  - 文件/写集：`modules/career-insights/migrations/0157_career_jobs_data_origin.sql`
  - 前置：T-S1-01
  - 验收：
    - 单条 `ALTER TABLE career_jobs ADD COLUMN data_origin text NOT NULL DEFAULT 'live'`（常量默认值，符合迁移安全）；
    - 存量 70 行自动为 `live`；`SELECT data_origin, count(*) FROM career_jobs GROUP BY 1` 全部 `live`；
    - 迁移安全检查通过。
  - 预计产出：`feat(db): add career_jobs.data_origin`（1 个 commit）。

- [ ] **T-S1-03 新增迁移 `0158_career_job_observations_batch.sql`**
  - 目标：把观测关联到批次，使"快照 = 批次内 `job_id` 集合"可计算。
  - 负责：D
  - 文件/写集：`modules/career-insights/migrations/0158_career_job_observations_batch.sql`
  - 前置：T-S1-01
  - 验收：
    - 单条 `ALTER TABLE career_job_observations ADD COLUMN batch_id uuid`（可空、不加外键）；
    - 存量行 `batch_id IS NULL` 且读取不受影响（`SELECT count(*) FROM career_job_observations WHERE batch_id IS NULL` = 存量行数）；
    - 迁移安全检查通过。
  - 预计产出：`feat(db): link observations to ingest runs`（1 个 commit）。

- [ ] **T-S1-04 新增迁移 `0159_career_ingest_runs_source_idx.sql`**
  - 目标：批次按来源 + 时间倒序查询走索引（来源覆盖、最近两批）。
  - 负责：D
  - 文件/写集：`modules/career-insights/migrations/0159_career_ingest_runs_source_idx.sql`
  - 前置：T-S1-01
  - 验收：
    - 单条 `CREATE INDEX CONCURRENTLY IF NOT EXISTS career_ingest_runs_source_idx ON career_ingest_runs (source_key, fetched_at DESC)`；
    - 不与其他迁移文件合并；
    - `EXPLAIN` 走该索引（样例查询：按 `source_key` 取最近 2 条 `status='ok'`）。
  - 预计产出：`feat(db): index ingest runs by source and time`（1 个 commit）。

- [ ] **T-S1-05 S1 迁移门禁与旧库 schema 核验**
  - 目标：确认 4 个新迁移可过安全检查，且旧库（A-02 风险）不因历史 `0153` 漂移导致写入失败。
  - 负责：D
  - 文件/写集：无业务文件；记录进 `docs/roadmaps/career-api-roadmap.md`
  - 前置：T-S1-01～T-S1-04
  - 验收：
    - `node scripts/check-migrations.ts --base origin/feat/integration` 通过；
    - `SELECT column_name, is_identity, column_default FROM information_schema.columns WHERE table_name='career_job_observations' AND column_name='id'` 与 fresh migration 一致（非 `bigserial` 漂移）；
    - 如有漂移：记录"需重建库"结论，不继续数据验收。
  - 预计产出：`docs(roadmap): record S1 migration gates`（1 个 commit）。

### 4.2 批次记录与写入链路（不重写既有 upsert 语义）

- [ ] **T-S1-06 新增 `backend/run-repository.ts`（批次记录读写）**
  - 目标：批次以 `running` 先落库，失败也留下事实；成功后落计数与状态。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/run-repository.ts`（新增）+ `backend/repository.ts`（新增内部方法签名）
  - 前置：T-S1-01 已应用
  - 验收：
    - 提供 `startRun({kind, source_key, fetched_at, collector_version, data_origin})` 与 `finishRun({id, status, counts, error})`；
    - 幂等：相同 `(source_key, kind, fetched_at)` 重复 `startRun` 走 `ON CONFLICT DO NOTHING` 并返回既有 `id`，不新增行；
    - `error` 只写原因文本，不含堆栈/密钥；
    - `npx tsc -p modules/tsconfig.json` 通过。
  - 预计产出：`feat(api): add ingest run repository`（1 个 commit）。

- [ ] **T-S1-07 `ingest.ts` 补 `data_origin` 与 `batch_id`（不改幂等语义）**
  - 目标：职位 upsert 与观测写入携带批次信息，`first_seen_at`/`content_hash` 语义不变。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/ingest.ts`
  - 前置：T-S1-02、T-S1-03、T-S1-06
  - 验收：
    - `writeJob` 接受 `{data_origin, batchId}` 参数，`INSERT`/`UPDATE` 写入 `data_origin`，观测 `INSERT` 写 `batch_id`；
    - 内容哈希相同仍只 `GREATEST(last_seen_at)`；不同则更新但 `first_seen_at` 不变；
    - 观测仍 `ON CONFLICT (job_id, observed_at, content_hash) DO NOTHING`；
    - `ingestBatch` 对外签名与返回 `IngestResultV1` 不变（新增可选上下文参数，默认 `live`/`null`）；
    - `npx tsc -p modules/tsconfig.json` + 既有 ingest 测试通过。
  - 预计产出：`feat(api): carry data_origin and batch id through ingest`（1 个 commit）。

- [ ] **T-S1-08 读侧返回真实 `data_origin`（summary / jobs / detail）**
  - 目标：去掉 `summary.ts:277`、`sql-repository.ts:159,189` 的写死 `"live"`，按当前样本集聚合。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`、`backend/sql-repository.ts`
  - 前置：T-S1-07（类型 `DataOrigin` 已三值，**无需改 `contracts/`**）
  - 验收：
    - 规则：全部 `live` → `live`；全部 `verified_import` → `verified_import`；混合 → 返回 `verified_import` 并在 `warnings` 追加明确说明（不得静默）；
    - 库内 `data_origin` 均为 `live` 时，三个 API 返回 `live`（行为与现状一致，证明未回归）；
    - 手工 `UPDATE` 一条为 `verified_import` → summary 返回 `verified_import` + warning，验收后回滚该行；
    - 响应中不出现 `"synthetic_fixture"`（正式库不得含）。
  - 预计产出：`feat(api): return real data_origin from read path`（1 个 commit）。

### 4.3 真实数据入库、幂等与门禁验收

- [ ] **T-S1-09 真实职位入库与读回（3 家，含批次事实）**
  - 目标：真实职位经 DB → API 全字段读回，并留下批次记录。
  - 负责：D（采集执行依赖 B 的脚本已提交，见 BLK-06）
  - 文件/写集：无业务文件；数据写入本地 PostgreSQL
  - 前置：T-S1-01～T-S1-08；BLK-06 允许采集脚本可用（否则本任务记为"受阻"，只用既有 70 条做读回）
  - 验收：
    - `node scripts/collect-career.ts tencent-official-careers xiaomi-official-careers netease-official-careers` 成功（脚本属 B，D 只运行、不提交）；
    - `select count(*) jobs, count(distinct source_key) sources, count(distinct company_name) companies from career_jobs;` → `jobs>0`、`sources>=3`、`companies>=3`；
    - `select source_key, fetched_at, status, accepted, updated, duplicates from career_ingest_runs where kind='jobs' order by fetched_at desc;` → 至少 3 条 `status='ok'`，计数与采集输出一致；
    - `GET /api/site/career-insights/summary`：`sample_size>0`、`company_count>=3`、`source_count>=3`、`data_origin=live`；
    - `GET /jobs`：`items` 非空、`total` 与分页一致；任取 `id` 打开 `/jobs/:id`，观测 ≥1 条、`official_url` 可打开、无 `raw_text`；
    - 覆盖局限（网易仅首批）写入路线图（BLK-07）。
  - 预计产出：`docs(roadmap): record S1 real data ingest`（1 个 commit；数据本身不入库版本控制）。

- [ ] **T-S1-10 幂等去重验收（连续两次采集不翻倍）**
  - 目标：证明 `(source_key, job_key)` 与 `(job_id, observed_at, content_hash)` 幂等未被破坏。
  - 负责：D
  - 文件/写集：无业务文件；记录进路线图
  - 前置：T-S1-09
  - 验收：
    - 同一来源连续执行两次（同 `fetched_at` 重试场景：`accepted=0`、`duplicates` 全量；不同 `fetched_at`：职位数不翻倍）；
    - `select job_id, observed_at, content_hash, count(*) from career_job_observations group by 1,2,3 having count(*)>1;` 返回 0 行；
    - 相同 `(source_key, kind, fetched_at)` 重跑不新增 `career_ingest_runs` 行；
    - 两次运行前后职位总数对比写入路线图。
  - 预计产出：`docs(roadmap): record S1 idempotency evidence`（1 个 commit）。

- [ ] **T-S1-11 UTC `Z` 时间口径复核**
  - 目标：所有对外时间戳为 UTC ISO-8601 且以 `Z` 结尾，批次时间不例外。
  - 负责：D
  - 文件/写集：如发现序列化缺口则改 `backend/sql-repository.ts` / `backend/summary.ts`（D 写集）
  - 前置：T-S1-09
  - 验收：
    - 遍历 `summary`/`jobs`/`jobs/:id` 响应：`as_of`、`first_observed_at`、`last_observed_at`、`observed_at`、`first_seen_at`、`last_seen_at` 全部匹配 `Z$`；
    - 批次 `fetched_at` 同样匹配（通过内部查询验证）；
    - 不存在 `+08:00` 偏移、不存在毫秒格式不一致；
    - 职位 `published_at` 仅原样输出或 `null`，不得回填采集时间。
  - 预计产出：`fix(api): keep all timestamps UTC Z`（如无需改动则与 T-S1-10 合并记录）。

- [ ] **T-S1-12 `--require-data` 正向/空库反向验收**
  - 目标：真实库必须通过、空库必须失败（D01-06）。
  - 负责：D（门禁脚本属 A，见 BLK-06/BLK-09；D 只执行与留证）
  - 文件/写集：无业务文件；记录进路线图
  - 前置：T-S1-09
  - 验收：
    - 正向：`node scripts/check-career-integration.ts --base http://localhost:3000 --require-data` → 全绿、`exit 0`；
    - 反向：新建空库（或 `truncate career_jobs, career_job_observations, career_ingest_runs` 后恢复）→ 同一命令 `exit 1`，并输出具体原因（`sample_size=0`、`items` 为空）；
    - 反向测试后恢复真实数据并复跑正向，确保 `exit 0`；
    - 两次输出原文粘贴进路线图。
  - 预计产出：`docs(roadmap): record require-data positive and negative checks`（1 个 commit）。

### 4.4 依赖契约/写集的增补（受阻项，单列）

- [ ] **T-S1-13 契约增量提案：`source_coverage?` / `snapshot_count?`（D 起草，A 落地）**
  - 目标：让来源覆盖与快照数可被 API 表达，供 E 隐藏/展示变化类信息。
  - 负责：D（提案与受影响清单）→ A（修改 `contracts/api.ts`）
  - 文件/写集：D 不写 `contracts/`，只在 PR 描述/路线图给出提案；A 修改 `contracts/**`
  - 前置：BLK-09 拍板
  - 验收：
    - 提案含字段定义、可选性、排序（`source_key` 升序）、旧客户端兼容说明；
    - A 落地后 `npm run typecheck` 通过，`SummaryResponseV1` 含两字段；
    - 若 A 拒绝：本任务转"不做"，T-S1-14 与 T-S3-04 一并降级并在路线图说明。
  - 预计产出：提案文本（不计 commit）；A 侧 `feat(contracts): add optional source_coverage and snapshot_count`。

- [ ] **T-S1-14 实现 `listRunCoverage` 与 `summary.source_coverage`（**受阻：等 T-S1-13**）**
  - 目标：按来源输出最近成功/尝试时间、当前职位数、状态（`ok`/`failed`/`stale`）。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/run-repository.ts`、`backend/summary.ts`、`backend/sql-repository.ts`
  - 前置：T-S1-13（契约字段存在）、T-S1-09
  - 验收：
    - 一次查询批量取回（禁止每源一次查询）；
    - `status='failed'` 的批次不推进 `last_seen_at`，且该来源 `status='failed'`；
    - 返回按 `source_key` 升序；无批次历史的来源 `last_ok_at=null`（不伪造时间）；
    - 模拟一个来源失败 → summary 出现 `source_failed` warning，该来源职位仍在库（D02-09 前置能力）。
  - 预计产出：`feat(api): expose source coverage from ingest runs`（1 个 commit）。

- [ ] **T-S1-15 后端测试（`tests/**` 写集待确认，BLK-06）**
  - 目标：覆盖批次幂等、`data_origin` 传播、读写回归。
  - 负责：D
  - 文件/写集：`modules/career-insights/tests/`（云端 ROADMAP 未列，**需队长确认后才可提交**）
  - 前置：T-S1-06～T-S1-08
  - 验收：
    - 用例：同 `(source_key,kind,fetched_at)` 两次 `startRun` 只 1 行；`data_origin=verified_import` 批次 → summary 返回 `verified_import` + warning；观测 `batch_id` 落库且重复写入不新增；
    - `DATABASE_URL=postgres://127.0.0.1:5432/aihot_test npm test` 全通过；
    - 若 BLK-06 未批准：用例只在本地临时目录运行，不提交。
  - 预计产出：`test(career): cover ingest runs and data_origin`（1 个 commit，待批准）。

### 4.5 S1 阶段出口

> **本地 review PASS → 更新路线图 → 推 `feat/career-api-d2` → 才进入 S2。**

- review 检查项（逐条留输出）：
  1. `npm run typecheck`；
  2. `npx tsc -p modules/tsconfig.json`；
  3. `npm run test:standalone`；
  4. `npm run build -w @aihot/web` + `npm run test:web`（确认没有前端回归，D 不改前端）；
  5. 迁移安全：`node scripts/check-migrations.ts --base origin/feat/integration`；
  6. `node scripts/smoke.ts --base http://localhost:3000`；
  7. `node scripts/check-career-integration.ts --base http://localhost:3000`；
  8. `node scripts/check-career-integration.ts --base http://localhost:3000 --require-data`（正向）；
  9. 空库反向必须 `exit 1`（本节 T-S1-12 已留证）；
  10. 写集隔离（T-S0-05 模板）无输出；`git diff` 无 B 的 `collector/*`、`scripts/collect-career.ts`。
- 出口动作：更新路线图 S1 记录 → `git push origin feat/career-api-d2` → 进入 S2。

---

## 5. S2 D-02 政策证据与共同方向（15 个任务）

### 5.1 迁移（一文件一语句）

- [ ] **T-S2-01 新增迁移 `0160_career_policies.sql`（政策表）**
  - 目标：政策独立成域，字段与 `PolicyEvidenceRefV1` 一一对应。
  - 负责：D
  - 文件/写集：`modules/career-insights/migrations/0160_career_policies.sql`
  - 前置：BLK-02 批准（可先本地编写）；T-S1 阶段 PASS
  - 验收：
    - 单条 `CREATE TABLE career_policies`，字段：`id uuid PK`、`policy_item_id text NOT NULL`、`source_key text NOT NULL`、`source_tier text CHECK ('government_official','official_media','other_public')`、`title`、`issuer`、`published_at date NULL`、`official_url`、`theme_ids jsonb NOT NULL DEFAULT '[]'`、`evidence_excerpt text NOT NULL`、`content_hash`、`collector_version`、`data_origin`（三值 CHECK）、`fetched_at timestamptz`、`first_seen_at`/`last_seen_at`、`created_at`/`updated_at`；
    - 表内 `UNIQUE (source_key, policy_item_id)`；
    - `published_at` 可空且**不设**默认值（禁止用采集时间冒充）；
    - 迁移安全检查通过；`\d career_policies` 与设计表 2 一致。
  - 预计产出：`feat(db): add career_policies table`（1 个 commit）。

- [ ] **T-S2-02 新增迁移 `0161_career_policies_theme_idx.sql`**
  - 目标：主题对照查询使用 GIN 索引。
  - 负责：D
  - 文件/写集：`modules/career-insights/migrations/0161_career_policies_theme_idx.sql`
  - 前置：T-S2-01
  - 验收：
    - 单条 `CREATE INDEX CONCURRENTLY IF NOT EXISTS career_policies_theme_idx ON career_policies USING gin (theme_ids)`；
    - 迁移安全检查通过。
  - 预计产出：`feat(db): index policy themes`（1 个 commit）。

- [ ] **T-S2-03 新增迁移 `0162_career_policies_published_idx.sql`**
  - 目标：政策按发布日期倒序排序高效。
  - 负责：D
  - 文件/写集：`modules/career-insights/migrations/0162_career_policies_published_idx.sql`
  - 前置：T-S2-01
  - 验收：
    - 单条 `CREATE INDEX CONCURRENTLY IF NOT EXISTS career_policies_published_idx ON career_policies (published_at DESC NULLS LAST)`；
    - `NULLS LAST` 保证"发布日期未知"排在末尾；
    - 迁移安全检查通过。
  - 预计产出：`feat(db): order policies by published date`（1 个 commit）。

- [ ] **T-S2-04 S2 迁移门禁**
  - 目标：确认 3 个政策迁移可过检查且可回滚。
  - 负责：D
  - 文件/写集：无；记录进路线图
  - 前置：T-S2-01～T-S2-03
  - 验收：
    - `node scripts/check-migrations.ts --base origin/feat/integration` 通过；
    - `DROP TABLE IF EXISTS career_policies` 可在测试库执行（回滚路径可用），执行后重建；
    - 与同期角色编号冲突时：只重排未部署文件编号，不改已部署文件（BLK-02）。
  - 预计产出：`docs(roadmap): record S2 migration gates`（1 个 commit）。

### 5.2 政策写入与读取

- [ ] **T-S2-05 `backend/policy-repository.ts`：`writePolicyBatch`（幂等 + 逐条校验）**
  - 目标：政策批次入库，非法条目只计 `rejected`，不整批失败。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/policy-repository.ts`（新增）、`backend/repository.ts`（内部方法签名）
  - 前置：T-S2-01 已应用
  - 验收：
    - 批次类型暂定义在 `backend/policy-repository.ts` 内部（**不写 `contracts/`**），字段与设计 §2.2.2 一致；
    - 校验：`published_at` 非 `^\d{4}-\d{2}-\d{2}$` → `rejected`（`path: message`）；`theme_ids` 不在 `THEME_KEYWORDS` 键集合 → `rejected`；`source_tier` 非法 → `rejected`；`official_url` 非官方域名 → `rejected`（或按白名单登记）；
    - 重复导入：`(source_key, policy_item_id)` 已存在且 `content_hash` 相同 → `duplicates`，`last_seen_at` 推进、`first_seen_at` 不变；
    - 返回 `IngestResultV1` 同形结构；写一条 `career_ingest_runs`（`kind='policy'`）；
    - `npx tsc -p modules/tsconfig.json` 通过。
  - 预计产出：`feat(api): add policy batch writer`（1 个 commit）。

- [ ] **T-S2-06 `listPolicyEvidence`（批量、排序、上限 50）**
  - 目标：`summary` 一次取回全部政策证据，避免 N+1。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/policy-repository.ts`、`backend/repository.ts`
  - 前置：T-S2-05
  - 验收：
    - 一次 SQL 返回 `PolicyEvidenceRefV1[]`（字段 `policy_item_id/title/issuer/published_at/official_url/source_tier/theme_ids/evidence_excerpt`）；
    - 排序 `published_at DESC NULLS LAST, policy_item_id ASC`，上限 50；
    - `evidence_excerpt` 截断 ≤500 字符；不返回正文全文；
    - 另提供一次性的职位投影读取（`MetricJobInputV1` 所需字段），供 C 纯函数使用。
  - 预计产出：`feat(api): read policy evidence in one query`（1 个 commit）。

- [ ] **T-S2-07 政策真实入库：2 个官方媒体源各 ≥1 条（BLK-03 决定口径）**
  - 目标：政策有真实样本，`source_tier=official_media` 且可点回原文。
  - 负责：D（入库）/B（样本采集与核验，需已提交的脚本或人工核验清单）
  - 文件/写集：无业务文件；数据写入本地库
  - 前置：T-S2-05；BLK-03 拍板；BLK-06（样本交付方式）
  - 验收：
    - `select source_key, count(*) from career_policies group by 1` → ≥2 个来源、各 ≥1 条；
    - 每条：`issuer` 非空、`published_at` 为 `YYYY-MM-DD` 或 NULL、`official_url` 可打开、`evidence_excerpt` 非空；
    - `source_tier` 全部 `official_media`（不得出现 `government_official`，除非确为政府原文）；
    - 无 `synthetic-policy-*`；
    - 若样本未到位：本任务记"受阻"，不得以 fixture 充数。
  - 预计产出：`docs(roadmap): record real policy ingest`（1 个 commit）。

### 5.3 `summary` 真实化（替换三处硬编码）

- [ ] **T-S2-08 `shared_themes` 接入 C 纯函数（不复制口径）**
  - 目标：把 `summary.ts:286` 的 `shared_themes: []` 换成真实计算。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`
  - 前置：T-S2-06
  - 验收：
    - `import { computeSharedThemes, computePolicyJobSharedThemesMetric } from "../data/metrics.ts"`（只读 import，**不改 `data/**`**）；
    - 输入：`listPolicyEvidence()` + 职位投影；不新增职位主题列（主题由 C 的 `JOB_THEME_SKILLS`/`ROLE_FAMILY_THEMES` 推导）；
    - 证据裁剪：每主题 `policies` ≤5、`jobs` ≤5；
    - 排序沿用 C 的 `job_count DESC, theme_id ASC`；
    - 只返回双侧非空的主题；`SharedThemeV1` 元素结构不变（前端 `SharedThemeList` 无需改）。
  - 预计产出：`feat(api): return real shared themes`（1 个 commit）。

- [ ] **T-S2-09 `policy_job_shared_themes` 三档语义 + 去掉写死 warning**
  - 目标：严格区分"无政策证据""有政策无共享主题""有共享主题"，删除 `summary.ts:252-261,273` 的占位。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`
  - 前置：T-S2-08
  - 验收：
    - 无政策：`shared_themes=[]`、`metric.status=insufficient_data`、`value=null`、warning `"尚未接入政策证据，共享主题暂不计算"`；
    - 有政策无交集：`insufficient_data`、`numerator_count=0`、warning `"政策与职位暂未出现同一主题，不代表无共同方向"`；
    - 有共享主题：`status=ok`、`value=null`、`numerator_count=主题数`、无 insufficient 类 warning；
    - 禁止 `status=ok` + `value=0` 表示"无共同方向"；
    - 页面文案"官方媒体解读"由 E 渲染，D 保证 `source_tier` 原样返回（BLK-03 定稿措辞）。
  - 预计产出：`feat(api): distinguish empty and no-overlap policy states`（1 个 commit）。

- [ ] **T-S2-10 空政策 `insufficient_data` 端到端验收（D02-11）**
  - 目标：空政策时必须报"证据不足"，不得静默空列表。
  - 负责：D
  - 文件/写集：无业务文件；记录进路线图
  - 前置：T-S2-09
  - 验收：
    - `truncate career_policies` 后调用 `summary` → `shared_themes=[]`、`policy_job_shared_themes.status=insufficient_data`、warning 明确；
    - 响应中无 `synthetic-policy-*`、无编造主题；
    - 恢复政策数据后复跑，`status=ok` 或 `insufficient_data`（无交集时）与库一致；
    - 两次响应摘要写入路线图。
  - 预计产出：`docs(roadmap): record empty-policy semantics`（1 个 commit）。

- [ ] **T-S2-11 非因果与无综合分约束复核（D02-07）**
  - 目标：响应与文案不出现因果结论、不计算综合分。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`（仅如缺 disclaimer 则保留 C 的 `METRIC_SPECS_V1` 文案，不新增自造句）
  - 前置：T-S2-09
  - 验收：
    - `policy_job_shared_themes.disclaimer` 含"不表示因果关系"（来自 `METRIC_SPECS_V1`）；
    - `rg -n "导致|带动|将会|预计增长|综合分" modules/career-insights/backend` → 无业务措辞命中（注释说明除外）；
    - 响应中无 `score`/`rank` 类字段；
    - 不新增增长率、环比字段。
  - 预计产出：`docs(roadmap): verify non-causal wording`（无代码改动时仅记录）。

- [ ] **T-S2-12 技能指标补 `unknown_count`/`unknown_ratio`（D02-08）**
  - 目标：`summary.ts:194-224` 的 SQL 技能路径补齐未识别技能统计。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`
  - 前置：T-S1 PASS
  - 验收：
    - 新增统计：`COUNT(*) FILTER (WHERE skills = '[]')` 作为 `unknown_count`，`unknown_ratio = unknown_count / sample_size`；
    - 附加在职业技能维度上（或至少一次，与 C 口径一致；口径差异需与 C 对齐后再定）；
    - 无技能职位数与数据库一致；`unknown` 不得补成已知技能；
    - 契约已有字段（`api.ts:36-37`），无需改 `contracts/`。
  - 预计产出：`feat(api): report unrecognized skill share`（1 个 commit）。

- [ ] **T-S2-13 `PolicyEvidenceRefV1.published_at` 可空契约（D 提案，A 落地，**受阻 BLK-09**）**
  - 目标：让"发布日期未知"可如实表达为 `null`。
  - 负责：D（提案）→ A（`contracts/job.ts`）
  - 文件/写集：D 不写 `contracts/`；仅在路线图/PR 描述给提案
  - 前置：BLK-09 拍板
  - 验收：
    - 提案：`published_at: string | null`，并说明对 `SharedThemeV1.policies`、E 渲染、测试的影响；
    - A 落地后 `npm run typecheck` 通过；NULL 政策在响应中为 `null`，前端不得显示成采集时间；
    - 若 A 拒绝：政策 `published_at` 缺失的记录**不得入库**（只入有日期的），并在路线图写明该限制。
  - 预计产出：提案文本；A 侧 `feat(contracts): allow null policy published_at`。

- [ ] **T-S2-14 政策证据性能与 N+1 复核**
  - 目标：满足 DFX 5.1.2，`summary` p95 ≤ 800 ms（100 条样本）。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`（必要时改为批量读取）
  - 前置：T-S2-08、T-S2-07
  - 验收：
    - 政策证据查询为固定次数（≤2 次），不随主题数增长；
    - 20 次请求取样，记录 p50/p95（`curl -w '%{time_total}'` 或简单脚本），写入路线图；
    - 超阈值时记录实测值并标注原因，不得省略。
  - 预计产出：`docs(roadmap): record summary latency`（1 个 commit）。

- [ ] **T-S2-15 政策/共享主题后端测试（`tests/**` 待确认，BLK-06）**
  - 目标：覆盖政策幂等、校验、层级、共享主题、空政策语义。
  - 负责：D
  - 文件/写集：`modules/career-insights/tests/`（**需确认后才提交**）
  - 前置：T-S2-05～T-S2-09
  - 验收：
    - 用例：同批次导入两次 → 第二次 `accepted=0`、行数不变；`published_at="11月17日"` → `rejected`；`source_tier` 非法 → `rejected`；政策有主题 A、职位无 A → 不返回 A；双侧有 → 返回且计数正确；空政策 → `insufficient_data` + `value=null`；
    - `npm test` 全通过；
    - 未获批准时只在本地运行，不提交。
  - 预计产出：`test(career): cover policy ingest and shared themes`（1 个 commit，待批准）。

### 5.4 S2 阶段出口

> **本地 review PASS → 更新路线图 → 推 `feat/career-api-d2` → 才进入 S3。**

- review 检查项：同 S1 的 10 项，另加：
  11. `select source_key, count(*) from career_policies group by 1` 与 summary 证据计数一致；
  12. 空政策反向验证（T-S2-10）留证；
  13. `rg "synthetic-policy" modules/career-insights/backend` 无命中；
  14. `shared_themes` 非空时逐一核对：两侧证据链接可打开、`theme_id` 在 `THEME_KEYWORDS` 内；
  15. 非因果措辞复核（T-S2-11）。
- 出口动作：更新路线图 S2 记录 → push `feat/career-api-d2` → 进入 S3。

---

## 6. S3 两个观测时点与时间口径（7 个任务）

- [ ] **T-S3-01 第二次真实采集（同一组来源，**受阻 BLK-05**）**
  - 目标：形成第二个可区分批次；不新增重复职位。
  - 负责：D（执行）/B（采集脚本与礼貌间隔）
  - 文件/写集：无业务文件；数据与批次写入本地库
  - 前置：S1 PASS；T-S1-14 或批次表可用；BLK-05 拍板间隔
  - 验收：
    - 同一组 `source_key`（tencent/xiaomi/netease）全部参与；
    - `(T2.fetched_at - T1.fetched_at) >= 30min`（或按拍板的次日同时段）；
    - `career_ingest_runs` 出现 ≥2 个同源 `status='ok'` 批次；
    - 两次采集的 `accepted/updated/duplicates` 如实记录；
    - 采集失败时：保留 T1，`has_multiple_snapshots=false`，不得伪造 T2。
  - 预计产出：`docs(roadmap): record second snapshot`（1 个 commit）。

- [ ] **T-S3-02 按批次计算快照与差集（替换全局 `DISTINCT observed_at`）**
  - 目标：`observed_new_jobs` 使用"后快照 − 前快照"的 `job_id` 差集，按 `source_key` 分别计算再并集。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`
  - 前置：T-S1-01、T-S1-03 已应用；T-S3-01（数据）
  - 验收：
    - 前/后时点取"最近两个 `status='ok'` 的 `kind='jobs'` 批次"；
    - 快照 = `career_job_observations.batch_id = run.id` 的 `job_id` 集合；
    - 差集 = `T2 \ T1`，证据只含差集中的职位；
    - 兼容旧数据：`batch_id IS NULL` 的观测按 `(source_key, observed_at)` 聚合回退，不致报错；
    - 时间比较仍用 UTC 参数化（不拼字符串）。
  - 预计产出：`feat(api): compute observed-new jobs from batch diff`（1 个 commit）。

- [ ] **T-S3-03 职位不翻倍与观测幂等复核**
  - 目标：证明第二时点只增加时点，不增加重复职位。
  - 负责：D
  - 文件/写集：无业务文件；记录进路线图
  - 前置：T-S3-02
  - 验收：
    - `select count(*) from career_jobs` 与第一次采集后一致（±内容更新）；
    - `select source_key, count(distinct observed_at) from career_job_observations group by 1` ≥2；
    - 无 `(job_id, observed_at, content_hash)` 重复；
    - 同内容重复采集不产生新观测（`ON CONFLICT DO NOTHING` 生效）。
  - 预计产出：`docs(roadmap): record snapshot idempotency`（1 个 commit）。

- [ ] **T-S3-04 单快照语义与 `snapshot_count`（依赖 T-S1-13）**
  - 目标：单时点必须 `insufficient_data` + `value=null`，`has_multiple_snapshots=false`。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`
  - 前置：T-S3-02；`snapshot_count` 若落地需 T-S1-13
  - 验收：
    - 仅有 1 个批次时：`has_multiple_snapshots=false`、`observed_new_jobs.status=insufficient_data`、`value=null`、证据为空；
    - `snapshot_count`（若契约已落地）= 参与观察窗的批次数；
    - 页面无涨跌/趋势（E 侧验证，D 只保证字段）；
    - 不把"未采集到"解释为下架（`warnings` 不得出现该语义）。
  - 预计产出：`feat(api): report snapshot count for single-snapshot guard`（依赖契约则单独 commit）。

- [ ] **T-S3-05 `value=0` 与 `insufficient_data` 严格区分（OBS-03）**
  - 目标：两个时点且无新增时返回真实 0；不足两时点返回 null。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/summary.ts`
  - 前置：T-S3-04
  - 验收：
    - 两时点、差集为空 → `status=ok`、`value=0`、`evidence=[]`、`numerator_count=0`；
    - 单时点 → `status=insufficient_data`、`value=null`（不得为 0）；
    - 不输出增长率/环比/趋势线字段。
  - 预计产出：`feat(api): separate zero from insufficient data`（可与 T-S3-04 合并）。

- [ ] **T-S3-06 批次失败语义与来源覆盖 warning（D02-09）**
  - 目标：失败批次保留事实、不推进 `last_seen_at`、不推断下架。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/run-repository.ts`、`backend/summary.ts`
  - 前置：T-S1-14（或 T-S1-06）
  - 验收：
    - 模拟一个来源失败（构造 `status='failed'` 批次或用不可达来源）：该来源 `source_coverage.status='failed'`，`last_ok_at` 保持上次成功时间；
    - 该来源职位仍在库，`last_seen_at` 未被推进；
    - summary `warnings` 出现 `source_failed`（`stale_data` 按约定间隔判定）；
    - 不出现"需求下降""职位下架"文案字段。
  - 预计产出：`feat(api): report failed sources without dropping jobs`（1 个 commit）。

- [ ] **T-S3-07 观测时点证据留存与路线图记录**
  - 目标：把两次采集的时间、来源、计数、差集结果写成可复核记录。
  - 负责：D
  - 文件/写集：`docs/roadmaps/career-api-roadmap.md`
  - 前置：T-S3-01～T-S3-05
  - 验收：
    - 记录 T1/T2 时间（UTC Z）、来源、`accepted/updated/duplicates`、职位总数、`observed_new_jobs` 结果与证据 ID；
    - 记录间隔是否满足拍板要求（不足时显式标注"观察窗过短"）；
    - 记录 `has_multiple_snapshots`、`snapshot_count` 实测值。
  - 预计产出：`docs(roadmap): record two-snapshot evidence`（1 个 commit）。

### 6.1 S3 阶段出口

> **本地 review PASS → 更新路线图 → 推 `feat/career-api-d2` → 才进入 S4。**

- review 检查项：S1 的 10 项 + `has_multiple_snapshots=true` 实测 + 差集与证据一致 + 单时点反向验证（临时隐藏 T2 或截断观测，确认回到 `insufficient_data`）。
- 出口动作：更新路线图 S3 记录 → push → 进入 S4。

---

## 7. S4 契约 1.0 提案与品牌验收（9 个任务）

### 7.1 契约（A 主持，D 提供清单）

- [ ] **T-S4-01 契约 `1.0` 提案清单（D 起草，**可立即开工**）**
  - 目标：把"真实政策 + 两个时点 + 空态语义"验收结果转成可执行的契约变更清单。
  - 负责：D（清单/PR 描述）
  - 文件/写集：不写 `contracts/`；清单放 `docs/roadmaps/career-api-roadmap.md` 或 PR 描述
  - 前置：S1–S3 PASS
  - 验收：
    - 清单含：受影响类型（`SummaryResponseV1.contract_version`、`source_coverage?`、`snapshot_count?`、`CareerPolicyBatchV1`/`CareerPolicyItemV1`、`PolicyEvidenceRefV1.published_at` 可空）、OpenAPI、测试、门禁期望值（`CAREER_CONTRACT_VERSION`）、B/C/D/E 影响说明；
    - 每项标注"新增可选/类型放宽/版本升级"，并确认无删除、改名、改指标含义；
    - 冻结触发条件写明：政策表 + `shared_themes` 真实证据 + 两个观测时点三项全绿。
  - 预计产出：`docs(roadmap): propose contract 1.0 changes`（1 个 commit）。

- [ ] **T-S4-02 [A] `contracts/` 落到 1.0（类型与版本）（**受阻 BLK-09**）**
  - 目标：`contract_version` 从 `"0.1"` 升级并补齐字段。
  - 负责：A
  - 文件/写集：`modules/career-insights/contracts/**`（A 独占）
  - 前置：T-S4-01 被接受；BLK-09 拍板
  - 验收：
    - `SummaryResponseV1`/`JobListResponseV1`/`JobDetailResponseV1` 的 `contract_version` 为 `"1.0"`；
    - 新增可选字段 `source_coverage?`、`snapshot_count?`；
    - `CareerPolicyBatchV1`/`CareerPolicyItemV1` 入契约并导出；
    - `npm run typecheck` 通过；D 侧实现随类型同步（D 另 commit）。
  - 预计产出：A 侧 `feat(contracts): freeze career contract 1.0`。

- [ ] **T-S4-03 [A] OpenAPI、门禁期望值与测试同步（**受阻 BLK-09/BLK-06**）**
  - 目标：契约文件、`openapi.json`、`check-career-integration` 期望值、测试一致。
  - 负责：A（D 提供受影响清单）
  - 文件/写集：`contracts/openapi.json`、`scripts/check-career-integration.ts`（A 维护）
  - 前置：T-S4-02
  - 验收：
    - OpenAPI 与实际响应一致（含可选字段）；
    - 门禁支持 `CAREER_CONTRACT_VERSION` 期望 `1.0`；加严 `source_count>=3`、`company_count>=3`、政策侧就绪（T-S1-13 列出的 5 项）；
    - 空库 `--require-data` 仍 `exit 1`；
    - D 侧 `summary` 返回 `1.0` 后门禁通过。
  - 预计产出：A 侧 `feat(gate): align gates with contract 1.0`。

### 7.2 品牌（归属待裁定，D 只交清单与验收结论）

- [ ] **T-S4-04 品牌配置差异清单（D 产出，**可立即开工**）**
  - 目标：把"改什么、改成什么、影响哪些面"写成可直接执行的清单，交 A 或经授权执行。
  - 负责：D（清单）/A（执行，见 BLK-01）
  - 文件/写集：不修改 `site/**`；清单进路线图或 PR 描述
  - 前置：无（可先按工作名"就业HOT"起草，定稿随 BLK-04）
  - 验收：
    - 清单覆盖 `site/site.ts`：`name`(:23)、`subject`(:28)、`homeTitle`(:30)、`description`(:40)、`tagline`(:44)、`keywords`(:46)、`footerNote`(:73)、`poweredBy`(:81)、`organization.name`(:84)、`crawlerName`(:89)；`mcpPrefix`(:64)、`interfaceVersion`(:69) 标注"不改"；
    - 覆盖 `site/changelog.json:10`；
    - 标注 `site/brand/**` 需人工目视确认是否含上游 Logo（代码层 grep 无文字残留）；
    - 每条注明"由 A 执行 / 待授权 D 执行"，且**不与后端改动同 commit**。
  - 预计产出：`docs(roadmap): list brand config diffs`（1 个 commit）。

- [ ] **T-S4-05 [A/待裁定] `site/site.ts` 品牌值与定位（**不可开工：BLK-01/BLK-04/BLK-10**）**
  - 目标：站名、定位、描述、派生标识全部走 `SITE` 单点。
  - 负责：A（路径 A）或经书面授权的 D（路径 B，单 commit）
  - 文件/写集：`site/site.ts`
  - 前置：BLK-01、BLK-04、BLK-10 拍板
  - 验收：
    - `name`/`organization.name`/`homeTitle`/`crawlerName` 使用定稿站名（工作名"就业HOT"、`JiuYeHOTBot/1.0`）；
    - `subject`→"就业"、`description`/`tagline`/`keywords` 指向就业与岗位/政策证据，不含预测或保证性结论；
    - `footerNote`/`poweredBy` 按 BLK-10 结论处理（移除或非品牌化）；
    - `mcpPrefix`/`interfaceVersion` 不变；
    - `npm run build -w @aihot/web` 通过，首页/关于/分享图/`llms.txt`/RSS/后台标题同步变化。
  - 预计产出：`feat(site): switch brand to employment positioning`（1 个 commit，仅品牌文件）。

- [ ] **T-S4-06 [A/待裁定] `site/changelog.json` 去 AIHOT（**不可开工：BLK-01**）**
  - 目标：更新日志不再出现 AIHOT。
  - 负责：A（或授权 D 单独 commit）
  - 文件/写集：`site/changelog.json`
  - 前置：BLK-01
  - 验收：`rg -n "AIHOT|aihot" site/changelog.json` 无命中；更新日志仍可读、日期与条目结构合法。
  - 预计产出：`fix(site): remove upstream brand from changelog`（1 个 commit）。

- [ ] **T-S4-07 [A] `site/brand/**` 图形确认与替换（**不可开工：BLK-01**）**
  - 目标：确认 favicon/icon/分享图是否含上游 Logo，必要时替换为原创图形。
  - 负责：A（二进制资源，D 不碰）
  - 文件/写集：`site/brand/**`
  - 前置：BLK-01
  - 验收：目视确认记录（含文件清单与结论）；替换后构建产物 favicon/分享图正常；不复用 AIHOT Logo。
  - 预计产出：`feat(brand): replace upstream logo assets`（1 个 commit）。

- [ ] **T-S4-08 品牌验收（**不可开工：依赖 T-S4-05～T-S4-07**）**
  - 目标：读者可见面无 AIHOT、无 `MyHOT`，归属声明保留在非读者界面。
  - 负责：D（验收执行与留证）/A（修复）
  - 文件/写集：无；记录进路线图
  - 前置：T-S4-05、T-S4-06、T-S4-07
  - 验收：
    - `rg -n "MyHOT" site apps packages modules --glob '!**/build/**' --glob '!**/node_modules/**'` → **0 命中**；
    - `rg -n "AIHOT|aihot\.news" site apps packages modules --glob '!**/build/**' --glob '!**/node_modules/**'` → 仅 `LICENSE`/`NOTICE`/`README*`/`docs/` 命中；`site/site.ts`、`site/changelog.json` 无命中；
    - `curl -s http://localhost:3000/ | rg -o "就业HOT|AIHOT|MyHOT" | sort -u` 仅新站名；
    - `/about`、`/llms.txt`、`/feed.xml` 抽查无旧名；
    - `LICENSE`/`NOTICE` 归属声明仍在（未误删）。
  - 预计产出：`docs(roadmap): record brand acceptance`（1 个 commit，由验收方提交）。

- [ ] **T-S4-09 `mcpPrefix` 显式决策记录（**定稿需 BLK-08**）**
  - 目标：把"接口标识不随品牌变动"变成书面决策，避免下次争议。
  - 负责：D（记录）/A（确认）
  - 文件/写集：`docs/roadmaps/career-api-roadmap.md`
  - 前置：BLK-08
  - 验收：
    - 记录默认决策：保持 `myhot`，P1 再评估；理由（外部 Agent 配置兼容、`interfaceVersion` 语义）；
    - 若改：列旧→新工具名映射、需升主版本、单独立项（不在本次评审）；
    - 记录 `interfaceVersion` 不改。
  - 预计产出：`docs(roadmap): record mcpPrefix decision`（1 个 commit）。

### 7.3 S4 阶段出口

> **本地 review PASS → 更新路线图 → 推 `feat/career-api-d2` → 才进入 S5。**

- review 检查项：
  1. 契约一致性：`npm run typecheck`、OpenAPI 与响应抽样一致、门禁期望值 `1.0`；
  2. 品牌：`MyHOT` 0 命中、AIHOT 仅非读者界面、构建后页面抽查通过；
  3. S1–S3 全部门禁复跑（typecheck / standalone / web / migration safety / smoke / career integration / `--require-data`）；
  4. 写集隔离：品牌改动（若由 D 执行）为独立 commit 且经书面授权记录。
- 出口动作：更新路线图 S4 记录 → push → 进入 S5；契约冻结由 A 在合并时执行。

---

## 8. S5 联调与缺陷（5 个任务，只修缺陷）

- [ ] **T-S5-01 全门禁复跑**
  - 目标：一次完整复跑，确认前四阶段无回归。
  - 负责：D
  - 文件/写集：无（只修缺陷时改 D 写集）
  - 前置：S4 PASS
  - 验收（全部留输出）：
    - `npm run typecheck`
    - `npx tsc -p modules/tsconfig.json`
    - `npm run test:standalone`
    - `DATABASE_URL=postgres://127.0.0.1:5432/aihot_test npm test`
    - `npm run build -w @aihot/web && npm run test:web`
    - `node scripts/check-migrations.ts --base origin/feat/integration`
    - `node scripts/smoke.ts --base http://localhost:3000`
    - `node scripts/check-career-integration.ts --base http://localhost:3000`
    - `node scripts/check-career-integration.ts --base http://localhost:3000 --require-data`
  - 预计产出：`docs(roadmap): record S5 full gates`（1 个 commit）。

- [ ] **T-S5-02 性能实测与记录**
  - 目标：`summary` p95 ≤ 800 ms、`jobs` p95 ≤ 500 ms（100 条样本，本地 Docker）。
  - 负责：D
  - 文件/写集：仅在超阈值时优化 `backend/summary.ts`/`sql-repository.ts`
  - 前置：T-S5-01
  - 验收：20 次取样记录 p50/p95；超阈值时写明实测值与原因，不得省略；证据查询次数不随维度线性增长。
  - 预计产出：`docs(roadmap): record p95 latency` 或 `perf(api): batch evidence queries`（1 个 commit）。

- [ ] **T-S5-03 503 语义与错误态复核**
  - 目标：数据库不可用时返回 `503 data_unavailable`，不得返回空列表或 200。
  - 负责：D
  - 文件/写集：`modules/career-insights/backend/sql-repository.ts`（如缺陷在 D 写集）
  - 前置：T-S5-01
  - 验收：
    - 停库或用错误 `DATABASE_URL` 启动 → 三个 GET 均 `503 data_unavailable`，非 200/空数组；
    - 迁移未应用（缺表）→ 同样 503，不泄露堆栈；
    - 非法 UUID 仍 `400 invalid_parameter`；
    - 恢复后复跑 T-S5-01 关键项。
  - 预计产出：`fix(api): keep 503 semantics on unavailable database`（如无缺陷则不产生 commit）。

- [ ] **T-S5-04 E 联调缺陷修复（只修缺陷，不加功能）**
  - 目标：修复真实数据下页面/接口暴露的 P0 缺陷。
  - 负责：D（后端缺陷）/E（前端缺陷）
  - 文件/写集：D 只改 `backend/**`；`web/**` 属 E
  - 前置：T-S5-01
  - 验收：每条缺陷有"现象 → 根因 → 修复 → 复验命令"记录；不新增查询参数、不改指标含义；修完复跑 T-S5-01。
  - 预计产出：按缺陷单独 commit（`fix(api): …`），不夹带功能。

- [ ] **T-S5-05 收尾记录与 PR 描述**
  - 目标：把范围、命令、结论、遗留、数据真实性写成可交接记录。
  - 负责：D
  - 文件/写集：`docs/roadmaps/career-api-roadmap.md`
  - 前置：T-S5-01～T-S5-04
  - 验收：记录含阶段表状态、9 条门禁结果、真实数据来源与条数、两次采集时间、政策来源与层级、遗留阻塞（BLK-01/03/04/05/06/08/09）、"不做项"清单；PR 目标为 `feat/integration`，由 A 合并。
  - 预计产出：`docs(roadmap): close career api d2`（1 个 commit）。

### 8.1 S5 阶段出口

> **本地 review PASS → 更新路线图 → 推 `feat/career-api-d2`（**本阶段为最后一次推送**）→ 提 PR 给 A。**

- review 检查项：T-S5-01 的 9 条命令全绿 + 性能留证 + 503 语义留证 + 缺陷清单闭环 + 无越界文件。
- 不推 `main`，不直接合 `feat/integration`；合并由 A 执行（GIT-05/GIT-10）。

---

## 9. 依赖关系

```text
S0-01 → S0-02 → S0-03 → S0-04 → S0-05
                                   ↓
S1-01 ─┬→ S1-02 ─┐                 │
S1-03 ─┤         ├→ S1-07 → S1-08 → S1-09 → S1-10 → S1-11 → S1-12
S1-04 ─┘         │        ↓
S1-06 ───────────┘        S1-15（需 BLK-06）
      └→ S1-13（BLK-09）→ S1-14 →（S3-06）

S2-01 → S2-02/S2-03 → S2-04
   └→ S2-05 → S2-06 → S2-08 → S2-09 → S2-10 / S2-11
                  └→ S2-07（需 BLK-03/BLK-06）
S2-12（依赖 S1）、S2-13（BLK-09）、S2-14、S2-15（BLK-06）

S3-01（BLK-05）→ S3-02 → S3-03 → S3-04 → S3-05
                          └→ S3-06 → S3-07

S4-01（可先写）→ S4-02（BLK-09/A）→ S4-03（A）
S4-04（可先写）→ S4-05/06/07（BLK-01/04/10，A）→ S4-08
S4-09（BLK-08）

S5-01 → S5-02 / S5-03 / S5-04 → S5-05
```

**串行红线**：S1 未 PASS 不得进 S2；S2 未 PASS 不得进 S3（`shared_themes` 与观测口径会互相污染）；S4 的契约冻结必须在前三阶段全绿之后。

---

## 10. 附录 A：每阶段固定命令清单

| # | 命令 | 用途 | 期望 |
|---|---|---|---|
| 1 | `npm run typecheck` | 全仓 TS | 0 error |
| 2 | `npx tsc -p modules/tsconfig.json` | career 模块独立检查 | 0 error |
| 3 | `npm run test:standalone` | 无库单元测试 | 全通过（311+） |
| 4 | `DATABASE_URL=postgres://127.0.0.1:5432/aihot_test npm test` | 含库集成测试 | 全通过 |
| 5 | `npm run build -w @aihot/web && npm run test:web` | 前端构建与测试 | 成功 |
| 6 | `node scripts/check-migrations.ts --base origin/feat/integration` | 迁移不可变 + 在线安全 | 打印 `migration history and online safety checked` |
| 7 | `node scripts/smoke.ts --base http://localhost:3000` | 通用站点 smoke | 全通过 |
| 8 | `node scripts/check-career-integration.ts --base http://localhost:3000` | 预数据模式 | 全通过 |
| 9 | `node scripts/check-career-integration.ts --base http://localhost:3000 --require-data` | 真实数据模式 | S1 起全通过；空库必须 `exit 1` |
| 10 | `git diff origin/feat/integration...HEAD --name-only \| rg -v '^modules/career-insights/(server\.ts\|backend/\|migrations/)'` | 写集隔离 | 无输出 |

---

## 11. 附录 B：需求覆盖矩阵（P0 全覆盖）

| 需求 | 主责任务 | 需求 | 主责任务 |
|---|---|---|---|
| BRAND-01 | T-S4-04 / S4-05 / S4-08 | D02-01 | S2-01 / S2-05 / S2-07 |
| BRAND-02 | S4-04 / S4-05 | D02-02 | S2-07 |
| BRAND-03 | S4-05 / S4-08 | D02-03 | S2-07 / S2-13 |
| BRAND-04 | S4-06 / S4-07 / S4-08 | D02-05 | S2-08 |
| BRAND-05 | S4-05 / S4-08 | D02-06 | S2-09 / S2-10 |
| BRAND-06 | S4-04 / S4-08 | D02-07 | S2-11 |
| BRAND-07（P1） | S4-09 | D02-08 | S2-12 |
| D01-01 | S1-09 | D02-09 | S3-06 |
| D01-02 | S1-10 | D02-10 | S2-06 / S2-13 |
| D01-03 | S1-08 / S1-09 / S1-12 | D02-11 | S2-09 / S2-10 |
| D01-04 | S1-08 / S1-09 | D02-12 | S4-01 / S4-02 / S4-03 |
| D01-05 | S1-09（详情观测与摘录） | OBS-01 | S3-01 |
| D01-06 | S1-12（A 加严见 S4-03） | OBS-02 | S3-02 / S3-03 |
| D01-07 | S1-09（D 交付 API，页面归 E） | OBS-03 | S3-05 |
| D01-08 | S3-04 | OBS-04 | S1-11 / S2-13 |
| D01-09 | S1-07 / S1-08 | OBS-05 | E（D 保证字段语义） |
| D01-10 | S1 全阶段"不改既有语义"检查 | OBS-06 | S3-03 / S3-07 |
| GIT-01 | S0-01 / S0-02 | GIT-06 | 各阶段出口（`--force-with-lease`） |
| GIT-02 | S0-05 + 各阶段出口 | GIT-07 | S0-05 |
| GIT-03 | S0-03 + 各阶段出口 | GIT-08 | 子代理提示词限定写集（执行约束） |
| GIT-04 | 每阶段出口 | GIT-09 | 各阶段出口"PASS 才推" |
| GIT-05 | 各阶段出口 | GIT-10 | 出口说明"不推 main" |

P1（D02-04、D02-13、BRAND-08、扩源、CSV 等）不在本任务清单内，别在此阶段夹带。

---

## 12. 变更历史

| 版本 | 日期 | 变更 | 作者 |
|---|---|---|---|
| v1 | 2026-11-17 | 首版：按设计 S0–S5 拆分 56 条可执行任务；新增阻塞清单 BLK-01～BLK-10；建立需求覆盖矩阵 | D |