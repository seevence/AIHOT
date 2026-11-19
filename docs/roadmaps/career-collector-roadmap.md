# Career Insights 采集线路线图（B）

> 角色：B 采集。写集：`modules/career-insights/collector/`、本文件。
> 原则：逐源启用，每源单独提交 + 单独 gate；采集层只产出原文，不写库、不归一化、不计算指标。

## 阶段划分

| 阶段 | 目标 | 依赖 | 状态 |
|---|---|---|---|
| B0 准备 | 候选来源登记、纪律层（超时/限速/阻断/预算）、样本 manifest 与 quota | 无 | 已完成（`ea5fc43`） |
| B1 门禁修复 | 四项共同架构修复 + 腾讯单源启用与 live 证据 | 无 | **PASS，已合入集成（PR #3 + follow-up #4，`d406c16`）** |
| B2a 三家 job 源 | 腾讯 + 美团 + 百度，三家均为国内互联网/AI 公司，公开 JSON、无登录、无签名 | B1 PASS | **PASS，已合入集成 `a738569`** |
| B2b 政策逐源 | 发改委 → 国务院（教育部因 https 必跳 http 不启用） | B1 PASS | **发改委 PASS（`fa18e9b`）；国务院 PASS，已合入 `9f90e4c`（PR #9）**；教育部不启用 |
| B3 真实入库 | normalize → ingest → career_jobs/observations 闭环 | D2 已合入 `8004c8a` | **已完成（PR #8 `5ff6e8f`；六源重跑证据 PR #9 `ec7e665`）**；normalizer 0.2.0 经 backfill 覆盖 40/40（100%），样本量受采集窗口限制（10 条/源），明细见下文 |

## B1 已完成内容（2026-11-18）

按 A 的门禁结论修复四项结构性问题，只启用腾讯一个来源：

- `CareerSourceDefinition.enabled` 由字面量 `false` 改为 `boolean`，来源可显式启用。
- `registry.ts` 新增 `createCareerAdapters(transport)`：只构造 `enabled=true` 的来源，job 与 policy 返回两张独立注册表，policy 不再混入 job 注册表。
- `HttpTransport` 拒绝 HTTPS→HTTP 重定向降级，记 `access_blocked` / `scheme_downgrade`。
- 政策适配器缺 issuer 或发布时间时不再静默 `continue`，整批抛 `ParseFailedError`；`runPolicySource` / `runEnabledPolicySources` 独立运行政策批次。

## B1 验证证据

| 项 | 结果 |
|---|---|
| `npx tsc -p modules/tsconfig.json` | 通过 |
| collector standalone | 73/73 通过（含 replay 零网络、降级守卫、注册表分离、政策 fail-closed 两项回归） |
| live collect | 腾讯 10 条真实职位，15.3s，HTTP 200，未绕登录/验证码/403 |
| live 证据文件 | `modules/career-insights/collector/evidence/live-runs/20261118T1355Z-tencent.json`（含每条 PostId / official_url / raw_text sha256） |
| 启用面 | 仅 `tencent-official-careers` = `enabled=true`，其余五源 `enabled=false` |

## B2b 门禁（逐源提交，已全部通过）

顺序：`ndrc-policy` → `state-council-policy`。`moe-policy` **不启用**：其所有 HTTPS 请求都被源站跳到 HTTP，不能为单源打开 HTTPS→HTTP 例外。`国家工信部/人社部` 栏目为 JS 空壳，零依赖不可抓取，不采用。每个启用源必须满足：

- 3/3 详情解析成功，跳过数 0；缺 issuer/发布时间整批失败，不返回部分成功。
- live 一次：HTTP 200、`final_url` 为 HTTPS、无登录/验证码/403。
- 只启用该来源时，policy 注册表只含它，网络调用集合只含该来源。
- PR + A 独立 review PASS 后再提交下一源。

## B3 完成口径（D2 已合入，门禁已达）

- 用 `ingestWithRun(db, batch, "live")` 写入真实批次；`observed_at` 取每条 `fetched_at`，`batch_id` 由 DB 侧 `start_ingest_run` 生成。
- 最小断言：`career_jobs` 与 `career_job_observations` 各新增 ≥1 行；`data_origin=live`；summary 的 `sample_size ≥ 1`；重复批次不产生重复行。
- 不得把 D2 提交塞进本 PR，也不得把 PR base 指向未合并分支。

## 未关闭项

| # | 事项 | 需要谁 |
|---|---|---|
| 1 | 验收口径：ROADMAP 要求“3 家公司 + 2 政策源”，当前实际 3 家招聘（腾讯/美团/百度）+ 2 政策源（发改委/国务院），已满足，待 A 确认收口 | A / 用户裁定 |
| 2 | BOSS 直聘登录态采集不可用（Playwright 无 Chrome/Chromium，Edge 复用失败），已终止该路线 | 已记录，不再尝试 |
| 3 | 腾讯 `official_url` 由来源返回 `http://` 详情页，属来源字段本身而非传输降级 | 记录项，展示时按原文 |
| 4 | collector standalone 测试未进入云端 CI | A |
| 5 | ~~C 归一化覆盖率与 duplicate 刷新缺口~~：已关闭——0.2.0 经 backfill 覆盖 40/40（100%）；duplicate 刷新派生字段与 `NORMALIZER_VERSION` 落库（`0163`）此前已关闭 | 已关闭 |
| 6 | C 侧口径待决策：`content_hash` 语义边界（`f7dc6f4` 已收窄输入）、标题 vs hint 优先级、是否设 `sales` 职族、"运营"词精度 | A |
| 7 | E 真实数据复验：backfill 已完成（40/40），E 复验已启动 → **已更新（已被后续取代）**：E1–E5 + E6 已合入（`cd69c68`）；真实数据复验第一段 22/22、第二段 43/43、扩采 74 行增量 39/39 全 PASS；政策列表页前端仍 404（未覆盖项，路由属 A） | E（已收口） |
| 8 | 采集覆盖率改进：`--pages` 已打通（`1d80431` / `93365ac` / `344e952`），2 页已实测（见「采集窗口打通与 --pages 2 扩采」）；是否继续扩到 3–10 页待 A 排期 | B / A 排期 |

## B2a 三家 job 源（2026-11-18）

口径：ROADMAP 要求 3 家公司，且必须是国内互联网/AI 公司。原阿里 403、字节 405 全部按纪律停止，改为补两家新源。

| 源 | 端点 | 条数 | 结论 |
|---|---|---|---|
| 腾讯（B1） | `GET /tencentcareer/api/post/Query` + `ByPostId` | 2118 | 已启用 |
| 美团 | `POST /api/official/job/getJobList` | 3399 | 列表即含职责/要求，不请求详情 |
| 百度 | `POST /httservice/getPostListNew` | 1651 | 需常规 origin/referer；列表即含正文 |

已否决的候选（不绕过）：字节 405、阿里 403、快手前端 sign、拼多多 `anti_content`、京东登录墙；AI 公司组（商汤/MiniMax 需飞书 SaaS header 差 1 次复测、旷视验证码、智谱无公开数据源、讯飞登录墙）本轮 0 可用。

实现要点：
- `PageRequest` 扩为 `GET | POST` + `body`；POST 不接受重定向，避免静默降级为 GET。
- 回放键对 POST 追加 body 摘要，同一 URL 不同页码不会撞成同一份样本。
- 每源 5 页真实样本，job 源样本下限 5 满足。
- live：三源各 10 条全 success，证据 `evidence/live-runs/20261118T1437Z-three-jobs.json`。

### 数据源性质（必须记录，避免误读）

- 三家接口给出的都是**社会招聘岗位库**，不是校招岗位库：百度 `recruitType=CAMPUS` 实测返回 `status=fail`；美团 `jobShareType=2` 语义不明；关键词"应届"在三家只能筛出 1–2 条不相关结果。
- 因此本项目采集的是"公开招聘需求结构"，用于观察技能与经验门槛的变化趋势，**不能表述为"校招岗位统计"**。
- 应届友好度的判定不放在采集层：B 只保留 `hints.experience_raw` / `hints.degree_raw` 原文，由 C 在指标层输出经验门槛分布与"应届友好岗位占比"（经验为空或 0–1 年）。
- 腾讯 / 美团 / 百度三条数据的 `employment_type` 统一为 `unknown`，不做推断。

## B2b 政策源（2026-11-18）

顺序调整说明：A 原定 发改委 → 教育部 → 国务院，但实测教育部所有请求 https 必跳 http（4 份样本 `final_url` 全为 `http://`），与"live 时 final_url 必须 HTTPS"的门禁冲突且无法通过重新抓取满足；工信部/人社部栏目为 JS 空壳（约 2KB、零静态链接）不可零依赖抓取。故 B2b 实际顺序改为 发改委 → 国务院。

### 发改委（已启用）

| 项 | 结果 |
|---|---|
| 适配器 | 既有 `createNdrcPolicySourceAdapter`，issuer 固定 "国家发展改革委" |
| 启用 | `sources.ts` 中 `ndrc-policy` = `enabled=true`；`createCareerAdapters` 的 policy 注册表只含它 |
| 测试 | collector standalone **88/88** |
| live | 1 列表 + 3 详情全 success，3 条 PolicyEvidenceRefV1，5.8s |
| 证据 | `evidence/live-runs/20261118T1508Z-with-ndrc.json`（同时含三家 job 源当晚 live） |

### 国务院（已启用，PR #9 / `9f90e4c`）

| 项 | 结果 |
|---|---|
| 适配器 | `state-council-policy`；issuer 从标题/正文推断（缺 issuer 或发布时间整批失败） |
| 启用 | `sources.ts` 中 `enabled=true`；只启用该源时 policy 注册表只含它 |
| source_tier | `government_official`（与 backend 契约一致） |
| live | 1 列表 + 3 详情全 success，issuer 3/3（中共中央 2 + 国务院 1） |
| URL 形态 | 两种详情 URL 均覆盖：`/zhengce/202611/content_*.htm` 与 `/zhengce/content/202611/content_*.htm` |
| 门禁 | 跳过 0、`final_url` 全 HTTPS、HTTP 200、无登录/验证码/403 |
| 证据 | `evidence/live-runs/20261119T0818Z-state-council.json`（见 PR #9） |

## B3 真实数据闭环（2026-11-19 跑通）

命令：`npx tsx modules/career-insights/collector/cli/ingest-career.ts --live`（必须显式 `--live`）。

### 首轮（国务院启用前）

| 项 | 结果 |
|---|---|
| job 入库 | 腾讯 / 美团 / 百度 各 10 条，`career_jobs=30`，`data_origin=live` |
| 政策入库 | `ndrc-policy` 3 条，`career_policies=3` |
| 观测历史 | `career_job_observations` 从 10 → 100（多个观测时点） |
| 幂等 | 第二轮三源全部 `duplicates=10`、政策 `duplicates=3`，`career_jobs` 不增 |
| API | `summary` 返回 `data_origin=live`、`sample_size=30`、`company_count=3` |
| 验收 | `scripts/check-career-integration.ts --require-data` 六项全绿 |
| 证据 | `evidence/live-runs/20261119T0818Z-ingest.json` |

### 契约修复

`source_tier` 两侧语义错位：collector 输出 `national`/`ministry`（层级），backend 只接受 `government_official`/`official_media`/`other_public`（来源性质）。已统一为 `government_official`，政策批次由 `rejected=3` 变为 `accepted=3`。

### 六源重跑（本次实测，含国务院）

参与源共 5 个：腾讯 / 美团 / 百度三家 job 源 + 国务院 / 发改委两家政策源；`moe-policy` 未启用，不参与。

| 项 | 结果 |
|---|---|
| `career_jobs` | 34 |
| `career_job_observations` | 160 → 190（+30） |
| `career_policies` | 6（国务院 3 + 发改委 3，`source_tier` 均为 `government_official`） |
| `career_ingest_runs` | 28，`data_origin` 全部 `live` |
| rejected | 0（全部源） |
| 验收 | `scripts/check-career-integration.ts --require-data` 六项全过 |
| 证据 | `evidence/live-runs/20261119T0857Z-ingest-c-normalized.json`（六源启用证据：`20261119T0832Z-six-sources.json`，PR #9 `ec7e665`） |

逐源（collected / accepted / updated / duplicates）：

| 源 | collected | accepted | updated | duplicates |
|---|---|---|---|---|
| `tencent-official-careers` | 10 | 0 | 9 | 1 |
| `meituan-official-careers` | 10 | 0 | 0 | 10 |
| `baidu-official-careers` | 10 | 0 | 0 | 10 |
| `state-council-policy` | 3 | 0 | 0 | 3 |
| `ndrc-policy` | 3 | 0 | 0 | 3 |

本轮（0.1.0 阶段）重跑**只刷新了 9 行**（tencent `updated=9`），其余 21 条 job 全部为 `duplicates`，当时不构成"归一化全面生效"；0.2.0 落库并经 backfill 后为 40/40（100%），见下一节。

### 已知质量缺口（转 C）

首轮真实数据上 `role_family` 全为 `unknown`、`skills` 全空、`student_friendly=unknown`。C 已合入真实数据归一化（`30cf01a`），0.1.0 重跑后仍存在覆盖率与刷新缺口；0.2.0 的结果见下一节。

## C 归一化 0.2.0 最终状态（2026-11-19，backfill 已 apply，review PASS）

`normalizer/0.2.0` 已落库，T7 独立复核 PASS；最后 10 行窗口外职位经 backfill 于 09:58:37Z 补齐。最终口径是 **40/40 全部为 0.2.0（归一化覆盖 100%）**。但样本规模仍受采集窗口限制（首发 10 条/源），趋势结论必须注明样本口径，不能表述为“全面生效”或“全量覆盖”。

### 时间线（实测）

| 项 | 时间（UTC） |
|---|---|
| migration `0163_career_jobs_normalizer_version.sql` applied | 09:42:49.177 |
| 本次 run started / finished | 09:42:59.833 / 09:43:36.548 |
| backfill `--apply`（10 行，单事务） | 09:58:37 |
| 证据 | `evidence/live-runs/20261119T0942Z-ingest-normalizer-0.2.0.json`；backfill 日志 `.data/backfill-20261119/`（`.gitignore` 覆盖，不入库） |

### backfill 执行记录（09:58:37Z，已 apply）

| 项 | 实测 |
|---|---|
| 范围 | 恰为原 0.1.0 的 10 个 id，无其他行 |
| 写入 | 单事务更新 10 行，`updated_at` 全部一致 |
| 结果 | `normalizer_version` 0.2.0 = 40 / 0.1.0 = 0，覆盖率 100% |
| 幂等 | 第二次 `--apply` 候选 0 / 变更 0；第二份全量快照与执行后快照 `diff` 逐字节一致 |
| review | PASS：0 Critical / 0 Important / 6 minor（清单见下） |

未被污染的证据（backfill 前后校验和一致）：

| 项 | 实测（前后一致） |
|---|---|
| `career_jobs` | 40；按源 baidu 11 / meituan 18 / tencent 11 |
| `career_job_observations` | 196，md5 `c8483d01121c4f10efbf8f6a737f6c50` |
| `max(last_seen_at)` | `2026-11-19 09:43:21.637+00`（未被 backfill 改写） |
| `created_at` 区间 | 前后一致，无新增或删除 |
| 来源侧全表 md5 | `9ed361a2edc762ca29a1ba3e3de4f0d9` |
| 抽样 5 行 `content_hash` | 前后一致 |

backfill review 的 6 项 minor（如实记录，本轮未修正）：

| # | minor | 影响 |
|---|---|---|
| 1 | 事务外 `SELECT` 与事务内写的陈旧覆盖窗口 | 并发写入时可能覆盖新值；本次为串行回填，未触发 |
| 2 | 未校验 `UPDATE` 的 `rowCount` | 部分失败时不会显式报错 |
| 3 | 回填未加 `data_origin` 过滤 | 当前无其他 origin 数据，无实际影响 |
| 4 | `signature` 对 `skills` 排序去重 | 与 0.2.0 重算可能不同序，不影响集合 |
| 5 | `raw_payload` 未用于 hints 兜底 | 见下方口径边界 |
| 6 | 头注释未提 hints 限制 | 文档层面待补 |

回填口径边界（必须披露）：

- `career_jobs` 无 `source_job_id`，`raw_payload` 也不含 `hints`，回填无法重建原始采集输入。
- 因此 `locations` / `degree_raw` / `experience_raw` 取 DB 现有列，`role_family` / `employment_type` / `skill_terms` 用默认值 + `0.2.0` 文本扫描。
- 能证明的只是“重建输入 → DB 值”可复现（10/10，mismatch 0）；**无法回溯原始 hints 下应得的值**，这 10 行口径与线上采集路径不完全等价。

### 全库现状（backfill 后 psql 复核）

| 维度 | 实测 |
|---|---|
| `career_jobs` | 40（baidu 11 / meituan 18 / tencent 11） |
| `career_job_observations` | 196（本次 +6；backfill 不写观测） |
| `career_policies` | 6 |
| `career_ingest_runs` | 33 |
| rejected | 本次 run 0；全库累计 6，均为 08:12 / 08:13 两次政策 run（`source_tier` 契约修复前 `rejected=3`×2），非本轮 |
| `normalizer_version` | 0.2.0 = 40 / 0.1.0 = 0 |
| `role_family` | unknown 23 / ai_product_operations 7 / ai_application_development 7 / data 2 / ai_algorithm 1 |
| `student_friendly` | no 29 / unknown 11 |
| `skills` 非空 | 29/40（backfill 前后未变，现全部为 0.2.0 口径） |
| `--require-data` | 6/6 通过 |

### 本次 run 逐源（collected / accepted / updated / duplicates）

| 源 | collected | accepted | updated | duplicates |
|---|---|---|---|---|
| `tencent-official-careers` | 10 | 0 | 0 | 10 |
| `meituan-official-careers` | 10 | 5 | 0 | 5 |
| `baidu-official-careers` | 10 | 1 | 0 | 9 |
| `state-council-policy` | 3 | 0 | 0 | 3 |
| `ndrc-policy` | 3 | 0 | 0 | 3 |

job 侧合计 accepted 6 / updated 0 / duplicates 24；`career_job_observations` 仅 +6。

### 6 行新增为真实新职位（非归一化虚增）

- 新增 `job_key` 与既有无交集（`(source_key, job_key)` 无重复对），全库 `official_url` 重复组 0。
- meituan 5：`4527890989` / `4563930748` / `4709087193` / `4895246532` / `4740500750`；baidu 1：`915aa9f3-51d6-4c24-bed9-b7fa9b829b5e`。
- 源站第 1 页实测 10 条与 DB 本次观测逐条一致。
- 去重键 `(source_key, job_key)` 与 normalizer 无关，故新增不是归一化导致的虚增。
- 全库唯一同名组：meituan「无人车资深后端研发工程师」×2，属源站第 2 页不同 `jobUnionId`，非重复写入。

### 10 行原为 0.1.0 的根因：采集窗口（非下架）

| 项 | 实测 |
|---|---|
| 采集窗口 | 三个 adapter 固定 `pageLimit=1 × pageSize=10`；tencent 在售 2091 条，每次只覆盖首页 10 条 |
| `last_seen_at` | 10/10 行为 08:16:03 ~ 08:58:07，均早于本次 run 09:42:59 |
| 源站复核 | meituan 8/8 落在第 2 页；baidu 1/1 在第 2 页第 1 条；tencent `2122282936190550016` 经 ByPostId 返回 200 且标题一致 |
| 结论 | 10 行仍在售，落选原因是分页窗口未覆盖，不是下架 |
| 覆盖率 | backfill 前 30/40 = 75%；09:58:37Z backfill 后 40/40；采集侧仍只覆盖首页 10 条/源，分页改进待下一阶段 |

### duplicates 分支刷新已生效

- 版本闭合（backfill 前）：24 条 duplicates 刷新 + 6 条新增 = 30 条 0.2.0，与证据 `duplicates 10+5+9=24`、`updated=0` 吻合；余 10 条由 backfill 补齐。
- observations 仅 +6，证明 24 条未走 `updated` 分支（duplicates 分支只推进 `last_seen_at`）。
- 3 条重算（meituan `4697280304` / tencent `2046923451989651456` / baidu `0a125468…`）的 `role_family` / `student_friendly` / `employment_type` / `skills` 与 DB 100% 一致。

### 口径风险（minor，如实记录）

| 项 | 说明 |
|---|---|
| `content_hash` 口径 | 输入在 `f7dc6f4` 被收窄，24 条刷新行 `content_hash` 全部变化（diff 24 / same 0），"`content_hash` 未变"口径不成立；同源判定靠 `sourceContentEquals` 兜底 |
| 观测计频 | duplicates 分支不再写 `career_job_observations`，"每次 run 一条观测"的按观测计频会断层 |
| 本地调试 | `docker-compose.yml` 端口映射改动未提交 |

### 0.1.0 阶段的历史结论（对照）

0.1.0 阶段（六源重跑 `20261119T0857Z`）只刷新 9 行（tencent `updated=9`），其余 21 条 job 走 duplicates；DB `role_family` unknown 28/34，离线重算命中 22/34、16 行（47%）滞后。其中"duplicate 分支不刷新派生字段""`NORMALIZER_VERSION` 未落库"两项已由 0.2.0 与 `0163` 关闭，其余口径项已转 A。

### 小结

真实数据闭环在归一化维度已达到 40/40（100%），但样本规模仍受采集窗口限制（首发 10 条/源），趋势结论需注明样本口径。

### 待办

| # | 事项 | 归属 / 状态 |
|---|---|---|
| 1 | 采集覆盖率改进：`--pages` 已打通并完成 2 页扩采（74 行基线），是否继续扩页待 A 排期 | B 写集；2 页已完成，见下节 |
| 2 | E 真实数据复验（~~已启动~~ → **已更新，已被后续取代**） | 已收口：E1–E5 + E6 已合入（`cd69c68`）；第一段 22/22、第二段 43/43、扩采 74 行增量 39/39 全 PASS；政策列表页前端仍 404（未覆盖项，路由属 A） |

### 待 A 决策的 C 侧口径

以下只列出，未由 B 决定：

1. `content_hash` 语义边界：`role_family` / `student_friendly` 等派生字段是否应进入 hash（`f7dc6f4` 已收窄输入，口径待确认）。
2. 标题与 hint 的优先级（标题命中是否压过 `hints.experience_raw` 等）。
3. 是否单设 `sales` 职族，避免销售岗位被"大模型"等词抢占。
4. "运营"词精度：是否排除运营商 / 安全运营等组合。
5. ~~duplicate 分支是否应刷新派生字段~~：已由 0.2.0 关闭（duplicates 分支现刷新派生字段，仅不写 observations）。
## 采集窗口打通与 --pages 2 扩采（2026-11-19）

本节数字均来自 `20261119T1134Z-ingest-pages2.json` 与主库（`aihot-db-1`，库 `aihot`）psql 实测，未做推算。

### CLI → runner → adapter 打通

- `--pages N` 已从 ingest CLI 贯通到 runner 的 `RunContext.pageLimit`，再透传给三个 job adapter 的分页循环：`1d80431`（CLI 接 `--pages`）、`93365ac`（识别 `--pages=N` 等号写法）、`344e952`（ingest 路径接通并在 report 记录 `page_limit`）。
- 缺省仍为 1（`DEFAULT_PAGE_LIMIT`），保持每源首屏既有口径；`--pages=N` 与 `--pages N` 等价。
- 空值、非整数、越界（1..10）均抛 `CliArgumentError` 并 `exit=2`，在发起任何网络请求前退出，不静默回退。
- 提交后 report 顶层写入 `page_limit`；本次证据为 `page_limit=2`。

### 扩采实测

命令：`npx tsx modules/career-insights/collector/cli/ingest-career.ts --live --pages 2`

证据：`modules/career-insights/collector/evidence/live-runs/20261119T1134Z-ingest-pages2.json`（started `11:34:50.770Z` / finished `11:35:53.073Z`，wall 62.3s）。

| 源 | collected | accepted | updated | duplicates | elapsed |
|---|---|---|---|---|---|
| `tencent-official-careers` | 20 | 10 | 0 | 10 | 37.158s |
| `meituan-official-careers` | 20 | 15 | 0 | 5 | 3.861s |
| `baidu-official-careers` | 20 | 9 | 0 | 11 | 4.109s |
| `state-council-policy` | 3 | 0 | 3 | 0 | 0.020s |
| `ndrc-policy` | 3 | 0 | 3 | 0 | 0.009s |

job 侧 collected 60 / accepted 34 / updated 0 / duplicates 26；全源 `rejected=0`。

### 库内结果（psql 实测）

| 维度 | 扩采前 | 扩采后 |
|---|---|---|
| `career_jobs` | 40 | 74 |
| `career_job_observations` | 196 | 230（+34，等于本轮 accepted） |
| `career_policies` | 6 | 6 |
| `career_ingest_runs` | 33 | 38（+5：3 job + 2 policy） |

- 按源：baidu 20 / meituan 33 / tencent 21。
- `normalizer_version`：`normalizer/0.2.0` = 74（全表统一，无 0.1.0 残留）。
- `role_family`：unknown 47 / ai_product_operations 13 / ai_application_development 10 / data 2 / ai_algorithm 2。
- `student_friendly`：no 57 / unknown 17（`yes` = 0）。
- `skills` 非空：55/74。
- `official_url` 重复组 0；`(source_key, job_key)` 重复组 0。
- `--require-data`：6/6 通过。

### 口径披露（必须随数字一起引用）

| 项 | 实测 |
|---|---|
| 新增 34 行 unknown 占比 | 24/34 = 70.6% |
| 旧 40 行 unknown 占比 | 23/40 = 57.5%（+13.1pp） |
| 偏移原因 | 第 2 页含采购 / HRBP / 测试 / 售前等非 AI 岗（如 meituan「硬件采购岗」「HRBP（外派中东）」、baidu「山东售前解决方案架构师」、meituan「骑行硬件-电气部件测试工程师」），复核实测，非词典漂移 |
| `student_friendly=yes` | 0（no 57 / unknown 17）；按该字段筛选会恒空，待 C 裁决 |
| 启用源 | 仍只有 3 个 job 源（alibaba / bytedance / moe 均 `enabled:false`）；2 页上限约 60 条/轮 |
| 样本口径 | 74 行为 2 页窗口基线，不是全量岗位库；趋势结论仍须注明窗口 |

## A（兼 C）对扩采后样本口径的裁定（2026-11-19）

B 侧按下列四条原文执行，不改写数字，也不扩大结论范围。

1. 74 行只作为本轮「3 源 × 2 页」采集窗口基线，**不作为 AI 岗位总体样本**；
2. unknown 47 单独展示，AI 岗位趋势只用非 unknown 子集（47 个 unknown 不进入趋势分母的"AI 岗位占比"解读）；
3. 不新增 student_friendly yes 规则；yes=0 如实显示「当前窗口暂无应届友好样本」，不得暗示企业不友好或市场没有学生岗；
4. alibaba / bytedance / moe 暂不启用（enabled:false），另开可用性任务（可用性、合规、解析器就绪度），不在本轮偷开。

### 引用规范

以后写 74 行相关结论时必须同时标注（3 源 / 2 页 / as_of 时间 / unknown 单列），禁止写成"AI 岗位占比"或"应届友好率"的单值结论。

B 侧落地要点：

- 趋势类数字旁必须同时出现 3 源、2 页窗口、`as_of` 时间三项；缺任一项即视为口径不完整。
- unknown 47 单列一行展示，与已分类子集分开展示，不并入任何比例的分母。
- `student_friendly=yes` 为 0 时只写「当前窗口暂无应届友好样本」，不推导企业态度或市场供给。

### 残余 minor（如实记录，本轮未修正）

| # | 项 | 说明 |
|---|---|---|
| 1 | evidence 逐源 elapsed 合计 45.2s vs wall 62.3s | 约 17s 未归因（进程启动、DB 写入、归一化等未被逐源计时覆盖） |
| 2 | observation 与 run 仅靠 `batch_id` 关联 | `career_ingest_runs` 无直接外键，跨表对账需经 `batch_id` |
| 3 | `collector_version` 固定 `collector/0.1.0` | 采集层版本未随分页能力升级，行为变更无法从该字段区分 |
## 最近更新

- **2026-11-19**：`origin/feat/integration` = `a5191f7`（stage 合并并推送）；本地后续提交 `254c7dc`（merge：按 A 裁定修正 unknown 与应届友好文案，源提交 `04f7cc4`）。
- 本次同步：未关闭项 #7 与待办 #2 的「E 复验已启动」已被后续取代——E1–E5 + E6 已合入（`cd69c68`），真实数据复验第一段 22/22、第二段 43/43、扩采 74 行增量 39/39 全 PASS；政策列表页前端仍 404，属未覆盖项（路由归 A）。历史结论与 74 行基线数字（jobs 74 / obs 230 / policies 6 / runs 38 等）保持不变。
