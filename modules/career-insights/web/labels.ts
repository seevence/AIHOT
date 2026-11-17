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