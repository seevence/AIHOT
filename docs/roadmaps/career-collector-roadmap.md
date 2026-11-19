# Career Insights 采集线路线图（B）

> 角色：B 采集。写集：`modules/career-insights/collector/`、本文件。
> 原则：逐源启用，每源单独提交 + 单独 gate；采集层只产出原文，不写库、不归一化、不计算指标。

## 阶段划分

| 阶段 | 目标 | 依赖 | 状态 |
|---|---|---|---|
| B0 准备 | 候选来源登记、纪律层（超时/限速/阻断/预算）、样本 manifest 与 quota | 无 | 已完成（`ea5fc43`） |
| B1 门禁修复 | 四项共同架构修复 + 腾讯单源启用与 live 证据 | 无 | **PASS，已合入集成（PR #3 + follow-up #4，`d406c16`）** |
| B2a 三家 job 源 | 腾讯 + 美团 + 百度，三家均为国内互联网/AI 公司，公开 JSON、无登录、无签名 | B1 PASS | **PASS，已合入集成 `a738569`** |
| B2b 政策逐源 | 发改委 → 国务院（教育部因 https 必跳 http 不启用） | B1 PASS | **发改委 PASS，已合入 `fa18e9b`**；国务院未开始 |
| B3 真实入库 | normalize → ingest → career_jobs/observations 闭环 | D2 已合入 `8004c8a` | 可开工 |

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

## B2b 待办（B2a PASS 后逐个提交）

顺序：`ndrc-policy` → `state-council-policy`。`moe-policy` **不启用**：其所有 HTTPS 请求都被源站跳到 HTTP，不能为单源打开 HTTPS→HTTP 例外。`国家工信部/人社部` 栏目为 JS 空壳，零依赖不可抓取，不采用。每个启用源必须满足：

- 3/3 详情解析成功，跳过数 0；缺 issuer/发布时间整批失败，不返回部分成功。
- live 一次：HTTP 200、`final_url` 为 HTTPS、无登录/验证码/403。
- 只启用该来源时，policy 注册表只含它，网络调用集合只含该来源。
- PR + A 独立 review PASS 后再提交下一源。

## B3 待办（等 D2 合入集成）

- 用 `ingestWithRun(db, batch, "live")` 写入真实批次；`observed_at` 取每条 `fetched_at`，`batch_id` 由 DB 侧 `start_ingest_run` 生成。
- 最小断言：`career_jobs` 与 `career_job_observations` 各新增 ≥1 行；`data_origin=live`；summary 的 `sample_size ≥ 1`；重复批次不产生重复行。
- 不得把 D2 提交塞进本 PR，也不得把 PR base 指向未合并分支。

## 未关闭项

| # | 事项 | 需要谁 |
|---|---|---|
| 1 | 验收口径：ROADMAP 要求“3 家公司 + 2 政策源”，当前实际是 1 家招聘 + 3 政策源 | A / 用户裁定 |
| 2 | BOSS 直聘登录态采集不可用（Playwright 无 Chrome/Chromium，Edge 复用失败），已终止该路线 | 已记录，不再尝试 |
| 3 | 腾讯 `official_url` 由来源返回 `http://` 详情页，属来源字段本身而非传输降级 | 记录项，展示时按原文 |
| 4 | collector standalone 测试未进入云端 CI | A |

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

### 国务院（未开始）

- 风险最高：issuer 需从标题/正文推断，详情 URL 两种形态需都覆盖，跳过数必须为 0。
- 启用前需单独复抓样本并核对 3/3 解析。

## B3 真实数据闭环（2026-11-19 跑通）

命令：`npx tsx modules/career-insights/collector/cli/ingest-career.ts --live`（必须显式 `--live`）。

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

### 已知质量缺口（转 C）

真实数据上 `role_family` 全为 `unknown`、`skills` 全空、`student_friendly=unknown`，`job_family_share=1` 只反映 unknown 一类。C 需用真实样本复验词表与指标口径后才能进入 E 与最终门禁。
