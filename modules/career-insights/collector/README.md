# Career Insights 采集线

本目录只定义官方候选来源和原始职位适配器边界。准备阶段所有来源均为 `enabled=false`，`CAREER_SOURCE_ADAPTERS` 为空；导入本模块不会发起网络请求、数据库写入或模型调用，也不代表已经实现自动采集。

## 来源与访问限制

`sources.ts` 登记阿里巴巴、腾讯、字节跳动官方招聘入口，以及中国政府网、国家发展改革委官方政策入口。招聘页面按公开动态页面预留 `playwright` 访问方式，政策页面预留 `http` 访问方式；这些选择不代表已完成真实试抓。

后续试抓只能访问公开内容，须遵守网站条款并限制频率。遇到登录、验证码、robots 限制或其他访问控制时，应记录限制并保持来源停用，不得绕过。政策页面不得被包装成职位记录。

## 原始样本

适配器只产出 `RawCollectedJobV1`，保留官方页面原文和原始响应，不在采集层归一化职位或计算指标。以下仅是字段形状示例，不是真实采集结果，不可用于指标或联调数据：

```ts
import type { RawCollectedJobV1 } from "../contracts";

const rawSample: RawCollectedJobV1 = {
  schema_version: "1.0",
  source_key: "alibaba-official-careers",
  source_job_id: null,
  company_name: "<官方页面中的公司名>",
  title: "<官方页面中的职位名>",
  official_url: "<职位官方详情页 URL>",
  raw_text: "<官方页面原文>",
  raw_payload: { /* 可选：未经改写的原始响应 */ },
  published_at: null,
  fetched_at: "<本次实际抓取时间的 UTC ISO 8601 字符串>",
  collector_version: "<适配器版本>",
  hints: {
    role_family: "unknown",
    locations: [],
    degree_raw: null,
    experience_raw: null,
    employment_type: "unknown",
    skill_terms: [],
  },
};
```

每次成功抓取都应生成新的 `fetched_at` 并记录适配器版本。官方字段未知时保留 `null`、`unknown` 或空数组，尤其不得把未知经验写成 `0`；空结果不等于市场无岗位。真实适配器验收时应保存对应原始样本及来源 URL，不能用手工编造内容替代。

## 失败记录

`collect` 应将 HTTP、解析和访问限制错误抛给调用方，并在错误上下文中保留 `source_key`，不得把失败吞掉后返回空成功。调用方的失败日志至少记录：

- `source_key` 与 `entry_url`；
- 实际尝试时间；
- 失败阶段：`fetch`、`parse` 或 `access`；
- 原始错误名称和消息，以及适用的 HTTP 状态或访问限制说明。

单次失败不得覆盖已有职位状态；本次未抓到职位也不能据此推断职位下架。

## 后续适配器挂接

1. 为真实来源新增独立适配器，实现 `CareerSourceAdapter`，令其 `definition` 使用已登记的来源定义。
2. 在 `collect(signal?)` 中尊重取消信号，只返回原始 `RawCollectedJobV1[]`，不写数据库、不计算指标、不调用前端。
3. 在 `sources.ts` 显式导入适配器实例，并加入 `CAREER_SOURCE_ADAPTERS`；不得用伪适配器或固定样本填充注册表。
4. 完成真实试抓、原始样本验收和访问限制记录后，再按共享契约变更流程评审来源启用状态。