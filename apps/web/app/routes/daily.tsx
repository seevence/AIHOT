import { useLoaderData } from "react-router";
import type { Route } from "./+types/daily";
import { cachedPage } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta } from "../lib/seo";
import { CareerDailyReport } from "../../../../modules/career-insights/web/components/CareerDailyReport.ts";
import { loadCareerDaily } from "../../../../modules/career-insights/web/feeds.server.ts";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: "daily", name: "就业日报" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const daily = await loadCareerDaily(request.signal);
  return cachedPage(60, { daily });
}

export function meta({ loaderData }: Route.MetaArgs) {
  const date = loaderData?.daily.date;
  return pageMeta({
    title: `就业日报${date ? `（${date}）` : ""}`,
    description: "今日新增岗位与政策、各来源采集结果，以及空技能岗位占比。",
    path: "/daily",
    image: "/og/pages/daily.png",
  });
}

export default function CareerDailyPage() {
  const { daily } = useLoaderData<typeof loader>();
  return <CareerDailyReport daily={daily} />;
}