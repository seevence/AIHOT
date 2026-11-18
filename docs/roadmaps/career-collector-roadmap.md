# Career Insights 采集线路线图（B）

> 角色：B 采集。写集：`modules/career-insights/collector/`、本文件。
> 原则：逐源启用，每源单独提交 + 单独 gate；采集层只产出原文，不写库、不归一化、不计算指标。

## 阶段划分

| 阶段 | 目标 | 依赖 | 状态 |
|---|---|---|---|
| B0 准备 | 候选来源登记、纪律层（超时/限速/阻断/预算）、样本 manifest 与 quota | 无 | 已完成（`ea5fc43`） |
| B1 门禁修复 | 四项共同架构修复 + 腾讯单源启用与 live 证据 | 无 | 开发完成；独立审查 5 个 major 已修，待 A 复核 |
| B2 政策逐源 | 发改委 → 教育部 → 国务院 顺序启用，每源单独 gate | B1 PASS | 未开始 |
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

## B2 待办（B1 PASS 后逐个提交）

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
