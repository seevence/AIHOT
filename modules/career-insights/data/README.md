# Career Insights 数据契约

本目录提供 `C-DATA@1`：归一化职位运行时校验、五项指标规范、0.1 版技能/主题词典。所有导出均为纯数据或纯函数，不触发采集、网络、数据库或模型调用。

## 职位校验

```ts
import { validateNormalizedJobV1 } from "@aihot/career-insights/data";

const result = validateNormalizedJobV1(input);
if (!result.ok) {
  console.error(result.errors); // Array<{ path: string; message: string }>
}
```

校验器不修改输入、不补全缺值，并尽可能一次返回全部错误。`unknown`、`null` 与空数组是未知信息的合法约定空值；不得把未知经验转换为 0，也不得把未知职族或学生友好状态转换为确定分类。`skills` 与 `skill_evidence.skill_id` 必须指向同一技能集合。

## 指标语义

`METRIC_SPECS_V1` 固定包含以下五项，顺序不得调整：

1. `job_family_share`
2. `skill_demand_share`
3. `student_friendly_share`
4. `observed_new_jobs`
5. `policy_job_shared_themes`

分母为 0 或证据不足时使用 `status="insufficient_data"`、`value=null`。`observed_new_jobs` 至少需要两个不同观测快照；单快照不得返回 0、增长或下降趋势。政策与职位共享主题由 API 的 `shared_themes` 列表承载，不编码为数值。

## 词典

`SKILL_ALIASES` 将技能别名映射到稳定技能 ID，`THEME_LABELS` 提供主题 ID 的展示名。版本常量均为 `0.1`；词典只提供映射，不自动修改职位数据。

## 联调数据

`../fixtures/api.ts` 提供 summary、jobs、detail 三份固定联调对象，`data_origin` 均为 `synthetic_fixture`。这些对象完全虚构，不表示真实公司、真实政策或真实趋势，不得接入正式 repository。