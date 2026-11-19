# Career Insights 角色 D · 阶段 1：SQL 持久化与真实读取 API

## 1. 需求

R1：当 `server.ts` 注册 `career-insights` 模块时，系统应使用连接数据库的 `SqlCareerRepository`，而不是 `UnavailableCareerRepository`。

R2：当数据库可用且存在职位数据时，`GET /api/site/career-insights/summary` 应返回按 `METRIC_SPECS_V1` 顺序计算的四项数值指标和 `shared_themes` 列表（D1 为空列表）。

R3：当 `GET /api/site/career-insights/jobs` 收到合法筛选参数时，系统应按 `role_family`、`company`、`city`、`employment_type`、`student_friendly`、`skill` 过滤，并按 `page` / `page_size` 分页返回 `total`。

R4：当 `GET /api/site/career-insights/jobs/:id` 的 id 是已存在职位时，系统应返回公开字段、技能证据和最近观测摘要；不存在时应返回 `null`（路由层转 `404`）。

R5：当 `career_jobs` 为空表时，summary 和 jobs 应返回 `200` 与 `insufficient_data` 语义（`value=null`、空数组、明确 warning），而不是 `503` 或伪造数字。

R6：当同一 `NormalizedJobV1` 批次重复写入时，系统应保证职位只有一行、观测不重复追加，第二次写入计数为 `duplicates`。

R7：当批次中某条目未通过 `validateNormalizedJobV1` 时，系统应拒绝该条目并计入 `rejected`，同批其他合法条目照常写入。

R8：当 `career_jobs` 不存在该 `(source_key, job_key)` 时，系统应写入当前态并记录 `first_seen_at`；已存在且内容哈希变化时应更新当前态并计入 `updated`；哈希相同则只推进 `last_seen_at`。

R9：当采集侧需要异步写入时，系统应通过模块队列 `career-insights.ingest` 消费 `CareerObservationBatchV1`，失败可重试且重复执行幂等。

R10：当本阶段完成时，`modules/career-insights/tests/` 应包含可独立运行的数据库测试，`docs/roadmaps/career-api-roadmap.md` 应更新阶段状态。

R11：当数据库连接失败时，公开 API 应返回 `503 data_unavailable`，不返回空结果冒充正常。

## 2.1 架构与文件

| 文件 | 内容 |
|---|---|
| `backend/sql-repository.ts`（新） | `SqlCareerRepository implements CareerRepository`；构造参数 `db: Db = sql`；`summary` 委托 `buildSummary`，`writeBatch` 委托 `ingestBatch`，`listJobs` / `jobDetail` 直接 SQL |
| `backend/summary.ts`（新） | `buildSummary(db: Db): Promise<SummaryResponseV1>`，SQL 聚合四项数值指标，`shared_themes=[]` |
| `backend/ingest.ts`（新） | `ingestBatch(db: Db, batch: CareerObservationBatchV1): Promise<IngestResultV1>`，单事务幂等写入 |
| `backend/queue.ts`（新） | `careerIngestQueue: ModuleQueue<CareerObservationBatchV1>` |
| `backend/repository.ts`（改） | 保留 `CareerRepository` 接口；删除 `UnavailableCareerRepository` |
| `server.ts`（改） | `new SqlCareerRepository()`；`queues: [careerIngestQueue]` |
| `tests/repository.test.ts`、`tests/ingest.test.ts`（新） | 数据库测试 |

不改 `backend/http.ts` 的路由与校验逻辑、`backend/errors.ts`。

## 2.2 接口契约

### C-REPO@1

提供方文件：`backend/sql-repository.ts`、`backend/summary.ts`；消费方：`server.ts`、`tests/repository.test.ts`。

```ts
export class SqlCareerRepository implements CareerRepository {
  constructor(db?: Db);
  summary(): Promise<SummaryResponseV1>;
  listJobs(filters: JobFiltersV1): Promise<JobListResponseV1>;
  jobDetail(id: string): Promise<JobDetailResponseV1 | null>;
  writeBatch(batch: CareerObservationBatchV1): Promise<IngestResultV1>;
}
```

- 有效职位 = `career_jobs` 一行（表只由 `ingestBatch` 写入，因此每行至少一次观测）；去重由唯一键 `(source_key, job_key)` 保证。
- 时间统一 `new Date(value).toISOString()`；无任何职位时时间字段取 `"1970-01-01T00:00:00.000Z"`。
- `listJobs` 过滤：
  - `role_family` → `role_family = $n`
  - `company` → `company_name = $n`
  - `city` → `locations @> to_jsonb(ARRAY[$n])`
  - `employment_type` → `employment_type = $n`
  - `student_friendly` → `student_friendly = $n`
  - `skill` → `skills @> to_jsonb(ARRAY[$n])`
  - 排序 `last_seen_at DESC, id ASC`；`LIMIT page_size OFFSET (page-1)*page_size`
  - `total` 与列表同条件计数；`as_of` = 全表 `MAX(last_seen_at)`
  - `filters` 原样回显入参；`data_origin="live"`；`contract_version="0.1"`
- `jobDetail(id)`：查当前态；不存在返回 `null`。`observations` 取 `ORDER BY observed_at DESC, id DESC LIMIT 20`，`id` 用 `String(row.id)`（db.ts 把 int8 解析为 number，契约要求 string），`evidence_excerpt` 取 `raw_excerpt` 前 500 字符。`notice` 固定为 `"当前状态以最近一次成功观测为准；单次未采集到不代表职位已下架。"`。不返回 `raw_text` / `raw_payload`。
- 数据库错误不吞：`SqlCareerRepository` 不捕获异常，由 `backend/http.ts` 的 `respond` 统一映射。`db.ts` 的 `sql` 延迟连接，连接失败抛 `postgres` 错误 → `respond` 映射为 `500`。为了让数据库不可用返回 `503`（R11），`SqlCareerRepository` 捕获 `Error` 且 `error.code` 属于 pg 连接类错误（`ECONNREFUSED`、`ENOTFOUND`、`57P03`、`53300`）时重抛 `DataUnavailableError`；其余错误原样抛出。适用全部四个方法。

### C-SUMMARY@1

提供方文件：`backend/summary.ts`；消费方：`backend/sql-repository.ts`、`tests/repository.test.ts`。

`buildSummary(db)` 固定字段：

- `contract_version="0.1"`、`data_origin="live"`、`dictionary_version=SKILL_DICTIONARY_VERSION`、`shared_themes=[]`
- `sample_size` = `COUNT(*)`；`company_count` = `COUNT(DISTINCT company_name)`；`source_count` = `COUNT(DISTINCT source_key)`
- `first_observed_at` = `MIN(first_seen_at)`；`last_observed_at` = `MAX(last_seen_at)`；`as_of = last_observed_at`
- `has_multiple_snapshots` = `(SELECT COUNT(DISTINCT observed_at) FROM career_job_observations) >= 2`

指标数组顺序与内容（`label`、`unit`、`disclaimer` 取自 `METRIC_SPECS_V1`；`version="1.0"`）：

1. `job_family_share`：按枚举顺序 `ai_algorithm`、`ai_application_development`、`data`、`ai_product_operations`、`unknown`，仅对 `COUNT(*)>0` 的职族各输出一条。`numerator_count` = 该职族数；`denominator_count` = `sample_size`；`value = numerator/denominator`（分母 0 时 `status="insufficient_data"`、`value=null`）；`dimension={role_family}`。`sample_size=0` 时输出一条 `dimension={}` 的占位指标（`status="insufficient_data"`、`value=null`、`numerator_count=0`、`denominator_count=0`、`evidence=[]`），保证五项指标按 spec 顺序齐全。
2. `skill_demand_share`：展开 `jsonb_array_elements_text(skills)` 分组，按 `COUNT(*) DESC, skill_id ASC` 取前 10 个技能，各输出一条。`numerator_count` = 含该技能的职位数；`denominator_count` = `sample_size`；`dictionary_version` = `SKILL_DICTIONARY_VERSION`；`dimension={skill_id}`。未识别技能比例无法从当前态表度量，D1 不填 `unknown_count` / `unknown_ratio`（可选字段）。`sample_size=0` 时同样输出一条 `dimension={}` 的占位指标（同上字段）。
3. `student_friendly_share`：一条。`numerator_count` = `student_friendly='yes'` 数；`denominator_count` = `sample_size`；`unknown_count` = `student_friendly='unknown'` 数；`unknown_ratio` = `unknown_count / sample_size`（分母 0 时 `null`）；`dimension={}`。
4. `observed_new_jobs`：若 `has_multiple_snapshots=false` → `status="insufficient_data"`、`value=null`、`numerator_count=0`、`denominator_count=null`。否则取最新两个不同 `observed_at`：`t1=max`、`t0=第二大的 distinct observed_at`；`numerator_count` = `COUNT(*) WHERE first_seen_at > t0 AND first_seen_at <= t1`；`denominator_count` = `sample_size`；`value = numerator_count`（单位 count）；`status="ok"`；证据为窗口内职位。
5. `policy_job_shared_themes`：D1 固定 `status="insufficient_data"`、`value=null`、`numerator_count=0`、`denominator_count=null`、`evidence=[]`、`dimension={}`；政策证据接入留 D3。

每条指标的 `as_of` = `last_observed_at`；`sample_size` = `sample_size`；`evidence` 取该维度对应职位 `ORDER BY last_seen_at DESC, id ASC LIMIT 5`，元素为 `{kind:"job", id:String(id), title, official_url}`。

`warnings`：

- `sample_size=0` → `[{code:"insufficient_data", message:"尚未采集到任何职位。"}]`，其余指标均 `insufficient_data`/`null`；
- `sample_size>0` 且 `unknown` 职族 >0 → 追加 `{code:"unknown_fields", message:"存在未识别职族的职位，已单列 unknown。"}`；
- `sample_size>0` 且 `student_friendly='unknown'` >0 → 追加 `{code:"unknown_fields", message:"存在未标记应届友好度的职位，unknown 不表示不友好。"}`；
- 政策侧固定追加 `{code:"insufficient_data", message:"尚未接入政策证据，共享主题暂不计算。"}`（D2 实现文案；D1 测试断言已同步）。

### C-INGEST@1

提供方文件：`backend/ingest.ts`；消费方：`backend/sql-repository.ts`、`backend/queue.ts`、`tests/ingest.test.ts`。

```ts
export async function ingestBatch(db: Db, batch: CareerObservationBatchV1): Promise<IngestResultV1>;
```

- `batch.jobs.length > 100` → 抛 `InvalidParameterError`（来自 `backend/errors.ts`），不写库。
- 逐条 `validateNormalizedJobV1(job)`：无效 → `rejected++`，`errors.push({index, code:"validation_failed", message:<前 3 条 issue 的 code:message 拼接>})`，不写该条；有效条目进入写入阶段。
- 全部写入在一个事务内（`db.begin`，若 `db` 已是事务对象则直接使用）：任一条 SQL 失败整批回滚并抛错（队列重试）。校验 `rejected` 不触发回滚。
- 写入每条有效职位：
  1. `SELECT id, content_hash, last_seen_at FROM career_jobs WHERE source_key=$1 AND job_key=$2 FOR UPDATE`
  2. 无行 → `INSERT` 全部当前态列，`first_seen_at = last_seen_at = job.fetched_at`，`created_at = updated_at = job.fetched_at`；`accepted++`。
  3. 有行且 `content_hash` 相同 → 仅 `UPDATE career_jobs SET last_seen_at = GREATEST(last_seen_at, $fetched_at), updated_at = now()`；`duplicates++`。
  4. 有行且 `content_hash` 不同 → 更新除 `id/source_key/job_key/first_seen_at/created_at` 外全部当前态列，`last_seen_at = GREATEST(last_seen_at, $fetched_at)`，`updated_at = now()`；`updated++`。
  5. 观测：`INSERT INTO career_job_observations (job_id, observed_at, content_hash, collector_version, source_url, raw_excerpt) VALUES (...) ON CONFLICT (job_id, observed_at, content_hash) DO NOTHING`；`observed_at = job.fetched_at`（逐条真实采集时间，不用 `batch.fetched_at` 替代）；`source_url = job.official_url`；`raw_excerpt = job.raw_text.slice(0, 500)`。
- `last_seen_at` 只前进不后退（`GREATEST`）；`first_seen_at` 永不改写。
- jsonb 列（`locations`、`skills`、`skill_evidence`、`raw_payload`、政策的 `theme_ids`）必须经 `sql.json(value)` 传参；不得先 `JSON.stringify`，否则 postgres.js 会把字符串再编码为 JSON 字符串标量（实测 `jsonb_typeof` 为 `string`，导致 `@>` 过滤失效、`jsonb_array_elements_text` 报 22023、共享主题查不到）。
- 返回 `{accepted, updated, duplicates, rejected, errors}`，`errors` 按 `index` 升序；四个计数之和等于 `batch.jobs.length`。
- 幂等：同一批次连续执行两次，第二次 `accepted=0`、`duplicates=n`、观测行数不变、`last_seen_at` 不倒退。

### C-QUEUE@1

提供方文件：`backend/queue.ts`；消费方：`server.ts`、未来 B/C 采集侧。

```ts
export const careerIngestQueue: ModuleQueue<CareerObservationBatchV1>;
```

- `name = "career-insights.ingest"`
- `options = { retryLimit: 3, retryDelay: 60, retryBackoff: true, expireInSeconds: 600 }`
- `worker = { batchSize: 1 }`
- `run(batches)`：逐个 `await ingestBatch(sql, batch)`，返回四计数之和；任一失败抛出，由 pg-boss 重试。
- 采集侧入队：`enqueueOn(careerIngestQueue, batch)`；本阶段不新增 HTTP `POST` 写入接口。

### C-TEST@1

提供方文件：`modules/career-insights/tests/repository.test.ts`、`tests/ingest.test.ts`；消费方：本阶段验收与 review。

- 使用 `import "../tests/../...`? 否：测试文件位于 `modules/career-insights/tests/`，导入 `@aihot/backend/db`、`../backend/sql-repository.ts`、`../backend/ingest.ts`、`../contracts/api.ts`。
- 测试数据一律通过 `ingestBatch` 构造（覆盖真实写入路径），不手写 `career_jobs` 的 `INSERT` 全列。
- 必须覆盖：重复批次幂等；`first_seen_at` 不随第二次采集改变且 `last_seen_at` 推进；内容哈希变化计入 `updated`；无效条目 `rejected` 且同批合法条目写入；筛选/分页/total；详情观测摘要与 `id` 为字符串；空表 summary/jobs 的 `insufficient_data` 语义；单快照 `observed_new_jobs` 为 `null`。
- 运行命令：`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/career_insights_test node --test-global-setup=tests/databases.ts --import ./tests/databases.ts --test --test-timeout=120000 "modules/career-insights/tests/*.test.ts"`。

## 2.3 服务交互矩阵

| caller | callee | 方法 | 事务边界 | 锁顺序 | 幂等 |
|---|---|---|---|---|---|
| `server.ts`（API 进程） | `SqlCareerRepository` | `summary` / `listJobs` / `jobDetail` | 无事务，只读 | 无 | 只读 |
| `SqlCareerRepository.writeBatch` | `ingestBatch` | 写入批次 | 单批一个事务 | 先 `career_jobs` 行 `FOR UPDATE`，再 `career_job_observations` INSERT | `(source_key,job_key)` upsert + `(job_id,observed_at,content_hash)` DO NOTHING |
| worker `career-ingest` | `ingestBatch` | 队列消费 | 每批一个事务 | 同上 | 同上；失败重试不重复计数 |
| B/C 采集侧（未来） | `careerIngestQueue` | `enqueueOn` | 生产者事务可选 | 无 | 同一批次内容重复入队由 ingest 幂等吸收 |

任务边界：T1 只写读路径与 `server.ts`；T2 只写 `ingest.ts` / `queue.ts`；两者通过 C-REPO@1、C-INGEST@1、C-QUEUE@1 的固定签名对接。T3 只写测试文件。T4 只读 review。