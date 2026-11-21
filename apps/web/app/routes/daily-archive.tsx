import { SITE, withSubject } from "@aihot/site";
import { cachedPage } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta } from "../lib/seo";
import { PhoneBar } from "../components/shell/PhoneBar";
import { SectionPlaceholder } from "../components/ui/SectionPlaceholder";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: "daily", name: "往期" };
export { pageHeaders as headers } from "../lib/api.server";
/** The address stays open (old links, the 往期 entry on report pages); the bound volumes are being rebuilt. */
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader() {
  return cachedPage(600, {});
}

export function meta() {
  return pageMeta({
    title: `${withSubject("日报")}合订本筹备中`,
    description: `${withSubject("日报")}合订本正在筹备，上线后会按日期归档在这里；现在可以先看最新的就业日报。`,
    path: "/daily/archive",
    image: "/og/pages/daily.png",
    // No issues to list yet, so nothing here should be indexed.
    noindex: true,
  });
}

export default function DailyArchive() {
  return (
    <>
      <PhoneBar back={{ to: "/daily", label: "日报" }} title={`${withSubject("日报")}合订本`} />
      <SectionPlaceholder
        kicker={`${SITE.name} · ${withSubject("日报")}`}
        title={`${withSubject("日报")}合订本正在筹备`}
        titleId="report-start"
        lead={`按日期翻看往期${withSubject("日报")}的合订本正在筹备。${withSubject("日报")}目前每天更新，旧的期数暂不在这里归档。`}
        reportLinks={[
          { to: "/daily", label: "日报" },
          { to: "/weekly", label: "周报" },
          { to: "/monthly", label: "月报" },
          { to: "/daily/archive", label: "往期", current: true },
        ]}
        entries={[
          { to: "/daily", label: "今天的就业日报", note: "当天新增岗位、政策与采集情况。" },
          { to: "/career-insights", label: "职业洞察", note: "就业趋势、异常信号与技能需求。" },
          { to: "/career-insights/jobs", label: "热门岗位", note: "按方向、职位与技能看正在招聘的岗位。" },
        ]}
        note="合订本上线前，往期内容请直接看就业日报；有想法可以通过反馈页告诉我们。"
      />
    </>
  );
}
