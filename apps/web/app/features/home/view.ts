// 首页区块的展示口径：纯函数与文案，客户端与服务端共用以保证 SSR 与交互后文本一致。
import type { CareerSkillV1, MetricResultV1, MetricSpecV1, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import { skillLabel } from "../../../../../modules/career-insights/web/labels.ts";

export const BLOCK_UNAVAILABLE = "本区块暂时不可用";
export const BLOCK_UNAVAILABLE_HINT = "该区块的数据请求失败，其余内容不受影响，可稍后刷新重试。";
export const KEEP_OBSERVING = "继续积累观测";
export const KEEP_OBSERVING_HINT = "样本不足或离线研判尚未生成，观测积累后自动更新。";

export interface HomeIndicatorV1 {
  label: string;
  value: string;
  note: string;
  pending: boolean;
}

function metric(summary: SummaryResponseV1, metricId: MetricSpecV1["metric_id"]): MetricResultV1 | null {
  return summary.metrics.find((entry) => entry.metric_id === metricId) ?? null;
}

/** 三个指标：观察窗新增岗位、活跃招聘企业、应届友好岗位。数据不足时只显示「继续积累观测」。 */
export function homeIndicators(summary: SummaryResponseV1): HomeIndicatorV1[] {
  const newJobs = metric(summary, "observed_new_jobs");
  const friendly = metric(summary, "student_friendly_share");
  const newJobsReady = newJobs?.status === "ok" && newJobs.value !== null;
  const friendlyReady = friendly?.status === "ok";

  return [
    {
      label: "观察窗新增岗位",
      value: newJobsReady ? String(newJobs.value) : KEEP_OBSERVING,
      note: "前后两次观测快照间首次出现的岗位，不等于市场真实新增。",
      pending: !newJobsReady,
    },
    {
      label: "活跃招聘企业",
      value: String(summary.company_count),
      note: "样本内当前有有效岗位的公司数。",
      pending: false,
    },
    {
      label: "应届友好岗位",
      value: friendlyReady ? String(friendly.numerator_count) : KEEP_OBSERVING,
      note:
        friendlyReady && friendly.unknown_count
          ? `另有 ${friendly.unknown_count} 个岗位未标注应届友好。`
          : "只计明确标注应届友好（campus/internship 或原文写明）的岗位，未标注不代表不友好。",
      pending: !friendlyReady,
    },
  ];
}

/** 准备建议按样本里出现最多的技能给出；没有技能数据时只留与数据无关的两条。 */
export function prepareHints(skills: readonly CareerSkillV1[]): string[] {
  const top = skills.slice(0, 3).map((entry) => skillLabel(entry.skill));
  const hints = top.length > 0
    ? [`优先补足样本需求最多的 ${top.join("、")}，用课程项目或实习把它们串成一条完整链路。`]
    : [];
  hints.push(
    "把简历里的技术栈与目标方向的岗位标题对齐：算法方向突出建模与评测，应用开发方向突出端到端交付。",
    "投递前先确认「应届友好」标记与要求年限，校招与实习入口通常比社招更看重项目完整度。",
  );
  return hints;
}