# 角色 D（后端与 API）分支路线图

> 本文件是 `feat/career-api` 分支上的本地路线图副本，基线取自集成分支 `feat/integration` 的 `ROADMAP.md`。
> 基线提交：`142e99a ci: run career integration check in docker job`（2026-11-17）
> 角色：D：后端与 API；远程分支 `feat/career-api`；独占写集 `modules/career-insights/{server.ts,backend/**,migrations/**,tests/**}`
> 门禁：每阶段完成 → 更新本文件 → 独立 review PASS → 才进入下一阶段；未确认前不并入集成分支、不 push 云端。

## 阶段划分与状态

| 阶段 | 对应 ROADMAP | 范围 | 状态 | Review |
|---|---|---|---|---|
| D1 | D2 后端部分 | SQL repository（summary/listJobs/jobDetail）、幂等观测写入、`career-insights.ingest` 队列、后端数据库测试 | 已完成 | PASS（2026-11-17） |
| D2 | D2 收尾 | 真实采集数据接入联调、`--require-data` 运行验收、数据库语义与 API v1 冻结前的真实样本验证 | 未开始 | - |
| D3 | D3 | SQL 指标冻结：五项指标真实样本验证、政策 `shared_themes` 接入真实政策证据、证据回溯 | 未开始 | - |
| D4 | D4–D5 | 后端只修缺陷：第二次采集观测验证、性能与错误处理、联调期问题 | 未开始 | - |

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