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
