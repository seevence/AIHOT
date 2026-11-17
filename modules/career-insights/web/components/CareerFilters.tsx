import { Form, Link } from "react-router";
import type { EmploymentType, JobFiltersV1, RoleFamily, StudentFriendly } from "@aihot/career-insights/contracts";

const ROLE_FAMILY_OPTIONS: ReadonlyArray<{ value: RoleFamily; label: string }> = [
  { value: "ai_algorithm", label: "AI 算法" },
  { value: "ai_application_development", label: "AI 应用开发" },
  { value: "data", label: "数据" },
  { value: "ai_product_operations", label: "AI 产品与运营" },
  { value: "unknown", label: "未识别" },
];

const EMPLOYMENT_TYPE_OPTIONS: ReadonlyArray<{ value: EmploymentType; label: string }> = [
  { value: "campus", label: "校园招聘" },
  { value: "internship", label: "实习" },
  { value: "experienced", label: "社招" },
  { value: "other", label: "其他" },
  { value: "unknown", label: "未识别" },
];

const STUDENT_FRIENDLY_OPTIONS: ReadonlyArray<{ value: StudentFriendly; label: string }> = [
  { value: "yes", label: "是" },
  { value: "no", label: "否" },
  { value: "unknown", label: "未识别" },
];

const FIELD_CLASS = "mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2 focus:border-line-strong focus:outline-none";
const LABEL_CLASS = "block text-[12px] text-ink-4";

export function CareerFilters({ filters }: { filters: JobFiltersV1 }) {
  return (
    <section aria-labelledby="career-filters" className="rounded-card border border-line bg-surface p-4">
      <h2 id="career-filters" className="text-[16px] font-semibold text-ink">筛选职位</h2>
      <Form method="get" action="/career-insights" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="page_size" value={filters.page_size} />

        <label className={LABEL_CLASS}>
          方向
          <select name="role_family" defaultValue={filters.role_family ?? ""} className={FIELD_CLASS}>
            <option value="">全部</option>
            {ROLE_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          公司
          <input type="text" name="company" defaultValue={filters.company ?? ""} placeholder="公司全称" className={FIELD_CLASS} />
        </label>

        <label className={LABEL_CLASS}>
          城市
          <input type="text" name="city" defaultValue={filters.city ?? ""} placeholder="城市名" className={FIELD_CLASS} />
        </label>

        <label className={LABEL_CLASS}>
          用工类型
          <select name="employment_type" defaultValue={filters.employment_type ?? ""} className={FIELD_CLASS}>
            <option value="">全部</option>
            {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          学生友好
          <select name="student_friendly" defaultValue={filters.student_friendly ?? ""} className={FIELD_CLASS}>
            <option value="">全部</option>
            {STUDENT_FRIENDLY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 rounded-full bg-accent px-5 text-[13px] font-medium text-accent-contrast">
            应用
          </button>
          <Link to="/career-insights" className="inline-flex h-9 items-center rounded-full border border-line-strong px-5 text-[13px] font-medium text-ink-2">
            清除
          </Link>
        </div>
      </Form>
    </section>
  );
}