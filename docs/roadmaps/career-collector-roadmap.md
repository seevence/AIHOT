# Career Insights 采集线路线图（B）

> 角色：B 采集。写集：`modules/career-insights/collector/`、本文件。
> 原则：逐源启用，每源单独提交 + 单独 gate；采集层只产出原文，不写库、不归一化、不计算指标。

## 阶段划分

| 阶段 | 目标 | 依赖 | 状态 |
|---|---|---|---|
| B0 准备 | 候选来源登记、纪律层（超时/限速/阻断/预算）、样本 manifest 与 quota | 无 | 已完成（`ea5fc43`） |
| B1 门禁修复 | 四项共同架构修复 + 腾讯单源启用与 live 证据 | 无 | **PASS，已合入集成（PR #3 + follow-up #4，`d406c16`）** |
| B2a 三家 job 源 | 腾讯 + 美团 + 百度，三家均为国内互联网/AI 公司，公开 JSON、无登录、无签名 | B1 PASS | **PASS，已合入集成 `a738569`** |
| B2b 政策逐源 | 发改委 → 教育部 → 国务院 顺序启用，每源单独 gate | B1 PASS | 未开始 |
| B3 真实入库 | normalize → ingest → career_jobs/observations 闭环 | D2 合入 `feat/integration` | 未开始 |

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

顺序：`ndrc-policy` → `moe-policy` → `state-council-policy`。每源必须满足：

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
