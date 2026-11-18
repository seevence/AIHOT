# 角色 D（后端与 API）分支路线图

> 本文件是 `feat/career-api-d2` 分支上的本地路线图副本，基线取自集成分支 `feat/integration` 的 `ROADMAP.md`。
> 基线提交：`21d07eb docs: record green cloud ci`（完整 SHA `21d07eb894ad9e0703a3ba037d5a67177f401d64`，2026-11-17）
> 上一基线：`142e99a ci: run career integration check in docker job`（D1 使用的旧基线，已过期）
> 角色：D：后端与 API；分支 `feat/career-api-d2`；独占写集 `modules/career-insights/{server.ts,backend/**,migrations/**}`
> 独立 worktree：`D:/Codex下载/GitHub项目/seevence/AIHOT-d2`（主工作区保留 B 的未提交采集改动，互不影响）
> 门禁：每阶段完成 → 更新本文件 → 独立 review PASS → 才进入下一阶段；未确认前不并入集成分支、不 push 云端。
> 上游文档：`docs/specs/2026-11-17-career-hot-increment-spec.md`、`docs/specs/2026-11-18-career-hot-design.md`、`docs/specs/tasks.md`

## 本文件的更新位置与时机

- 阶段开始：登记基线 SHA、worktree、本阶段任务清单与受阻项。
- 阶段结束：登记门禁命令的实际输出、review 结论、推送的 commit。
- 云端 `ROADMAP.md` 由 A 维护，本文件**不直接改**它；需要同步的事实写进 PR 描述交给 A。
- 云端约束以 `git show origin/feat/integration:ROADMAP.md` 为准，摘录如下。

### 云端 ROADMAP §6 写集（2026-11-17）

| 角色 | 远程分支 | 独占写集 |
|---|---|---|
| A | `feat/integration` | `package.json`、`module.ts`、`contracts/`、`site/modules/`、`site/package.json`、Dockerfile、协作契约文档 |
| B | `feat/career-collector` | `modules/career-insights/collector/**` |
| C | `feat/career-data-metrics` | `modules/career-insights/{data/**,fixtures/**}` |
| D | `feat/career-api` | `modules/career-insights/{server.ts,backend/**,migrations/**}` |
| E | `feat/career-dashboard` | `modules/career-insights/{web.tsx,web/**}` |

- `site/site.ts`、`site/changelog.json`、`site/brand/**` **未出现在任何角色的写集中**，归属待队长裁定（BLK-01），不得由 D 单方面修改。
- `contracts/**` 属 A；`tests/**`、`scripts/**` 未列入任何写集（BLK-06/BLK-09）。

### 云端 ROADMAP §9 待确认事项（与 D 相关）

- 正式站名与一句话定位未定；不得使用 AIHOT 名称和 Logo（BLK-04）。
- 真实政策源可采集性未确认；`.gov.cn` 本机不可达（BLK-03）。
- C/D 使用真实样本验收契约后，将 `contract_version` 升级为 `1.0`（BLK-09）。
- 评审准确日期、演示时长、现场是否允许联网。

## 阶段划分与状态

| 阶段 | 对应 ROADMAP | 范围 | 状态 | Review |
|---|---|---|---|---|
| D1 | D2 后端部分 | SQL repository（summary/listJobs/jobDetail）、幂等观测写入、`career-insights.ingest` 队列、后端数据库测试 | 已完成 | PASS（2026-11-17） |
| D2 | D2 收尾 | 真实采集数据接入联调、`--require-data` 运行验收、数据库语义与 API v1 冻结前的真实样本验证 | 未开始 | - |
| D3 | D3 | SQL 指标冻结：五项指标真实样本验证、政策 `shared_themes` 接入真实政策证据、证据回溯 | 未开始 | - |
| D4 | D4–D5 | 后端只修缺陷：第二次采集观测验证、性能与错误处理、联调期问题 | 未开始 | - |
| S0 | tasks.md S0 | 云端基线 worktree、路线图登记、基线门禁、写集隔离模板 | 完成，待独立 review | 门禁部分通过（环境缺陷 2 例） |

## 不可妥协约束（摘自共享路线图与开发契约）

- 只消费契约：`@aihot/career-insights/contracts` 的类型、C 的 `validateNormalizedJobV1`、`METRIC_SPECS_V1` 与词典版本；不擅自改变指标口径。
- 写入只接受 C 校验后的 `NormalizedJobV1`；未知值保持 `null` / `unknown` / `[]`，不得解释为 0、不限或“不友好”。
- 分母为 0、单快照、政策证据不足时返回 `insufficient_data` + `value=null`，不得返回 0 冒充结论。
- 唯一职位键 `(source_key, job_key)`；精确观测幂等键 `(job_id, observed_at, content_hash)`；`first_seen_at` 不随后续采集改变，`last_seen_at` 正常推进；不推断下架。
- 公开 API 不返回 `raw_text`、原始 HTML、Cookie、堆栈或密钥；数据库未就绪返回 `503`。
- 不修改 `contracts/`、`data/`、`fixtures/`、`collector/`、`web/`、`web.tsx`、`module.ts`、`site/modules/`、`Dockerfile`、`package-lock.json`（属 A/B/C/E）。
- 不把 fixture 写入正式表；不编造真实数据。
- 阶段完成 → 更新本文件状态与阶段记录 → 独立 review → PASS 后才进入下一阶段。

## 阶段记录

### D1（已完成，独立 review PASS）

- 工作目录：独立 worktree `D:\桌面\huawei\AIHOT-d`，分支 `feat/career-api-d1`（基于 `142e99a`）；与 E 的 `AIHOT-e` 及主工作区隔离，避免共用暂存区。
- 计划：`.codeartsdoer/plans/career-d1-api-sql/design.md`、`task.md`
- 交付：真实 SQL repository、幂等 `ingestBatch`、`career-insights.ingest` 队列、`modules/career-insights/tests/` 后端测试
- 验证：`npx tsc -p modules/tsconfig.json` 通过；`modules/career-insights/tests/*.test.ts` 12/12 通过（临时 PostgreSQL `127.0.0.1:5433`）。
- 联调期修正：`ingestBatch` 的 jsonb 参数改用 `sql.json()`（原 `JSON.stringify` 被 postgres.js 二次编码为 JSON 字符串标量，导致 `@>` 过滤失效与 22023）；summary 空表补齐 `job_family_share` / `skill_demand_share` 的 `insufficient_data` 占位。
- 跨线最小修复（已记录待 A 同步基线）：`data/validate.ts`、`data/metrics.ts` 的 `../contracts` 补 `index.ts` 扩展名，否则 `tsc -p modules` 直接报 TS2834。
- 明确不做：政策 `shared_themes` 真实接入（D3）、HTTP `POST /api/ingest/...`（契约 §8.5 优先进程内写入）、指标口径变更
- 收尾动作：独立 review PASS 后提交到 `feat/career-api-d1`，暂不并入 `feat/career-api` / 集成分支，也不 push；PASS 后才进入 D2- 独立 review：PASS（无 blocker / major）；README 与无效测试断言的增量复核同样 PASS。review 实跑 `tsc -p modules` 通过、12/12 测试通过。
- 遗留到后续阶段（非 D1 缺陷）：① `docs/development-contract.md` 中 C-INGEST 拒绝消息写 `code:message`，实际 `ValidationIssueV1` 只有 `path`，需 A 修正契约文本；② 开发契约 §6.3 未识别技能比例与 §6.5 来源覆盖变化校验，D1 已显式延期，D3 签署时确认；③ `.codeartsdoer/` 是本地计划目录，不纳入提交。
### S0（完成，待独立 review）

- 基线：`origin/feat/integration` = `21d07eb`，校验命令 `git rev-parse origin/feat/integration` 输出 `21d07eb894ad9e0703a3ba037d5a67177f401d64`。
- worktree：`git worktree add "D:/Codex下载/GitHub项目/seevence/AIHOT-d2" -b feat/career-api-d2 origin/feat/integration` 成功；新树 `git status --short` 为空，B 的未提交采集改动未被带入。
- 落后提交：`git log --oneline HEAD..origin/feat/integration` 无输出。
- 门禁实跑（2026-11-17，Node v24.19.0）：
  - `npm run typecheck` → 0 error（含 contracts/backend/api/worker/tests/modules + web typegen）。
  - `npx tsc -p modules/tsconfig.json` → 0 error。
  - `node scripts/check-migrations.ts --base origin/feat/integration` → `migration history and online safety checked`，exit 0。
    - 首次失败原因：本机 `core.autocrlf=true` 且仓库无 `.gitattributes`，工作区迁移文件为 CRLF，与基线树内容不等价，被误判为“已部署迁移被修改”。处理：worktree 内 `git config core.autocrlf false` + 强制重新检出，**未改任何迁移内容**。
  - `npm run build -w @aihot/web` → 成功（standalone 中 3 个页面测试依赖该构建产物）。
  - `npm run test:standalone` → 321 tests / 319 pass / 2 fail。
    - 失败项：`tests/outbound-headers.standalone.test.ts` 的 `outbound direct/proxy keeps larger response headers confined to one host`，子进程以 `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`（libuv）崩溃，exit code `3221226505`。
    - 判定：环境缺陷，非基线代码缺陷。本机 Node `v24.19.0` 低于 `package.json` 要求的 `>=24.22.1`，崩溃发生在 Node libuv 层；本机无 nvm/fnm，未擅自升级全局 Node。阻塞编号记为 ENV-01，升级 Node 后须复跑该文件。
- 写集隔离模板（每阶段提交前执行）：
  ```bash
  git status --short
  git diff --name-only origin/feat/integration...HEAD
  git diff origin/feat/integration...HEAD --name-only | grep -v -E '^modules/career-insights/(server\.ts|backend/|migrations/)'
  git diff origin/feat/integration...HEAD --name-only | grep -E 'collector/|scripts/collect-career'
  ```
  期望：第 1 条仅显示本阶段意图修改的文件；第 3、4 条无输出。基线实测两条均为空（当前 HEAD 等于基线）。
- S0 遗留：ENV-01（Node 版本）；BLK-01～10 仍待拍板，S1/S2 迁移可本地编写但不可推送。
### S1（完成，待独立 review）

- 基线：`feat/career-api-d2` 的 `61f2f56`（S0 基线 `21d07eb` 之后 5 个 D2 提交，`23699e7`/`99294a6`/`61f2f56` 等）。
- 迁移已应用：`0156_career_ingest_runs`（批次表）+ `0157_career_jobs_data_origin`、`0158_career_job_observations_batch` 两列，作用于 `postgres://postgres@127.0.0.1:5432/aihot`。
- 运行方式（旧 3000/3001 服务全程未使用）：
  - API：`DATABASE_URL="postgres://postgres@127.0.0.1:5432/aihot" API_PORT=3002 node apps/api/src/main.ts` → 日志 `Server listening at http://127.0.0.1:3002`，summary 探测返回 `200`。
  - web：`apps/web` 下 `API_BASE_URL="http://127.0.0.1:3002" npx react-router dev --port 3010 --host 127.0.0.1` → `http://127.0.0.1:3010/api/site/career-insights/summary` 返回 `200`。
  - 旧 3010 监听进程按端口定位为 PID 24424（node），`Stop-Process -Id 24424 -Force` 后端口释放；未触碰 3000/3001。
- 批次实跑（`career_ingest_runs` 查询，时间为 UTC）：

  | source_key | data_origin | status | job_count | accepted | duplicates | rejected | fetched_at |
  |---|---|---|---|---|---|---|---|
  | `netease-official-careers` | `verified_import` | `ok` | 10 | 10 | 0 | 0 | `2026-11-17T13:43:00.338Z` |
  | `tencent-official-careers` | `live` | `ok` | 30 | 0 | 30 | 0 | `2026-11-17T15:29:46.131Z` |
  | `xiaomi-official-careers` | `live` | `ok` | 30 | 0 | 30 | 0 | `2026-11-17T15:29:55.792Z` |

  - 3 条批次全部 `status=ok`。网易 `error` 字段实测为 `网易公开接口返回 404；按 B-02 降级使用上次成功采集的真实快照并标注 verified_import`。
  - 腾讯/小米 `duplicates=30`：本次复跑同一 `fetched_at` 批次，全部命中 `(source_key, kind, fetched_at)` 幂等键，未产生重复职位。
- 读回：`career_jobs` 70 条（netease 10 `verified_import` / tencent 30 `live` / xiaomi 30 `live`）；`career_job_observations` 220 条（netease 10、tencent 120、xiaomi 90，每源 1 个 `batch_id`）。
- summary 实测（`GET http://127.0.0.1:3010/api/site/career-insights/summary`，HTTP 200）：`data_origin=verified_import`、`sample_size=70`、`company_count=3`、`source_count=3`；`warnings` 4 条，含混合口径条目 `{"code":"unknown_fields","message":"样本混合自动采集与人工核验导入（verified_import），整体按较保守口径标注。"}`，另有 `unknown_fields` 2 条（未识别职族 / 未标记应届友好度）与 `insufficient_data` 1 条（政策证据未接入）。
- list 实测：`GET /api/site/career-insights/jobs?company=网易&page=1&page_size=2` → HTTP 200，`total=10`、`data_origin=verified_import`、`items=2`；全量 `GET /api/site/career-insights/jobs?page=1&page_size=5` → `total=70`、`data_origin=verified_import`、`items=5`。
- detail 实测（首个 id `1290279a-bc6a-4a34-9580-e0df7d0fe936`）：HTTP 200，顶层键 `contract_version,data_origin,job,observations,notice`；`data_origin=verified_import`；`observations` 1 条；`job.official_url=https://hr.163.com/job-detail.html?id=79801`；响应文本不含 `"raw_text"`、`"raw_payload"`。
- UTC Z 检查：summary `as_of=2026-11-17T15:29:55.792Z`、`first_observed_at=2026-11-17T13:25:21.303Z`、`last_observed_at=2026-11-17T15:29:55.792Z`；detail `job.first_seen_at`、`job.last_seen_at`、`observations[0].observed_at=2026-11-17T13:43:00.338Z`，全部以 `Z` 结尾；与库内 `fetched_at AT TIME ZONE 'UTC'` 渲染值一致，无时区偏移。
- 门禁实跑：
  - `node scripts/check-career-integration.ts --base http://127.0.0.1:3010 --require-data` → 6 项均 `✓`（`/api/health`、`/career-insights`、summary、jobs、`/jobs/02d201e0-159c-4948-8da8-7bb056976000`、`/jobs/not-a-uuid`），末行 `all checks passed`，exit 0。
  - 同 base 不带 `--require-data` → 5 项均 `✓`，`all checks passed`，exit 0。
  - 脚本用法与本阶段调用一致（`--base` / `--require-data`），无需改参数。
- 收尾：3002（PID 17052）与 3010（PID 14324）已停止；仅保留原有 3000/3001 旧服务。
- 已知偏差：
  - `0156` 的 `status` CHECK 约束不含 `running`，`startRun` 无法先写入进行态；当前以 `'failed'` + `error='run started but did not finish'` 占位插入，成功路径由 `finishRun` 覆盖为 `ok`/`partial`。若进程在 `finishRun` 前中断，该批次会如实保留为 `failed`。补 `running` 需新增迁移并重跑门禁。
  - `scripts/collect-career-run.local.ts` 为本地验收脚本（依赖 B 未提交的采集实现），**不提交**；B 的 `collector/{index,sources,tencent,xiaomi,netease}.ts`、`scripts/collect-career.ts`、`.env` 均未进入本提交。
  - 网易覆盖仅首批 10 条（分页失效），因此整体口径按 `verified_import` 保守标注。
- BLK-06（`tests/**`、`scripts/**` 写集未拍板）：仍开放。本阶段只执行 `scripts/check-career-integration.ts` 与本地采集脚本，未提交任何 `scripts/**`、`collector/**` 改动；采集在当前 worktree 无法独立复现（依赖 B 提交 + A 合入）。
- BLK-07（3 家 70 条样本底线、网易分页失效是否接受“首批 + 去重”）：仍开放，待队长/B 拍板；本阶段验收结论仅在“3 家 / 70 条、网易仅首批”范围内成立。
- 遗留：
  - `0156` 补 `running` 状态（新增迁移，需独立 review）。
  - ENV-01（本机 Node 版本低于 `>=24.22.1`）继承自 S0，未处理。
  - 3000/3001 旧服务仍在运行，后续门禁须继续显式使用 3002/3010，避免命中旧代码。
  - 写集隔离实测：提交前 `git status --short` 为 `M docs/roadmaps/career-api-roadmap.md`、`M modules/career-insights/backend/run-repository.ts`、`?? modules/career-insights/backend/run-ingest.ts`，另有 B 的本地未提交改动（`M collector/{index,sources}.ts`、`?? collector/{netease,tencent,xiaomi}.ts`、`?? scripts/collect-career.ts`、`?? scripts/collect-career-run.local.ts`）；本次只 `git add` 上述 3 个 D 写集文件，B 文件、脚本与 `.env` 均未暂存。
### S2 迁移（完成，待 review）

- 范围：T-S2-01～03 三个政策迁移。文件（均为新增，未改动任何已部署迁移）：
  - `modules/career-insights/migrations/0160_career_policies.sql`（单条 `CREATE TABLE`）
  - `modules/career-insights/migrations/0161_career_policies_theme_idx.sql`（`CREATE INDEX CONCURRENTLY IF NOT EXISTS ... USING gin (theme_ids)`）
  - `modules/career-insights/migrations/0162_career_policies_published_idx.sql`（`CREATE INDEX CONCURRENTLY IF NOT EXISTS ... (published_at DESC NULLS LAST)`）
- 迁移安全检查（`--base origin/feat/integration` = `21d07eb894ad9e0703a3ba037d5a67177f401d64`）：
  ```
  $ node scripts/check-migrations.ts --base origin/feat/integration
  migration history and online safety checked
  exit 0
  ```
- 应用（`postgres://postgres@127.0.0.1:5432/aihot`，`npm run db:migrate`，exit 0）：
  ```
  applied 0160_career_policies.sql (13ms, transaction)
  applied 0161_career_policies_theme_idx.sql (7ms, index)
  applied 0162_career_policies_published_idx.sql (4ms, index)
  3 migration(s) applied
  ```
- 列核验（`pg_attribute` + `pg_attrdef`，实测 **18 列**）：

  | # | 列 | 类型 | NOT NULL | 默认 |
  |---|---|---|---|---|
  | 1 | `id` | uuid | ✓ | `gen_random_uuid()` |
  | 2 | `policy_item_id` | text | ✓ | - |
  | 3 | `source_key` | text | ✓ | - |
  | 4 | `source_tier` | text | ✓ | - |
  | 5 | `title` | text | ✓ | - |
  | 6 | `issuer` | text | ✓ | - |
  | 7 | `published_at` | date | ✗（可空） | 无 |
  | 8 | `official_url` | text | ✓ | - |
  | 9 | `theme_ids` | jsonb | ✓ | `'[]'::jsonb` |
  | 10 | `evidence_excerpt` | text | ✓ | - |
  | 11 | `content_hash` | text | ✓ | - |
  | 12 | `collector_version` | text | ✓ | - |
  | 13 | `data_origin` | text | ✓ | - |
  | 14 | `fetched_at` | timestamptz | ✓ | - |
  | 15 | `first_seen_at` | timestamptz | ✓ | - |
  | 16 | `last_seen_at` | timestamptz | ✓ | - |
  | 17 | `created_at` | timestamptz | ✓ | `now()` |
  | 18 | `updated_at` | timestamptz | ✓ | `now()` |

  - 与 `docs/specs/2026-11-18-career-hot-design.md` 表 2、`docs/specs/tasks.md` T-S2-01 字段清单一致（18 列）。任务书写的“19 列”与设计不一致，按实测 18 列记录。
  - 关键断言全部成立：`published_at` 可空且无默认；`theme_ids` 默认 `'[]'::jsonb`。
- 约束核验（`pg_constraint`，实测 4 条；`contype='c'` 2 条）：
  - `career_policies_pkey`（`p`）`PRIMARY KEY (id)`
  - `career_policies_source_key_policy_item_id_key`（`u`）`UNIQUE (source_key, policy_item_id)`
  - `career_policies_source_tier_check`（`c`）`CHECK (source_tier = ANY (ARRAY['government_official','official_media','other_public']))`
  - `career_policies_data_origin_check`（`c`）`CHECK (data_origin = ANY (ARRAY['live','verified_import','synthetic_fixture']))`
- 索引核验（`pg_index` + `pg_get_indexdef`，实测 4 个，均 `indisvalid=true`）：
  - `career_policies_theme_idx` → `USING gin (theme_ids)`
  - `career_policies_published_idx` → `USING btree (published_at DESC NULLS LAST)`
  - `career_policies_pkey`、`career_policies_source_key_policy_item_id_key`（主键/唯一键自动索引）
- 回滚路径验证（只在 `aihot_test` 执行，未触碰 `aihot` 主库）：
  - `aihot_test` 已存在（与 `aihot` 同实例），先 `npm run db:migrate` 追平 → 与主库相同的三条 `applied` 输出，exit 0。
  - `DROP TABLE IF EXISTS career_policies` → 执行前 `to_regclass` 非空、执行后为空；同时删除 `schema_migrations` 中 `0160/0161/0162` 三条记录（否则迁移器会判定已应用而跳过）。
  - 再跑 `npm run db:migrate` → `applied 0160 (41ms, transaction)`、`applied 0161 (7ms, index)`、`applied 0162 (3ms, index)`，`3 migration(s) applied`，exit 0。
  - 重建后复核：`columns=18`、`check_constraints=2`、`career_policies_published_idx(valid=true)` 与 `career_policies_theme_idx(valid=true)` 均恢复。结论：回滚后可按同一组迁移完整重建。
- 偏差与说明：
  - 任务书中的“19 列”按实测为 18 列，未为凑数新增字段；字段集合以设计表 2 为准。
  - 回滚重建需同时清理 `schema_migrations` 记录，这是迁移器的既有语义（已应用清单），迁移文件本身无需修改。
  - 本阶段未启动任何 web/api 服务，未使用 3000/3001 端口。
  - B 的本地未提交改动（`collector/**`、`scripts/collect-career*.ts`）与 `.env` 全程未 `git add`。
- 评审结论：待独立 review。
### S2 后端（完成，待 review）

- 范围与写集：仅 `modules/career-insights/backend/policy-repository.ts`（新增）、`modules/career-insights/backend/summary.ts`（修改）、本路线图。`contracts/**`、`data/**`、`collector/**`、`scripts/collect-career*.ts`、`.env` 均未改动、未暂存。
- 类型检查（`npx tsc -p modules/tsconfig.json`）：
  - 首次运行 exit 1，1 条错误：`policy-repository.ts(2,31): error TS2459: Module '“../contracts/api.ts”' declares 'PolicyEvidenceRefV1' locally, but it is not exported.`
  - 仅改 `backend/policy-repository.ts`：`PolicyEvidenceRefV1` 改为从 `../contracts/index.ts` 导入（该类型实际定义在 `contracts/job.ts:83`，经 `index.ts` 再导出），`IngestResultV1` 仍从 `contracts/api.ts` 导入。
  - 复跑 exit 0，无错误、无警告。
- 后端测试（`aihot_test`，`--test-concurrency=2`，命令与任务书一致）：
  - 共 **13 项：pass 12、fail 1**，exit 1，耗时约 1.58s。
  - 通过项覆盖：批次幂等/去重、`first_seen_at` 与 `last_seen_at` 单调性、内容变更原地更新、按索引拒绝非法项、超 100 条整批拒绝、空表 summary、列表过滤/分页、详情与观测。
  - 唯一失败项：`repository.test.ts:126` 仍断言旧文案 `"政策证据尚未接入，共享主题暂为空。"`，而新后端输出（以及 `docs/specs/2026-11-18-career-hot-design.md:784`、`docs/specs/tasks.md:451`）已定为 `"尚未接入政策证据，共享主题暂不计算。"`。为守住本阶段写集隔离，未修改 `tests/**`；该断言需随 `tests/**` 写集归属（BLK-06）一并更新。
  - 旁证：临时把该断言改为新文案后复跑得到 `tests 13 / pass 13 / fail 0`，exit 0；确认失败仅由陈旧文案断言引起，后端逻辑无其他红灯。改动已还原，未进入提交。
- 运行方式（未使用 3000/3001）：
  - API：`DATABASE_URL="postgres://postgres@127.0.0.1:5432/aihot" API_PORT=3002 node apps/api/src/main.ts` → `Server listening at http://127.0.0.1:3002`（PID 40600）。
  - web：`apps/web` 下 `DATABASE_URL=... API_BASE_URL="http://127.0.0.1:3002" npx react-router dev --port 3010 --host 127.0.0.1` → `http://127.0.0.1:3010/`（PID 32704）。启动前 3010 空闲，无需杀旧进程。
  - 收尾：`Stop-Process -Id 32704,40600`（不带 `-Force`；带 `-Force` 的组合命令被执行策略拦截）后，`netstat` 上 3002/3010 无 `LISTENING`，仅余正常 `TIME_WAIT`。
- 空政策语义实测（`GET http://127.0.0.1:3010/api/site/career-insights/summary`，HTTP 200，库内 `career_policies` 0 行）：
  ```json
  {
    "contract_version": "0.1",
    "data_origin": "verified_import",
    "sample_size": 70,
    "company_count": 3,
    "source_count": 3,
    "has_multiple_snapshots": true,
    "shared_themes": [],
    "policy_job_shared_themes": {
      "status": "insufficient_data",
      "value": null,
      "numerator_count": 0,
      "denominator_count": null,
      "sample_size": 70,
      "dictionary_version": "0.1"
    },
    "warnings": [
      { "code": "unknown_fields", "message": "存在未识别职族的职位，已单列 unknown。" },
      { "code": "unknown_fields", "message": "存在未标记应届友好度的职位，unknown 不表示不友好。" },
      { "code": "insufficient_data", "message": "尚未接入政策证据，共享主题暂不计算。" },
      { "code": "unknown_fields", "message": "样本混合自动采集与人工核验导入（verified_import），整体按较保守口径标注。" }
    ]
  }
  ```
  - 期望项全部命中：`shared_themes=[]`、`status=insufficient_data`、`value=null`、`sample_size=70`、`data_origin=verified_import`、warning 含 `"尚未接入政策证据，共享主题暂不计算。"`。
- 技能未知识别实测：
  - `skill_demand_share` 共 10 条（按 `job_count` 降序取前 10），每条均含数值型 `unknown_count` 与 `unknown_ratio`。样例两条：
    ```json
    { "skill_id": "ai_agents", "status": "ok", "value": 0.4142857142857143, "numerator_count": 29, "unknown_count": 8, "unknown_ratio": 0.11428571428571428 }
    { "skill_id": "cpp", "status": "ok", "value": 0.08571428571428572, "numerator_count": 6, "unknown_count": 8, "unknown_ratio": 0.11428571428571428 }
    ```
  - 库核对：`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE COALESCE(skills, '[]'::jsonb) = '[]'::jsonb)::int AS empty_skills FROM career_jobs` → `{"total":70,"empty_skills":8}`。接口 `unknown_count=8` 与 `empty_skills=8` 完全一致；`unknown_ratio=8/70=0.11428571428571428`。
- 未完成项：
  - **T-S2-07 已按 `official_media` 口径写入 2 条真实样本**（见下节“S2 政策真实样本”；政务 `.gov.cn` 仍不可达，`official_media` 是否为 BLK-03 的最终口径待队长确认）。
  - **T-S2-13 仍受阻**（BLK-09）：契约 `PolicyEvidenceRefV1.published_at` 仍为 `string`（`contracts/job.ts:87`、`openapi.json` 的 `required` 与 `type: "string"` 均不可空），因此 `listPolicyEvidence` 只读取 `published_at IS NOT NULL` 的记录；发布日期缺失的政策暂不入库。待 A 在 `contracts/**` 放开可空后再补读取路径。
- 评审结论：待独立 review。
### S2 政策真实样本（T-S2-07）

- 范围与写集：仅本路线图。入库使用一次性本地脚本 `scripts/ingest-policy-samples.local.ts`（验证后删除，未 `git add`）；`collector/**`、`scripts/collect-career*`、`.env` 全程未暂存，未提交任何数据文件。
- 数据库与基线：`postgres://postgres@127.0.0.1:5432/aihot`，入库前 `career_policies` 为 0 行。
- 入库实现：`writePolicyBatch` 分两个批次（每来源 1 条），`data_origin="live"`、`collector_version="official-media-manual/0.1.0"`、`fetched_at=2026-11-17T16:12:03.725Z`；`policy_item_id` 取规范化 URL 的 SHA-256 前 32 位，`content_hash` 取正文 SHA-256，`evidence_excerpt` 截取原文 ≤500 字。
- 入库输出（`accepted/updated/duplicates/rejected/errors`）：
  ```json
  {"source_key":"xinhuanet-policy","fetched_at":"2026-11-17T16:12:03.725Z","policy_item_ids":["db50aeae67907eb201b1335202c0f846"],"evidence_lengths":[288],"accepted":1,"updated":0,"duplicates":0,"rejected":0,"errors":[]}
  {"source_key":"people-policy","fetched_at":"2026-11-17T16:12:03.725Z","policy_item_ids":["c3816147b71599d84830ba513c8431ef"],"evidence_lengths":[359],"accepted":1,"updated":0,"duplicates":0,"rejected":0,"errors":[]}
  ```

**样本 1**

- 来源：新华网（`news.cn`），页面来源署名“人民日报”，内容主体机构为全国总工会；`source_key=xinhuanet-policy`，`source_tier=official_media`。
- 标题：全总重点支持建设二百家工匠学院
- 机构（`issuer`）：人民日报
- 日期（`published_at`）：2026-11-13（页面另标 07:41:13）
- URL：https://www.news.cn/politics/20261113/3689813fa884471687d053c55dc9c3ae/c.html
- `theme_ids`：`["talent_development"]`
- 摘录长度：288 字；摘录含“全国总工会近日确定2026年重点支持建设的200家工匠学院”“培育特色工种492个”“线下课程超6.8万门、发布线上技能课程1万多节，今年以来培训职工超150万人次”。
- `policy_item_id`：`db50aeae67907eb201b1335202c0f846`。
- 复核结果：重新 fetch 页面，标题、日期、正文关键事实与任务书一致，无差异。

**样本 2**

- 来源：人民网教育频道（`people.com.cn`），页面来源署名“光明日报”；`source_key=people-policy`，`source_tier=official_media`。
- 标题：AI浪潮下，毕业生如何锻造就业竞争力
- 机构（`issuer`）：光明日报
- 日期（`published_at`）：2026-11-17（页面另标 08:29）
- URL：https://edu.people.com.cn/n1/2026/1117/c1006-40835222.html
- `theme_ids`：`["employment_promotion","artificial_intelligence"]`（正文围绕高校毕业生就业竞争力与 AI 新岗位，另含“人才培养”相关表述，未单列 `talent_development`）
- 摘录长度：359 字；摘录含“不少高校毕业生主动‘拥抱’AI”“打造适应新岗位新场景的就业竞争力”“2026年前5月新发校招AI岗位量同比增长47.30%”。
- `policy_item_id`：`c3816147b71599d84830ba513c8431ef`。
- 选取路径与差异：该标题在 `https://www.people.com.cn/` 首页“社会·教育”板块的列表里位于 `c1006-40835222.html`（相邻条目的 href 与标题存在错位）；`edu.people.com.cn` 子域 https 证书报 `ERR_TLS_CERT_ALTNAME_INVALID`，抓取改用 `http://` 同路径，入库 `official_url` 保留 `https`（实测 https 返回同一正文，仅证书名不匹配）。日期、署名与正文均以文章页 `publishdate`、`source` 元数据及正文为准。

**实测 summary（`GET http://127.0.0.1:3010/api/site/career-insights/summary`，HTTP 200）**

```json
{
  "contract_version": "0.1",
  "data_origin": "verified_import",
  "sample_size": 70,
  "company_count": 3,
  "source_count": 3,
  "shared_themes": [],
  "policy_job_shared_themes": {
    "status": "insufficient_data",
    "value": null,
    "numerator_count": 0,
    "denominator_count": null,
    "sample_size": 70,
    "dictionary_version": "0.1"
  },
  "warnings": [
    { "code": "unknown_fields", "message": "存在未识别职族的职位，已单列 unknown。" },
    { "code": "unknown_fields", "message": "存在未标记应届友好度的职位，unknown 不表示不友好。" },
    { "code": "insufficient_data", "message": "政策与职位暂未出现同一主题，不代表无共同方向。" },
    { "code": "unknown_fields", "message": "样本混合自动采集与人工核验导入（verified_import），整体按较保守口径标注。" }
  ]
}
```

- 库内分组核对：`people-policy=1`、`xinhuanet-policy=1`；两条均为 `source_tier=official_media`、`data_origin=live`、`published_at` 非空。
- 端口：API 3002、web 3010，实测后已停止（PID 17444、35352）；全程未使用 3000/3001。
- **BLK-03 口径仍待队长确认**：本阶段以 `official_media`（新华网、人民网）作为 T-S2-07 的真实政策源，未使用政务 `.gov.cn`；该口径是否满足“政策入库”定义、是否需要补政务源，仍待拍板。两条政策主题与当前 70 条职位无交集（`shared_themes=[]`、`insufficient_data`），属合法结果，不代表无共同方向。
### S3 两时点（完成，待 review）

- 执行时间与库：2026-11-17/18（本地 CST），`postgres://postgres@127.0.0.1:5432/aihot`，只读查询；未改业务代码、未改 `contracts/`、`collector/`、`scripts/collect-career*`、`.env`。端口只用 3002（API）与 3010（web），未使用 3000/3001。
- 时点数（复采前）：`select count(distinct observed_at)::int from career_job_observations;` → `8`（≥2）。
- 时点分布（复采前，`select observed_at, count(*) from career_job_observations group by 1 order by 1;`）：
  ```json
  [{"observed_at":"2026-11-17T13:25:21.303Z","count":30},{"observed_at":"2026-11-17T13:38:13.330Z","count":30},{"observed_at":"2026-11-17T13:38:17.257Z","count":30},{"observed_at":"2026-11-17T13:42:48.161Z","count":30},{"observed_at":"2026-11-17T13:42:57.410Z","count":30},{"observed_at":"2026-11-17T13:43:00.338Z","count":10},{"observed_at":"2026-11-17T15:29:46.131Z","count":30},{"observed_at":"2026-11-17T15:29:55.792Z","count":30}]
  ```
  合计 220 行。实际时点多于两个：每个来源的每个采集批次各写一个 `observed_at`（腾讯/小米各两次 live、网易一次 verified_import）；13:43 为网易 10 条导入批次，15:29 为腾讯/小米 live 批次。任务书中“约 13:43 与 15:29Z 两个时点”是批次层面的概括，精确到 `observed_at` 为 8 个。
- 观测幂等：`select job_id, observed_at, content_hash, count(*) ... having count(*)>1;` → `[]`（0 行）；`select count(*)::int from career_jobs;` → `70`（未出现 140/220）。
- 批次幂等：`select source_key, kind, fetched_at, count(*) ... having count(*)>1;` → `[]`（0 行）。复采前 `career_ingest_runs` 5 行：netease/jobs/13:43、tencent/jobs/15:29:46、xiaomi/jobs/15:29:55、people-policy/policy/16:12:03、xinhuanet-policy/policy/16:12:03。
- 同源重复采集（腾讯，真实访问外网）：
  ```json
  {"source_key":"tencent-official-careers","fetched":30,"normalized":30,"rejected":0,"accepted":0,"updated":0,"duplicates":30,"errors":[],"run_id":"132edb34-ee58-41c1-9949-6343d02d0017","status":"ok"}
  ```
  复采后复核：`career_jobs` 仍为 `70`；`career_job_observations` 220 → `250`（新增一个 30 条观测时点 `2026-11-17T16:16:30.798Z`，符合“每次采集记录新时点”语义）；观测重复分组仍 `[]`、批次重复分组仍 `[]`；`count(distinct observed_at)` → `9`。`accepted=0/updated=0/duplicates=30` 证明同源同内容复采不新增职位、不翻倍。
- summary 实测（`GET http://127.0.0.1:3010/api/site/career-insights/summary`，经 web 代理，HTTP 200）：
  - `has_multiple_snapshots=true`；`sample_size=70`；`shared_themes=[]`。
  - `observed_new_jobs`：`status=ok`、`value=0`、`numerator_count=0`、`denominator_count=null`、`evidence=[]`（0 条）。
  - `policy_job_shared_themes`：`status=insufficient_data`、`value=null`、`numerator_count=0`、`denominator_count=null`、`evidence=[]`（政策与职位当前无共同主题）。
  - warnings 4 条：职族 unknown、应届友好度 unknown、政策与职位暂无共同主题、混合 `verified_import` 口径。
  - `observed_new_jobs=0` 的依据与合法性：`summary.ts:152-156` 取最近两个 `distinct observed_at`（降序 LIMIT 2），复采后为 `16:16:30.798Z` 与 `15:29:55.792Z`（`summary.ts:261-262`）；`newJobsMetric` 统计 `first_seen_at > previous AND first_seen_at <= latest`，而全部 70 条职位的 `first_seen_at` 为 `13:25:21`（30）、`13:38:17`（30）、`13:43:00`（10），均早于 15:29:55，故两时点间观测新增确为 0。这是 `status=ok + value=0` 的合法结果（最近两批次无新增），不是 `insufficient_data`。
  - 语义注意：接口的“两时点”是最近两个 distinct 时点（本次为 15:29 与 16:16 的两个不同来源批次），不是跨日或跨小时窗口；跨更长窗口的“新增”需等后续批次时点自然拉开，指标口径本身不改。
- 单快照语义（不改主库）：在 `aihot_test` 用最小 fixture 实跑 —— 插入 1 条 `career_jobs`（skills=`[]`）+ 1 条 `career_job_observations`（单一 `observed_at`），调用真实 `buildSummary`，得到 `snapshots=1`、`has_multiple_snapshots=false`、`observed_new_jobs.status=insufficient_data`、`value=null`、`numerator_count=0`、`denominator_count=null`、`evidence=[]`；验证后删除 fixture，`career_jobs=0`、`career_job_observations=0`。代码路径同时确认：`summary.ts:168` 为 `snapshots.length >= 2`，`<2` 时走 `summary.ts:263-272` 的 `insufficient_data` 分支。局限：fixture 为最小字段（无政策、无技能），只验证单快照分支语义，不覆盖真实数据的全部字段组合；主库 250 条观测全程未删除、未 truncate。
- 端口与服务：API 监听 3002、web 3010，获取 summary 后已停止（PID 36924、39108），复查 3002/3010 均无监听。
- 本阶段 commit：两份清单文档 `5254d3b docs: add brand and contract-1.0 proposals`；本路线图记录随 `docs(roadmap): record S3 two-snapshot evidence` 提交并推送 `origin feat/career-api-d2`。
- 未完成/局限：未验证跨自然日的新增窗口；单快照未用完整真实样本验证；`policy_job_shared_themes` 仍受政策样本量与主题交集限制。
### S5 门禁复跑（完成，待 review）

- 位置与写集：worktree `D:\Codex下载\GitHub项目\seevence\AIHOT-d2`，分支 `feat/career-api-d2`。本阶段仅修改本路线图；未改业务代码与测试，未提交 `collector/**`、`scripts/collect-career*`、`.env`。服务端口只用 3002（API）与 3010（web），未使用 3000/3001。
- 前置环境：`pg_isready -h 127.0.0.1 -p 5432` → `127.0.0.1:5432 - 接受连接`；`aihot` 库实查 `career_jobs=70`、`career_policies=2`、`career_ingest_runs=6`，与前提一致。`aihot_test` 可用。本机 Node `v24.19.0`，低于 `package.json` 的 `>=24.22.1`。
- PostgreSQL 中断与恢复：`D:\pg17\pg.log:231` 记录 `2026-11-18 00:39:07.145 CST [12444] LOG: server process (PID 35252) was terminated by exception 0x40010004`，随后 `database system is shut down`；`pg.log:242` 记录 `2026-11-18 12:56:30.495 CST [34108] LOG: database system was interrupted; last known up at 2026-11-18 00:39:00 CST`。已用 `pg_ctl -D "D:\pg17\data" -l "D:\pg17\pg.log" -w -t 60 start` 恢复，`pg_isready` 通过。
- 静态门禁：
  - `npm run typecheck` → exit 0。
  - `npx tsc -p modules/tsconfig.json` → exit 0。
  - `npm run build -w @aihot/web` → exit 0。
- 测试门禁：
  - `npm run test:web` → exit 1，1 pass / 1 fail；失败项为 `outline keyboard scrolling stays inside its boundary in WebKit`，约 10 分钟超时终止。定性为环境缺陷，非基线代码缺陷。
  - `npm run test:standalone` → exit 1，共 321 tests / 319 pass / 2 fail；两条 outbound-headers 用例以 libuv `Assertion failed: (!(handle->flags & UV_HANDLE_CLOSING))` 崩溃，退出码 `3221226505`（`0xC0000409`）。定性为 Node 24.19.0 环境缺陷（`package.json` 要求 `>=24.22.1`），记 ENV-01。
  - career DB 测试：13 tests / 12 pass / 1 fail。唯一失败为 `repository.test.ts:126` 仍断言旧文案“政策证据尚未接入，共享主题暂为空。”，后端新文案为“尚未接入政策证据，共享主题暂不计算。”；定性为待 `tests/**` 写集批准后更新，后端逻辑无其他红灯。
- 迁移检查：`node scripts/check-migrations.ts --base origin/feat/integration` → `migration history and online safety checked`，exit 0（本轮复跑确认）。
- 服务级检查（本轮实测；API 3002 → `200`，web 3010 → `200`）：
  - `node scripts/check-career-integration.ts --base http://127.0.0.1:3010` → 5/5 通过（`/api/health`、`/career-insights`、summary、jobs、`jobs/not-a-uuid`），`all checks passed`，exit 0。
  - 同命令加 `--require-data` → 6/6 通过（额外校验真实职位详情 `034b6d31-fc5c-460b-8da3-b0051300dced`），`all checks passed`，exit 0。
  - `node scripts/smoke.ts --base http://127.0.0.1:3010` → 30/30 通过（14 个页面 + 13 个 API/静态资源 + MCP initialize），`all checks passed`，exit 0。
  - `curl -s -w '\n%{time_total}\n' -o NUL http://127.0.0.1:3010/api/site/career-insights/summary` 连跑 5 次：HTTP 200；耗时 `0.008105`、`0.009109`、`0.009177`、`0.012703`、`0.011916` 秒，均值约 `0.0102` 秒。
- 收尾：按端口定位进程后 `Stop-Process`（不带 `-Force`）停止 3002（PID 25976）与 3010（PID 5296）；复查两端口均无监听（连接返回 `000`）。
- 遗留阻塞：BLK-01、BLK-03、BLK-04、BLK-05、BLK-06、BLK-07、BLK-09、BLK-10；ENV-01（Node 版本低于 `>=24.22.1`，需升级后复跑 `test:standalone` 与 `test:web`）；`tests/**` 写集未批准（`repository.test.ts:126` 旧文案断言无法更新）；site 品牌与命名未执行（BLK-01/BLK-04）。