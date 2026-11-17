import type { EmploymentType, RoleFamily, StudentFriendly } from "@aihot/career-insights/contracts";

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