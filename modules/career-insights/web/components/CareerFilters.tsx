import { Form, Link } from "react-router";
import type { EmploymentType, JobFiltersV1, RoleFamily, StudentFriendly } from "@aihot/career-insights/contracts";
import type { DashboardView } from "../filters";
import { serializeJobFilters } from "../filters";
import { EMPLOYMENT_TYPE_LABELS, ROLE_FAMILY_LABELS, SKILL_LABELS, STUDENT_FRIENDLY_LABELS } from "../labels";

const ROLE_FAMILY_VALUES: readonly RoleFamily[] = ["ai_algorithm", "ai_application_development", "data", "ai_product_operations", "unknown"];
const EMPLOYMENT_TYPE_VALUES: readonly EmploymentType[] = ["campus", "internship", "experienced", "other", "unknown"];
const STUDENT_FRIENDLY_VALUES: readonly StudentFriendly[] = ["yes", "no", "unknown"];

const ROLE_FAMILY_OPTIONS = ROLE_FAMILY_VALUES.map((value) => ({ value, label: ROLE_FAMILY_LABELS[value] }));
const EMPLOYMENT_TYPE_OPTIONS = EMPLOYMENT_TYPE_VALUES.map((value) => ({ value, label: EMPLOYMENT_TYPE_LABELS[value] }));
const STUDENT_FRIENDLY_OPTIONS = STUDENT_FRIENDLY_VALUES.map((value) => ({ value, label: STUDENT_FRIENDLY_LABELS[value] }));

const FIELD_CLASS = "mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2 focus:border-line-strong focus:outline-none";
const LABEL_CLASS = "block text-[12px] text-ink-4";

export function CareerFilters({ filters, view }: { filters: JobFiltersV1; view?: DashboardView }) {
  const directionView = view === "direction" && filters.role_family !== undefined;

  return (
    <section aria-labelledby="career-filters" className="rounded-card border border-line bg-surface p-4">
      <h2 id="career-filters" className="text-[16px] font-semibold text-ink">筛选职位</h2>
      <Form key={serializeJobFilters(filters)} method="get" action="/career-insights" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {directionView && <input type="hidden" name="view" value="direction" />}
        {directionView && <input type="hidden" name="role_family" value={filters.role_family ?? ""} />}
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="page_size" value={filters.page_size} />

        {directionView ? (
          <div className="text-[12px] text-ink-4">方向：{ROLE_FAMILY_LABELS[filters.role_family ?? "unknown"]}</div>
        ) : (
          <label className={LABEL_CLASS}>
            方向
            <select name="role_family" defaultValue={filters.role_family ?? ""} className={FIELD_CLASS}>
              <option value="">全部</option>
              {ROLE_FAMILY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}

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

        <label className={LABEL_CLASS}>
          技能
          <input type="text" name="skill" list="career-skill-options" defaultValue={filters.skill ?? ""} placeholder="技能标识，如 python" className={FIELD_CLASS} />
        </label>

        <datalist id="career-skill-options">
          {Object.entries(SKILL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </datalist>

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
