import type { EmploymentType, RoleFamily, StudentFriendly } from "@aihot/career-insights/contracts";

/** 与 data/dictionaries.ts 的 THEME_LABELS 同步；data 包依赖 node:crypto，不能进浏览器构建。 */
export const THEME_LABELS: Readonly<Record<string, string>> = {
  artificial_intelligence: "人工智能",
  ai_innovation: "人工智能创新",
  digital_economy: "数字经济",
  industrial_digitalization: "产业数字化",
  data_infrastructure: "数据基础设施",
  talent_development: "人才培养",
  employment_promotion: "就业促进",
};

/** 政策来源与 collector/sources.ts 中 `enabled: true` 的政策源一致。 */
export const POLICY_SOURCE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "state-council-policy", label: "中国政府网政策文件库" },
  { value: "ndrc-policy", label: "国家发展改革委政策发布" },
];

const POLICY_SOURCE_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  POLICY_SOURCE_OPTIONS.map((option) => [option.value, option.label]),
);

/** facets.sources 可能包含静态清单之外的来源；未知来源回退显示 source_key，不丢筛选能力。 */
export function policySourceLabel(sourceKey: string): string {
  return POLICY_SOURCE_LABELS[sourceKey] ?? sourceKey;
}

export const POLICY_SOURCE_TIER_LABELS: Readonly<Record<string, string>> = {
  government_official: "政府官网",
  official_media: "官方媒体",
  other_public: "其他公开来源",
};

export const ROLE_FAMILY_LABELS: Record<RoleFamily, string> = {
  ai_algorithm: "AI 算法",
  ai_application_development: "AI 应用开发",
  data: "数据",
  ai_product_operations: "AI 产品与运营",
  unknown: "未知",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  campus: "校园招聘",
  internship: "实习",
  experienced: "社招",
  other: "其他",
  unknown: "未知",
};

export const STUDENT_FRIENDLY_LABELS: Record<StudentFriendly, string> = {
  yes: "是",
  no: "否",
  unknown: "未知",
};

/** 后端研判（CareerBriefV1）与信号（CareerSignalV1）共用的置信度等级。 */
export type ConfidenceLevel = "low" | "medium" | "high";

const CONFIDENCE_LABELS: Readonly<Record<ConfidenceLevel, string>> = {
  low: "低置信",
  medium: "中置信",
  high: "高置信",
};

/**
 * 全站统一的置信度文案：low/medium/high → 低置信/中置信/高置信。
 * 等级由后端按观测日与样本量判定，前端只翻译，不重新判定，也不改等级顺序。
 * 洞察页（研判徽标、信号卡）已改用本函数；首页 apps/web 的 HomeWorkbench.tsx 仍是本地
 * 「置信度低/中/高」常量，下一轮由首页改为引用本函数即可对齐，不要再新增一套映射。
 */
export function confidenceLabel(confidence: ConfidenceLevel): string {
  return CONFIDENCE_LABELS[confidence];
}
export const SKILL_LABELS: Readonly<Record<string, string>> = {
  python: "Python",
  sql: "SQL",
  machine_learning: "机器学习",
  deep_learning: "深度学习",
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  large_language_models: "大语言模型",
  natural_language_processing: "自然语言处理",
  computer_vision: "计算机视觉",
  data_analysis: "数据分析",
  data_mining: "数据挖掘",
  data_engineering: "数据工程",
  spark: "Spark",
  java: "Java",
  javascript: "JavaScript",
  typescript: "TypeScript",
  react: "React",
  nodejs: "Node.js",
};

export function skillLabel(skillId: string): string {
  return SKILL_LABELS[skillId] ?? skillId.replaceAll("_", " ");
}

/**
 * 内部 ID / 英文字段名 → 中文领域词。洞察页渲染研判与信号文本时统一过一遍，
 * 旧缓存里的文本可能带 ai_application_development、data_analysis、role_family 这类内部标识。
 *
 * 两条约束：
 * - 长 id 优先：data_analysis 必须先于 data 命中；
 * - 只认 ASCII 词边界：前后是 A-Za-z0-9_ 的不算命中，避免改到 metadata / email 之类单词内部，
 *   同时允许中文紧邻（「职族：ai_algorithm」也要能替换）。
 */
const DOMAIN_FIELD_LABELS: Readonly<Record<string, string>> = {
  role_family: "职族",
  skills: "技能",
  skill: "技能",
  share: "占比",
  student_friendly: "学生友好",
  job_count: "岗位数",
  company_count: "公司数",
};

function escapeRegExp(text: string): string {
  const specials = ".+*?^$()[]{}|\\";
  return [...text].map((char) => (specials.includes(char) ? "\\" + char : char)).join("");
}

const DOMAIN_TERM_REPLACEMENTS: ReadonlyArray<{ pattern: RegExp; label: string }> = (
  [
    ...Object.entries(SKILL_LABELS),
    ...Object.entries(ROLE_FAMILY_LABELS),
    ...Object.entries(DOMAIN_FIELD_LABELS),
  ] as Array<readonly [string, string]>
)
  .sort(([left], [right]) => right.length - left.length)
  .map(([id, label]) => ({
    pattern: new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(id)}(?![A-Za-z0-9_])`, "g"),
    label,
  }));

export function localizeDomainTerms(text: string): string {
  let localized = text;
  for (const { pattern, label } of DOMAIN_TERM_REPLACEMENTS) {
    localized = localized.replace(pattern, label);
  }
  return localized;
}
